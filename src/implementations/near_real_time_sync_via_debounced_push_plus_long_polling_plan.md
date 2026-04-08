# Plan: Near-Real-Time Sync via Debounced Push + Long Polling

## Context

The current sync is triggered only on three events: app foreground, network reconnect, and post-payment confirmation. If Device B is actively using the app all day without backgrounding, it can miss Device A's changes indefinitely. The goal is that when Device A creates/updates a catalog record (item, recipe, category, etc.), Device B receives it within a few seconds — without WebSockets or FCM.

**Backend**: Laravel 11 + PHP-FPM + MySQL 8.0 + Redis 7 (Docker). No streaming infrastructure exists yet. Rate limit: 60 req/min per user.

---

## Why Long Polling is Better Than Short Polling

| | Short poll (setInterval 30s) | Long Polling |
|---|---|---|
| Device B latency | up to 30 seconds | ~2–5 seconds |
| Requests when idle | 120 req/hour per device | ~2 req/hour per device (just reconnects) |
| Server load | constant | only on change or timeout |
| Complexity | trivial | moderate (backend + client loop) |
| PHP-FPM worker held | no | yes, for up to 25s per connection |

For a restaurant POS with 2–10 devices, holding a PHP-FPM worker per long-poll connection is fine. The payoff is near-real-time delivery with minimal wasted traffic.

**End-to-end latency**: Device A mutates → 2s debounce → push → MySQL updated → Device B's poll detects change within 2s check cycle → Device B pulls. **Total: ~4–6 seconds.**

---

## Disadvantages of Long Polling (PHP-FPM)

1. **Holds a worker per connection.** Each active device holds a PHP-FPM worker for up to 25 seconds. For a small restaurant (2–5 devices), fine. For a SaaS with hundreds of branches, this would exhaust the worker pool — long term, SSE or WebSocket (Laravel Reverb) would be needed.
2. **PHP `max_execution_time` and Nginx timeout must be tuned** for the poll endpoint or requests get killed mid-wait.
3. **No push for Group B entities.** `inventory_logs`, purchases, revenues, etc. are push-only — Device B cannot pull them. The "Yield Now → Device B sees stock usage" example still requires moving `inventory_logs` to Group A (or a new pull-only Group C). This is a separate design decision not covered here.
4. **Reconnect loop required on the client.** The client must immediately reconnect after every response (change detected or timeout) to maintain continuous coverage. If the app is backgrounded, the loop stops.
5. **Auth token expiry during long hold.** If the Sanctum token expires mid-poll, the server should return 401 and the client should handle it gracefully.

---

## Architecture

```
Device A                     Server (Laravel)              Device B
  │                               │                            │
  │── mutation ──────────────────>│                            │
  │   scheduleSyncSoon(2000)      │                            │
  │                               │<── GET /sync/notify ───────│
  │── POST /sync/push ───────────>│   (holding connection)     │
  │                               │   [MySQL check loop ~2s]   │
  │                               │── updated_at changed ─────>│
  │                               │   has_changes: true        │
  │                               │                            │── runSync() ──>│
```

---

## Implementation Plan

### Backend — New `GET /api/v2/sync/notify` endpoint

**File**: `/Users/eleyjambaro/fcms-api/src/app/Http/Controllers/SyncController.php`

Add a `notify()` method:

```php
public function notify(Request $request): JsonResponse
{
    $request->validate([
        'branch_id' => 'required|string',
        'since'     => 'required|date',
        'timeout'   => 'integer|min:5|max:25',
    ]);

    $companyId  = $request->user()->company_id;
    $branchId   = $request->input('branch_id');
    $since      = $request->input('since');
    $timeout    = (int) $request->input('timeout', 25);
    $excludeId  = $request->header('X-Device-Id');
    $deadline   = time() + $timeout;

    set_time_limit($timeout + 5);

    $groupAModels = [
        \App\Models\Sync\Category::class,
        \App\Models\Sync\Tax::class,
        \App\Models\Sync\Vendor::class,
        \App\Models\Sync\VendorContactPerson::class,
        \App\Models\Sync\Operation::class,
        \App\Models\Sync\RecipeKind::class,
        \App\Models\Sync\Recipe::class,
        \App\Models\Sync\Ingredient::class,
        \App\Models\Sync\Item::class,
        \App\Models\Sync\Modifier::class,
        \App\Models\Sync\ModifierOption::class,
        \App\Models\Sync\SellingMenu::class,
        \App\Models\Sync\SellingMenuItem::class,
    ];

    while (time() < $deadline) {
        foreach ($groupAModels as $model) {
            $q = $model::where('company_id', $companyId)
                ->where('branch_id', $branchId)
                ->where('updated_at', '>', $since);

            if ($excludeId) {
                $q->where('device_id', '!=', $excludeId);
            }

            if ($q->exists()) {
                return $this->success('Changes available.', ['has_changes' => true]);
            }
        }
        sleep(2);
    }

    return $this->success('No changes.', ['has_changes' => false]);
}
```

**File**: `/Users/eleyjambaro/fcms-api/src/routes/api.php`

Add the route alongside existing sync routes:

```php
Route::get('/sync/notify', [SyncController::class, 'notify']);
```

**Nginx config**: Add `proxy_read_timeout 35s;` for the `/sync/notify` location block, or globally if simpler.

---

### Client — `pollForChanges` in server query layer

**File**: `/Users/eleyjambaro/fcms-rn-79/src/serverDbQueries/v2/sync.js`

Add alongside `pushDelta` / `pullDelta`:

```js
export const pollForChanges = async ({branch_id, device_id, since, timeout = 25}) => {
  const headers = {
    ...(await getAuthHeaders()),
    'X-Device-Id': device_id,
  };
  return cloudApiV2.get('/api/v2/sync/notify', {
    params: {branch_id, since, timeout},
    headers,
    timeout: (timeout + 5) * 1000, // axios timeout > server timeout
  });
};
```

---

### Client — Long poll loop in `syncService.js`

**File**: `/Users/eleyjambaro/fcms-rn-79/src/services/syncService.js`

Add below the existing `syncInProgress` guard:

```js
import {pollForChanges} from '../serverDbQueries/v2/sync';
import {getCloudSyncParams} from '../localDb/index';

// Debounced push after mutations
let debounceTimer = null;
export const scheduleSyncSoon = (delayMs = 2000) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runSync().catch(console.warn);
  }, delayMs);
};

// Long poll loop — call startLongPoll() when app goes foreground, stopLongPoll() on background
let longPollActive = false;

export const startLongPoll = async () => {
  if (longPollActive) return;
  longPollActive = true;

  while (longPollActive) {
    try {
      const {deviceId, branchId} = await getCloudSyncParams();
      if (!deviceId || !branchId) {
        await new Promise(r => setTimeout(r, 10_000));
        continue;
      }

      // Use the most recent pulled_at watermark from any Group A entity
      // Fallback to epoch so we get everything on first run
      const since = await getMostRecentPulledAt() ?? '1970-01-01T00:00:00Z';

      const response = await pollForChanges({
        branch_id: branchId,
        device_id: deviceId,
        since,
        timeout: 25,
      });

      if (response?.data?.data?.has_changes) {
        await runSync();
      }
      // On timeout (has_changes: false), immediately reconnect — no delay needed
    } catch (err) {
      // Network error, auth error, etc. — back off before retry
      if (!longPollActive) break;
      await new Promise(r => setTimeout(r, 5_000));
    }
  }
};

export const stopLongPoll = () => {
  longPollActive = false;
};

// Helper: get the earliest last_pulled_at across all Group A entities
// (use earliest so we don't miss any entity's changes)
const getMostRecentPulledAt = async () => {
  try {
    const db = await getDBConnection();
    const [result] = await db.executeSql(
      `SELECT MIN(last_pulled_at) as since FROM sync_metadata`,
    );
    return result.rows.item(0)?.since ?? null;
  } catch {
    return null;
  }
};
```

---

### Client — Wire start/stop into `useAppLifecycle.js`

**File**: `/Users/eleyjambaro/fcms-rn-79/src/hooks/useAppLifecycle.js`

Replace the existing `runSync()` call on foreground with `startLongPoll()`, and stop on background:

```js
import {runSync, startLongPoll, stopLongPoll} from '../services/syncService';

// In useEffect:
// On mount: start if already foreground
if (AppState.currentState === 'active') {
  startLongPoll();
}

// In AppState listener:
if (isForeground) {
  startLongPoll();   // replaces the existing runSync() call
}

if (nextAppState === 'background' || nextAppState === 'inactive') {
  stopLongPoll();
}

// In cleanup:
stopLongPoll();
```

---

### Client — Wire `scheduleSyncSoon` into Group A mutation files

Only Group A entities need this (Device B only pulls these). ~11 files:

| File | Key functions |
|---|---|
| `categories.js` | createCategory, updateCategory, deleteCategory |
| `taxes.js` | createTax, updateTax, deleteTax |
| `vendors.js` | createVendor, updateVendor, deleteVendor, + vendor_contact_persons |
| `operations.js` | createOperation, updateOperation, deleteOperation |
| `recipeKinds.js` (verify name) | create, update, delete |
| `recipes.js` | createRecipe, updateRecipe, deleteRecipe |
| `ingredients.js` | createIngredient, updateIngredient, deleteIngredient |
| `items.js` | createItem, updateItem, deleteItem |
| `modifiers.js` | createModifier, updateModifier, deleteModifier, + modifier_options |
| `sellingMenus.js` (verify name) | create, update, delete, + selling_menu_items |

Pattern for each:
```js
import {scheduleSyncSoon} from '../services/syncService';

export const createItem = async (...) => {
  // ... existing logic ...
  await db.executeSql(insertQuery, params);
  scheduleSyncSoon(); // ← add this after every write
};
```

Group B files (purchases, revenues, expenses, inventory_logs, sales_orders, etc.) — **do not touch**. They push on the next `runSync()` triggered by the long poll detecting their own Group A changes, or by the foreground/reconnect triggers that remain unchanged.

---

## Critical Files

**Backend**:
- `/Users/eleyjambaro/fcms-api/src/app/Http/Controllers/SyncController.php` — add `notify()` method
- `/Users/eleyjambaro/fcms-api/src/routes/api.php` — add `GET /sync/notify` route
- Nginx config — add `proxy_read_timeout 35s` for the notify route

**Client**:
- `/src/services/syncService.js` — add `scheduleSyncSoon`, `startLongPoll`, `stopLongPoll`, `getMostRecentPulledAt`
- `/src/serverDbQueries/v2/sync.js` — add `pollForChanges`
- `/src/hooks/useAppLifecycle.js` — replace foreground `runSync()` with `startLongPoll()` / `stopLongPoll()`
- Group A localDbQuery files (~11) — add `scheduleSyncSoon()` after writes

---

## Note on Group B / inventory_logs

The "Yield Now → Device B sees stock usage" use case requires `inventory_logs` to be **pulled**, not just pushed. Currently it's Group B (push-only). Two options to consider separately:
- **Move to Group A**: bidirectional, last-write-wins — risk of conflict if two devices log usage for the same ingredient simultaneously
- **Add Group C (pull-only)**: Device B pulls these as read-only transaction history; never writes them locally

This is out of scope for this plan — raise it as a follow-up.

---

## Verification

1. **Debounced push**: Create an item on Device A. Within ~2 seconds, `sync_metadata.last_pushed_at` should update. Confirm the item exists on the server.
2. **Long poll notification**: Device B is actively polling. Create an item on Device A. Device B should call `runSync()` and have the new item in its local DB within ~4–6 seconds — without foregrounding/backgrounding.
3. **Timeout reconnect**: Let Device B sit idle. Confirm it sends a new `GET /sync/notify` request every ~25 seconds (visible in Metro logs or network inspector).
4. **Background stop**: Background Device B. Confirm no `GET /sync/notify` requests are made (check network inspector).
5. **No double-sync storm**: Create 5 items rapidly on Device A. Confirm `scheduleSyncSoon` collapses them into one `runSync()` call, not 5.
6. **Auth/network error recovery**: Kill the network on Device B mid-poll. Confirm it backs off 5 seconds and retries cleanly.
