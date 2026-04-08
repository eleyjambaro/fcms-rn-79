# Plan: cPanel-Safe Sync — Replace Long Poll with Interval Poll + Batch Pull

## Context

The long-poll implementation (Part 1–4 of the previous plan) was designed for a Docker/VPS environment. The deployment target is **cPanel shared hosting**, which changes the constraints:

- PHP-FPM worker pool is limited and shared. Holding workers for 25 seconds per device exhausts them quickly.
- 15 devices × 25s held connections = 15 concurrent workers consumed at all times.
- The `notify()` loop runs 31 DB existence checks every 2s per connection (~372 queries per 25s window per device). At 15 devices: ~223 queries/second just for polling — before any actual sync work.
- cPanel's PHP execution time limit and Nginx/Apache timeouts may kill the long-held request anyway.

**The replacement strategy**:

1. Remove long polling (server `notify()` + client `startLongPoll`) — it's the only weak point in an otherwise solid architecture.
2. Keep `scheduleSyncSoon()` (2s debounce after mutations) — this is the primary real-time trigger.
3. Keep foreground/reconnect triggers — already implemented in `useAppLifecycle.js`.
4. Add a **15-second interval poll** as a safety net for Device B to pick up Device A's changes.
5. Fix the **31-call pull loop** to a **single batch pull** call — the backend already returns all entities in one request; the client is making 31 redundant calls.

**Why 15 seconds (not 3-5s as some reviews suggest):**
- `scheduleSyncSoon()` already handles post-mutation sync immediately (2s delay). The interval is only a safety net for the gap where Device B is in foreground and Device A mutates.
- 15s interval: ~4 req/min per device. 5 devices = 20 req/min total. Safe for cPanel.
- 3-5s interval: 12-20 req/min per device. 15 devices = 180-300 req/min total — approaches rate limits and taxes shared hosting.
- For the restaurant yield-before-Device-B use case, 15s lag is acceptable; the system is still dramatically better than the previous foreground-only trigger.

**Why batch pull matters:**
The backend `pull()` method already returns all 31 Group A entities in a single API call. But the client calls `pullDelta()` 31 times in a loop — once per entity with its own per-entity watermark. This generates 31 HTTP requests per sync cycle. With batch pull: 1 request. The tradeoff is using `MIN(last_pulled_at)` as the single `since` watermark, which may return some already-seen records, but `applyPulledRecord` handles this correctly (INSERT OR IGNORE + updated_at comparison).

**Backend**: Laravel 11 + PHP-FPM + MySQL 8.0, deployed to cPanel. Rate limit: 60 req/min per user.

---

## Architecture

```
Device A                     Server (Laravel/cPanel)       Device B
  │                               │                            │
  │── mutation ──────────────────>│                            │
  │   scheduleSyncSoon(2000)      │                            │
  │── POST /sync/push ───────────>│                            │
  │── GET  /sync/pull ───────────>│ (all 31 entities, 1 call)  │
  │                               │                            │
  │                               │        (15s interval) ─────│
  │                               │<── GET /sync/pull ─────────│
  │                               │ (pulls delta since last     │
  │                               │  pulled_at watermark)       │
```

End-to-end latency: Device A mutates → 2s debounce → push+pull → Device B sees it within 15s max.

---

## Implementation Plan

### Already Complete (from previous session)
- Group B → Group A migration (backend + client)
- `scheduleSyncSoon()` added to all mutation files
- `startLongPoll` / `stopLongPoll` / `pollForChanges` implemented (to be replaced below)

---

### Part 1 — Remove long polling from client

**File**: `src/services/syncService.js`

Remove:
- `startLongPoll` export and its implementation
- `stopLongPoll` export
- `getEarliestPulledAt` helper (no longer needed)
- The `pollForChanges` import from `serverDbQueries/v2/sync`

Keep `scheduleSyncSoon` — it is the primary real-time trigger and stays unchanged.

**File**: `src/serverDbQueries/v2/sync.js`

Remove the `pollForChanges` export entirely.

---

### Part 2 — Remove long polling from backend

**File**: `fcms-api/src/app/Http/Controllers/SyncController.php`

Remove the `notify()` method.

**File**: `fcms-api/src/routes/api.php`

Remove the `Route::get('notify', ...)` line.

---

### Part 3 — Replace with 15-second interval poll in `useAppLifecycle.js`

**File**: `src/hooks/useAppLifecycle.js`

Replace `startLongPoll` / `stopLongPoll` with a `setInterval` that calls `runSync()` every 15 seconds. Clear the interval when the app backgrounds.

```js
import {runSync, scheduleSyncSoon} from '../services/syncService';

// module-level ref
let syncIntervalId = null;

const startIntervalSync = () => {
  if (syncIntervalId) return; // already running
  runSync().catch(console.warn); // immediate sync on foreground
  syncIntervalId = setInterval(() => {
    runSync().catch(console.warn);
  }, 15_000);
};

const stopIntervalSync = () => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
};

// Inside useEffect AppState listener:
// On mount if already active:
if (AppState.currentState === 'active') startIntervalSync();

// In AppState change handler:
if (isForeground) startIntervalSync();
if (nextAppState === 'background' || nextAppState === 'inactive') stopIntervalSync();

// In cleanup:
stopIntervalSync();
```

---

### Part 4 — Fix the 31-call pull loop to a single batch pull in `syncService.js`

**File**: `src/services/syncService.js`

The current Phase 3 calls `pullDelta()` 31 times in a loop (once per entity with its own `since` watermark). The backend already returns all entities in one call. Replace with a single call using `MIN(last_pulled_at)` from `sync_metadata`.

**Remove** the per-entity pull loop and **replace** with:

```js
// ---- Phase 3: Pull (Group A — single batch call) ----
try {
  const [metaResult] = await db.executeSql(
    `SELECT MIN(last_pulled_at) AS since FROM sync_metadata`,
  );
  const since = metaResult.rows.item(0)?.since ?? '1970-01-01T00:00:00Z';

  const pullResponse = await pullDelta({
    since,
    branch_id: branchId,
    device_id: deviceId,
  });

  const {pulled_at, delta: pulledDelta = {}} = pullResponse?.data ?? {};

  for (const {key, table} of GROUP_A_ENTITIES) {
    const records = pulledDelta[key] ?? [];
    for (const record of records) {
      try {
        await applyPulledRecord(db, table, record);
      } catch (err) {
        result.errors.push(`Apply pull record failed for ${table}: ${err.message}`);
      }
    }
    if (records.length > 0) {
      result.pulled[key] = records.length;
    }
    if (pulled_at) {
      await updateSyncMetadata(db, key, {lastPulledAt: pulled_at});
    }
  }
} catch (err) {
  result.errors.push(`Pull failed: ${err.message}`);
}
```

**Why this is safe**: `applyPulledRecord` uses `INSERT OR IGNORE` for new records and only updates if `server.updated_at > local.updated_at` for existing records. Records that some entities already have (due to using `MIN` rather than per-entity watermarks) are silently skipped.

---

## Critical Files

**Backend** (removals only):
- `fcms-api/src/app/Http/Controllers/SyncController.php` — remove `notify()` method
- `fcms-api/src/routes/api.php` — remove `Route::get('notify', ...)`

**Client**:
- `src/services/syncService.js` — remove `startLongPoll`, `stopLongPoll`, `getEarliestPulledAt`; replace 31-call pull loop with single batch pull (Part 4)
- `src/serverDbQueries/v2/sync.js` — remove `pollForChanges`
- `src/hooks/useAppLifecycle.js` — replace `startLongPoll`/`stopLongPoll` with `startIntervalSync`/`stopIntervalSync` using `setInterval(runSync, 15_000)` (Part 3)

---

## Load Comparison

| Approach | Req/hour per device (idle) | Server per request | PHP-FPM worker held |
|---|---|---|---|
| Long poll (removed) | ~144 (reconnects) | ~372 DB queries | 25 seconds |
| setInterval 5s (reviewer suggestion) | 720 | ~2 API calls | <1s |
| setInterval 15s (this plan) | 240 | ~2 API calls | <1s |
| scheduleSyncSoon (post-mutation) | event-driven | ~2 API calls | <1s |

At 5 devices on one branch: 1,200 req/hour (5s) vs 1,200 req/hour (15s). The 15s interval produces 5x fewer background requests while still catching Device A→Device B changes within 15s.

---

## Verification

1. **Debounced push**: Create an item on Device A. Within ~2s, check server DB — item exists with `synced_at` set.
2. **Interval pull**: Device B is in foreground. Create an item on Device A (wait for Device A's `scheduleSyncSoon` to push it). Within ~15s, Device B's local DB has the item — without any user action on Device B.
3. **Batch pull efficiency**: Add Metro log in `runSync()` after Phase 3. Confirm only **one** `GET /api/v2/sync/pull` request appears per sync cycle (not 31).
4. **Background stop**: Background Device B. Confirm no `GET /api/v2/sync/pull` requests appear in the network inspector.
5. **Foreground resume**: Foreground Device B. Confirm `runSync()` fires immediately (not after 15s) and the interval restarts.
6. **No storm**: Rapidly create 5 items on Device A. Confirm `scheduleSyncSoon` collapses them into one sync — Metro logs show a single push request.
