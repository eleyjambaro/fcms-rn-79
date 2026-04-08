# Plan: Near-Real-Time Sync via Debounced Push + Long Polling

## Context

The current sync is triggered only on three events: app foreground, network reconnect, and post-payment confirmation. If Device B is actively using the app all day without backgrounding, it can miss Device A's changes indefinitely. The goal is that when Device A creates/updates any record (item, recipe, category, inventory_log, sale, etc.), Device B receives it within a few seconds — without WebSockets or FCM.

**Backend**: Laravel 11 + PHP-FPM + MySQL 8.0 + Redis 7 (Docker). No streaming infrastructure exists yet. Rate limit: 60 req/min per user.

---

## Why Long Polling is Better Than Short Polling

| | Short poll (setInterval 30s) | Long Polling |
|---|---|---|
| Device B latency | up to 30 seconds | ~4–6 seconds |
| Requests when idle | 120 req/hour per device | ~2 req/hour per device |
| Server load | constant | only on change or timeout |
| Complexity | trivial | moderate (backend + client loop) |
| PHP-FPM worker held | no | yes, for up to 25s per connection |

**End-to-end latency**: Device A mutates → 2s debounce → push → MySQL updated → Device B's poll detects change within 2s check cycle → Device B pulls. **Total: ~4–6 seconds.**

---

## Disadvantages of Long Polling (PHP-FPM)

1. **Holds a PHP-FPM worker per connection.** For 2–5 devices per branch, fine. For hundreds of branches with many devices, this would exhaust the worker pool. Long-term upgrade: SSE or WebSocket (Laravel Reverb).
2. **PHP `max_execution_time` and Nginx timeout must be tuned** for the poll endpoint or requests get killed mid-wait.
3. **Stops when app is backgrounded.** iOS kills background timers — Device B only gets updates while its screen is on.
4. **Reconnect loop required on the client.** Must immediately reconnect after every response to maintain continuous coverage.
5. **Auth token expiry during long hold.** Sanctum token expiry mid-poll returns 401 — client must handle gracefully.

---

## Moving All Group B Entities to Group A

### Why Group C (pull-only) doesn't work

Group C would mean Device B receives records from other devices but never writes to those tables. That fails immediately for `inventory_logs` and `sale_logs` — Device B **does** write to those tables (when it yields, makes a sale, records a spoilage). A table that a device both reads from other devices AND writes to is Group A by definition.

### Why moving ALL Group B to Group A is correct

Every Group B record has a **device-generated `sync_id` (UUID)**. This is the key insight:

- Device A creates `inventory_log` with `sync_id = UUID-A-1` → pushed to server
- Device B creates `inventory_log` with `sync_id = UUID-B-1` → pushed to server
- On pull, Device B receives `UUID-A-1` → **INSERT** (new record, no conflict)
- On pull, Device A receives `UUID-B-1` → **INSERT** (new record, no conflict)

There is no last-write-wins conflict because each device creates unique records. The only time last-write-wins activates is if the **same `sync_id`** exists on both devices with different `updated_at` — which only happens if a record is edited after creation. For most transaction records this is rare, and last-write-wins is still the correct resolution.

**Why each entity needs bidirectional sync:**

| Entity | Why Device B needs it |
|---|---|
| `inventory_logs` | Yield awareness — Device B sees Device A's stock deductions before deciding to yield the same recipe |
| `sale_logs` | Complete branch sales picture on all terminals |
| `sales_order_groups`, `sales_orders` | Device B must see orders created by Device A to fulfill them |
| `invoices`, `payments`, `refunds` | Any terminal may need to reference or void a transaction from another terminal |
| `batch_stock_usage_groups/entries` | Multi-device stock usage visibility |
| `batch_purchase_groups/entries` | Branch-wide purchasing records |
| `revenue_groups/revenues`, `expense_groups/expenses` | Complete P&L picture on any device |
| `revenue_deductions`, `revenue_categories` | Revenue reporting completeness |
| `spoilages` | Spoilage affects stock — all devices should see it |

### Risks and mitigations

1. **Pull volume**: Transaction tables grow large. The `since` watermark limits results to only records updated since the last pull — after the first full sync, subsequent pulls fetch only the delta. Already works correctly in both the server `pull()` handler and client `getLastPulledAt()` / `updateSyncMetadata()` logic.

2. **`items.current_stock_qty`**: Pulling Device A's inventory_logs gives Device B the log history, but doesn't recalculate stock on the item. However, `items` is already Group A — Device A's yield also updates `item.current_stock_qty` and pushes it. Device B gets the correct stock level through the item record, not by re-deriving from logs.

3. **Client `applyPulledRecord`**: The existing INSERT/UPDATE logic handles any number of fields correctly — no change needed.

### Updated entity count

| Group | Before | After |
|---|---|---|
| Group A (bidirectional) | 13 entities | 31 entities |
| Group B (push-only, reserved) | 18 entities | 0 entities |

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

### Part 0 — Move Group B → Group A (both sides)

**Backend** (`SyncController.php`):
- Move all 18 entries from `GROUP_B` into `GROUP_A`
- Set `GROUP_B = []` (empty, reserved for future use)
- No logic changes needed — `pull()` already iterates `GROUP_A` with no-echo filter; `push()` last-write-wins upsert is correct for these entities; the new `notify()` endpoint will automatically cover all of them

**Client** (`syncService.js`):
- Move all 18 entries from `GROUP_B_ENTITIES` into `GROUP_A_ENTITIES`
- Set `GROUP_B_ENTITIES = []`
- `ALL_PUSH_ENTITIES` stays the same (all entities pushed — now just all Group A)
- Pull loop in Phase 3 now covers all 31 entities

---

### Part 1 — New `GET /api/v2/sync/notify` endpoint (Backend)

**File**: `fcms-api/src/app/Http/Controllers/SyncController.php`

Add `notify()` method. It checks all `GROUP_A` models for changes every 2 seconds and returns immediately on the first match, or `has_changes: false` on timeout:

```php
public function notify(Request $request): JsonResponse
{
    $request->validate([
        'branch_id' => 'required|string',
        'since'     => 'required|date',
        'timeout'   => 'integer|min:5|max:25',
    ]);

    $companyId = $request->user()->company_id;
    $branchId  = $request->input('branch_id');
    $since     = $request->input('since');
    $timeout   = (int) $request->input('timeout', 25);
    $excludeId = $request->header('X-Device-Id');
    $deadline  = time() + $timeout;

    set_time_limit($timeout + 5);

    while (time() < $deadline) {
        foreach (self::GROUP_A as [$modelClass]) {
            $q = $modelClass::where('company_id', $companyId)
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

**File**: `fcms-api/src/routes/api.php`

```php
Route::get('/sync/notify', [SyncController::class, 'notify']);
```

**Nginx**: Add `proxy_read_timeout 35s;` for the `/sync/notify` location (or globally).

---

### Part 2 — `pollForChanges` in server query layer (Client)

**File**: `src/serverDbQueries/v2/sync.js`

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
    timeout: (timeout + 5) * 1000, // axios timeout must exceed server timeout
  });
};
```

---

### Part 3 — `scheduleSyncSoon`, `startLongPoll`, `stopLongPoll` in `syncService.js`

**File**: `src/services/syncService.js`

Add below the existing `syncInProgress` guard:

```js
import {pollForChanges} from '../serverDbQueries/v2/sync';

// Debounced push: collapses rapid mutations into one sync attempt
let debounceTimer = null;
export const scheduleSyncSoon = (delayMs = 2000) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runSync().catch(console.warn);
  }, delayMs);
};

// Long poll loop — start on foreground, stop on background
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

      // Use the earliest last_pulled_at watermark across all Group A entities
      // so we don't miss changes for any entity
      const since = await getEarliestPulledAt() ?? '1970-01-01T00:00:00Z';

      const response = await pollForChanges({
        branch_id: branchId,
        device_id: deviceId,
        since,
        timeout: 25,
      });

      if (response?.data?.data?.has_changes) {
        await runSync();
      }
      // On timeout (has_changes: false), immediately reconnect — no delay
    } catch (err) {
      if (!longPollActive) break;
      await new Promise(r => setTimeout(r, 5_000)); // back off on error
    }
  }
};

export const stopLongPoll = () => {
  longPollActive = false;
};

// Earliest last_pulled_at across all Group A entities in sync_metadata
const getEarliestPulledAt = async () => {
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

### Part 4 — Wire into `useAppLifecycle.js`

**File**: `src/hooks/useAppLifecycle.js`

Replace the foreground `runSync()` call with `startLongPoll()`; stop on background:

```js
import {runSync, startLongPoll, stopLongPoll} from '../services/syncService';

// Inside useEffect:
// On mount: start if already foreground
if (AppState.currentState === 'active') startLongPoll();

// In AppState listener:
if (isForeground) {
  startLongPoll(); // replaces existing runSync() call
}
if (nextAppState === 'background' || nextAppState === 'inactive') {
  stopLongPoll();
}

// In cleanup:
stopLongPoll();
```

---

### Part 5 — `scheduleSyncSoon` in Group A mutation files

Since Group A now includes all 31 entities, **every** localDbQuery mutation function (create/update/delete) should call `scheduleSyncSoon()` after its write. That covers ~all 30 files.

Pattern:

```js
import {scheduleSyncSoon} from '../services/syncService';

export const createInventoryLog = async (...) => {
  // ... existing logic ...
  await db.executeSql(insertQuery, params);
  scheduleSyncSoon(); // ← add after every write
};
```

Previously Group B files that now need `scheduleSyncSoon` added:
- `batchPurchaseGroups.js` / `batchPurchaseEntries.js`
- `batchStockUsageGroups.js` / `batchStockUsageEntries.js`
- `revenues.js` / `revenueGroups.js`
- `expenses.js` / `expenseGroups.js`
- `revenueDeductions.js` / `revenueCategories.js`
- `spoilages.js`
- `salesOrderGroups.js` / `salesOrders.js`
- `invoices.js` / `saleLogs.js`
- `refunds.js` / `payments.js`
- `inventoryLogs.js`

(Verify exact filenames in `src/localDbQueries/` — there are 30 files total.)

---

## Critical Files

**Backend**:
- `fcms-api/src/app/Http/Controllers/SyncController.php` — move GROUP_B into GROUP_A; add `notify()` method
- `fcms-api/src/routes/api.php` — add `GET /sync/notify`
- Nginx config — `proxy_read_timeout 35s` for `/sync/notify`

**Client**:
- `src/services/syncService.js` — add `scheduleSyncSoon`, `startLongPoll`, `stopLongPoll`, `getEarliestPulledAt`; move GROUP_B_ENTITIES into GROUP_A_ENTITIES
- `src/serverDbQueries/v2/sync.js` — add `pollForChanges`
- `src/hooks/useAppLifecycle.js` — replace foreground `runSync()` with `startLongPoll()` / `stopLongPoll()`
- All ~30 `src/localDbQueries/*.js` files — add `scheduleSyncSoon()` after every write

---

## Verification

1. **Debounced push**: Create an item on Device A. Within ~2 seconds, `sync_metadata.last_pushed_at` updates and the item appears on the server.
2. **Long poll notification**: Device B is actively polling. Create an item on Device A. Device B calls `runSync()` and has the item in its local DB within ~4–6 seconds — without foregrounding/backgrounding.
3. **inventory_log cross-device**: Device A presses "Yield Now." Within ~4–6 seconds, Device B's local `inventory_logs` table has Device A's record — visible before Device B attempts its own yield.
4. **Timeout reconnect**: Let Device B sit idle. Confirm it sends a new `GET /sync/notify` request every ~25 seconds (Metro logs or network inspector).
5. **Background stop**: Background Device B. Confirm no `GET /sync/notify` requests are made.
6. **No double-sync storm**: Create 5 items rapidly on Device A. Confirm `scheduleSyncSoon` collapses them into one `runSync()` call.
7. **Error recovery**: Kill the network on Device B mid-poll. Confirm it backs off 5 seconds and retries cleanly.
