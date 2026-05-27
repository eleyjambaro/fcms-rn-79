# Plan: Batch Transfer Feature

## Context

FCMS already supports per-item, per-branch stock changes via `inventory_logs` rows, and supports authoring multi-item batches via the **Batch Purchase** / **Batch Stock Usage** flow (draft → confirm → inventory logs created). It also already has two seeded operations — `stock_transfer_in` and `stock_transfer_out` — but no UI to author transfers, and no cross-branch coordination.

The user wants a production-grade **Batch Transfer** feature with two modes:

1. **Log Batch Transfer** (mode = `log`) — single-sided ledger entry: user picks items + qty + remarks, system stamps `inventory_logs` with `stock_transfer_out` (or `_in`). No counterpart branch. **Ship "Coming Soon" placeholder only in v1.**
2. **Branch-to-Branch Batch Transfer** (mode = `branch_to_branch`) — full stateful handshake between two branches of the same company, with status transitions (Requested → Accepted → Transferring → Received), per-item remarks/qty adjustments, and offline-first sync. **This is the v1 scope.**

The complication: today, sync is strictly branch-scoped — each device pulls only its own branch's rows. A cross-branch transfer must be visible to BOTH branches via a single shared record. This requires extending the server's pull filter for the new tables.

User-confirmed design decisions:
- **Item bridging**: via `master_item_id` (the existing company-scoped catalog). Items not present in dest branch are auto-created at receive time, linked by master_item_id.
- **Draft flow**: local draft → submit → "Requested" (matches Batch Purchase UX).
- **Cancel/reject**: source can cancel before "Transferring"; dest can reject the entire request.
- **Permissions**: new dedicated transfer permission keys (transfer.create, transfer.review, transfer.transfer_out, transfer.receive).

---

## High-Level Design

### State machine (per `batch_transfer_groups.status`)

```
DRAFT (source-only; not visible to dest)
  └─ Submit Request ──────────────► REQUESTED
                                        │
   ┌────── Source cancels ◄─────────────┤
   │                                    │
CANCELLED                       Dest reviews each entry,
                                sets accepted_qty + dest_remarks,
                                presses "Accept Transfer In Request"
                                        │
                                        ▼
                                    ACCEPTED ──── Dest rejects (all items declined) ──► REJECTED
                                        │
                ┌─── Source cancels ◄───┤
                │                       │
            CANCELLED              Source reviews,
                                   sets adjusted_qty + source_remarks,
                                   presses "Transfer"
                                        │
                                        ▼
                                  TRANSFERRING
                                        │
                                   Dest physically receives,
                                   sets received_qty per item,
                                   presses "Transfer Received"
                                        │
                                        ▼
                                    RECEIVED  ── inventory_logs materialized on both branches
```

Terminal states: `CANCELLED`, `REJECTED`, `RECEIVED`. Inventory is impacted ONLY on `RECEIVED`, and only by `received_qty` (not `requested_qty` / `accepted_qty` / `adjusted_qty`).

### Cross-branch sync strategy

The server's `SyncController::pull()` currently filters every entity by `branch_id = $branchId`. For the two new tables we override that:

- **`batch_transfer_groups`**: pull where `source_branch_id = $branchId OR destination_branch_id = $branchId`, AND (status != 'draft' OR source_branch_id = $branchId). Drafts stay invisible to dest.
- **`batch_transfer_entries`**: pull where `batch_transfer_group_id IN (groups visible to $branchId)`.

Both branches push their own updates as normal (each device only writes fields it's allowed to mutate at the current status — enforced client-side; server is permissive). `device_id` echo-suppression still works because the originating-device check is symmetric.

### Inventory logs materialization (offline-safe)

When status flips to `RECEIVED`, two `inventory_logs` rows must exist per entry (per-branch isolation requires each branch's own row). But only the destination's device sets the status; it cannot write a row with `branch_id = source_branch_id`. Solution: **lazy materialization on each branch independently**.

- Dest's device (on press "Transfer Received"): writes `inventory_logs` for its own branch with `operation_id = stock_transfer_in`, `adjustment_qty = received_qty`, `batch_transfer_group_id = X`.
- Source's device: a post-sync hook `materializeReceivedTransferLogs()` scans pulled `batch_transfer_groups` where `status = 'received' AND source_branch_id = me AND no existing inventory_logs row WHERE batch_transfer_group_id = X AND operation_id = stock_transfer_out`. If missing, create them locally; they sync normally.
- The hook is idempotent — multiple devices on the same branch won't duplicate rows.

Side benefit: if source's app is offline for weeks, materialization happens whenever it eventually syncs.

### Notification badges

Use two timestamp columns on `batch_transfer_groups`: `last_viewed_by_source_at` and `last_viewed_by_dest_at`. A group is "unread" for the current branch if `updated_at > last_viewed_by_<role>_at`. Computed in a query; not stored as a flag.

- Home screen Batch Transfer button: badge = count of unread groups for current branch.
- Group detail screen: on mount, update the relevant `last_viewed_by_*_at = NOW` and bubble via mutation.

---

## Database Schema

### Client — additions to [`src/localDb/index.js`](src/localDb/index.js)

Add to `createTables()`:

```sql
CREATE TABLE IF NOT EXISTS batch_transfer_groups (
  id TEXT PRIMARY KEY NOT NULL,
  mode TEXT NOT NULL DEFAULT 'branch_to_branch',  -- 'log' | 'branch_to_branch'
  source_branch_id TEXT NOT NULL,
  destination_branch_id TEXT,                     -- NULL allowed for mode='log'
  status TEXT NOT NULL DEFAULT 'draft',           -- draft|requested|accepted|transferring|received|cancelled|rejected
  source_remarks VARCHAR(500),
  dest_remarks VARCHAR(500),
  initiator_account_uid VARCHAR,
  date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
  date_requested DATETIME,
  date_accepted DATETIME,
  date_transferring DATETIME,
  date_received DATETIME,
  date_cancelled DATETIME,
  date_rejected DATETIME,
  last_viewed_by_source_at DATETIME,
  last_viewed_by_dest_at DATETIME,
  device_id VARCHAR DEFAULT NULL,
  branch_id VARCHAR DEFAULT NULL,
  sync_id VARCHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  synced_at DATETIME DEFAULT NULL,
  is_deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS batch_transfer_entries (
  id TEXT PRIMARY KEY NOT NULL,
  batch_transfer_group_id TEXT NOT NULL,
  master_item_id TEXT,                             -- bridge across branches
  source_item_id TEXT,                             -- source branch's local item id
  dest_item_id TEXT,                               -- dest branch's local item id (resolved on dest side)
  item_display_name VARCHAR,
  item_display_sku VARCHAR,
  item_uom_abbrev VARCHAR,
  unit_cost_snapshot REAL,
  requested_qty REAL NOT NULL DEFAULT 0,
  accepted_qty REAL,                               -- NULL until dest reviews
  adjusted_qty REAL,                               -- NULL until source sees acceptance
  received_qty REAL,                               -- NULL until dest receives
  entry_status TEXT DEFAULT 'pending',             -- pending|accepted_full|accepted_partial|declined
  source_remarks VARCHAR(500),
  dest_remarks VARCHAR(500),
  device_id VARCHAR DEFAULT NULL,
  branch_id VARCHAR DEFAULT NULL,
  sync_id VARCHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  synced_at DATETIME DEFAULT NULL,
  is_deleted INTEGER DEFAULT 0,
  CONSTRAINT fk_btg FOREIGN KEY (batch_transfer_group_id) REFERENCES batch_transfer_groups(id)
);
```

Also via `alterTables()` (idempotent `ALTER TABLE … ADD COLUMN` guarded by `PRAGMA table_info`):
- Add `batch_transfer_group_id TEXT` to `inventory_logs` (links log rows back to the source transfer for drill-down).

Add to `createViews()`:
- `active_batch_transfer_groups` and `active_batch_transfer_entries` with the standard `WHERE IFNULL(is_deleted, 0) != 1` pattern.

Add to `DELTA_SYNC_TABLES`: `'batch_transfer_groups'`, `'batch_transfer_entries'`.

### Server — new migration in [fcms-api/src/database/migrations/](../fcms-api/src/database/migrations/)

`2026_XX_XX_create_batch_transfer_tables.php` — mirrors client schema; both tables get `(id uuid pk, sync_id string(36) unique, company_id fk, branch_id fk, device_id nullable, …, is_deleted, updated_at, created_at)`. Note: server's `branch_id` on `batch_transfer_groups` is set to `source_branch_id` for echo-suppression compatibility.

---

## Query Module — `src/localDbQueries/batchTransfer.js` (new)

Model after [src/localDbQueries/batchPurchase.js](src/localDbQueries/batchPurchase.js). Exported functions:

**Draft / authoring (source side)**
- `getOrCreateDraftBatchTransferGroup({destinationBranchId})` — single in-progress draft per destination branch (per Batch Purchase pattern but keyed by dest). Auto-creates a row in `batch_transfer_groups` with `status='draft'`.
- `createBatchTransferEntry({groupId, masterItemId, sourceItemId, qty, remarks})` — upsert pattern: if entry exists for this `(groupId, master_item_id)`, update; if qty=0, soft-delete; else insert. Denormalize `item_display_name/sku/uom` and `unit_cost_snapshot` from items table.
- `removeBatchTransferEntry({entryId})` — soft-delete.
- `submitBatchTransferRequest({groupId})` — flips status `draft` → `requested`, stamps `date_requested`, sets `requested_qty = current qty` for all entries.
- `cancelDraftBatchTransfer({groupId})` — soft-delete group + all entries.

**Dest-side review**
- `updateEntryDestReview({entryId, acceptedQty, destRemarks})` — mutate per-entry accepted_qty/remarks/entry_status while group status='requested'.
- `acceptBatchTransferRequest({groupId})` — flips `requested` → `accepted`, stamps `date_accepted`. Validates: at least one entry has `accepted_qty > 0`; otherwise prompt user to use Reject instead.
- `rejectBatchTransferRequest({groupId, reason})` — flips `requested` → `rejected`, stamps `date_rejected`, stores `dest_remarks=reason`.

**Source-side dispatch**
- `updateEntrySourceAdjustment({entryId, adjustedQty, sourceRemarks})` — mutate per-entry adjusted_qty/remarks while group status='accepted'. Default `adjusted_qty = accepted_qty` on first view.
- `confirmTransferOut({groupId})` — flips `accepted` → `transferring`, stamps `date_transferring`.
- `cancelBatchTransferRequest({groupId})` — allowed while status ∈ {requested, accepted}. Flips to `cancelled`, stamps `date_cancelled`.

**Dest-side receipt**
- `updateEntryReceivedQty({entryId, receivedQty})` — set per-entry received_qty (default = adjusted_qty).
- `confirmTransferReceived({groupId})` — flips `transferring` → `received`, stamps `date_received`. **Atomically**:
  1. For each entry with `received_qty > 0`: resolve dest's local item via `master_item_id`; auto-create item if missing (with `master_item_id` link + denormalized name/sku/uom).
  2. Write `inventory_logs` rows for dest's branch with `operation_id = OPERATION_DEFAULT_UUIDS.stock_transfer_in`, `adjustment_qty = received_qty`, `batch_transfer_group_id = X`, `item_id = dest_item_id`.
  3. Update entry `dest_item_id` so source's drill-down can reference it.

**Read queries**
- `getBatchTransferRequests({queryKey, pageParam})` — list view with `LEFT JOIN active_batch_transfer_entries` for entry counts and totals. Filterable: tab=All/Incoming/Outgoing/Drafts/Completed, status, search by counter-branch name.
- `getBatchTransferRequest({queryKey})` — single group with denormalized branch names.
- `getBatchTransferEntries({queryKey})` — entries for a group, with current stock at the current branch (for source, current stock; for dest, current stock at dest).
- `getBatchTransferUnreadCount({queryKey})` — count for Home badge.

**Post-sync hook (called by sync service after every pull)**
- `materializeReceivedTransferLogs()` — for each group where `status='received' AND source_branch_id = currentBranch`, ensure source's `inventory_logs` rows exist (idempotent). Resolve source's local item via `source_item_id` (already known) or `master_item_id`.

---

## Screens & Navigation

### New route constants — [src/constants/routes.js](src/constants/routes.js)

```js
batchTransferTypePicker: () => 'BatchTransferTypePicker',
batchTransferRequestList: () => 'BatchTransferRequestList',
batchTransferRequestForm: () => 'BatchTransferRequestForm',     // branch picker + Next
batchTransferItemSelection: () => 'BatchTransferItemSelection', // pick items + qty
batchTransferRequestDetail: () => 'BatchTransferRequestDetail', // unified detail view
batchTransferReceive: () => 'BatchTransferReceive',             // receive screen (status=transferring, current=dest)
```

### Screens (new files under [src/screens/](src/screens/))

1. **`BatchTransferTypePicker.js`** — two large cards.
   - "Branch to Branch Batch Transfer" → navigates to BatchTransferRequestList.
   - "Log Batch Transfer" → disabled, with `Badge: Coming Soon`.

2. **`BatchTransferRequestList.js`** — material-top-tabs: `Drafts | Incoming | Outgoing | History`. Each tab uses `useInfiniteQuery(['batchTransferRequests', {tab, filter}])`. Header right action: "+" → navigates to BatchTransferRequestForm.
   - List rows show: counter-branch name, status badge (color-coded), entry count, last activity, unread dot.

3. **`BatchTransferRequestForm.js`** — the Google-Maps-style picker.
   - Container with two stacked inputs:
     - Origin (red pin) — always current branch, read-only by default; swapped value when swap pressed.
     - Destination (blue pin) — tap → opens [src/components/branchPicker/BranchPickerSheet.js](src/components/branchPicker/BranchPickerSheet.js) (new), autocomplete fed by `getBranches()` from [src/serverDbQueries/v2/branches.js](src/serverDbQueries/v2/branches.js). Excludes current branch.
   - Right-side swap icon (vertical arrows) — toggles origin/destination → recomputes badge.
   - Badge below: `Batch Transfer Out` if origin=current; else `Batch Transfer In`.
   - Footer: "Next" button, enabled only when destination set.
   - On Next: call `getOrCreateDraftBatchTransferGroup({destinationBranchId, mode: 'out' | 'in'})` (mode='in' means origin is other branch — but server-side we still store `source_branch_id` correctly: source is whichever branch will physically dispatch). Navigate to BatchTransferItemSelection.

4. **`BatchTransferItemSelection.js`** — clone of [src/screens/PurchaseEntryList.js](src/screens/PurchaseEntryList.js).
   - Searchable, category-filtered infinite list of source-branch's items.
   - Tap a row → inline form modal for qty + per-item remarks (reuse [src/components/forms/BatchPurchaseAddStockForm.js](src/components/forms/BatchPurchaseAddStockForm.js) pattern, simplified to qty + remarks only).
   - Header right: "Review" → navigates to BatchTransferRequestDetail (in "draft preview" mode with Submit button).

5. **`BatchTransferRequestDetail.js`** — **the central screen**. Reused for every status; renders different action footer based on `(status, current_branch_role)`.

   Layout:
   ```
   ┌────────────────────────────────────────────────┐
   │ ← Batch Transfer                               │
   ├────────────────────────────────────────────────┤
   │ Status: [Accepted]    Unread dot (if any)      │
   │ Origin: Company A    Destination: Company B    │
   │ Request UUID: …                                │
   │ Initiated by: …    Date Requested: …           │
   ├────────────────────────────────────────────────┤
   │ Item 1  name, sku        5 kg     [···]        │
   │   • Remark from Company B: "Only need 2"       │
   │   • Remark from Company A: "Will adjust"       │
   │ Item 2  name, sku        2 pcs    [···]        │
   │   • Remark from Company B: "Don't send"        │
   ├────────────────────────────────────────────────┤
   │ Footer actions (status-dependent)              │
   └────────────────────────────────────────────────┘
   ```

   - Tapping `[···]` (per-row options) opens a sheet appropriate for the current role + status: edit qty, add remarks, mark "Don't send" (sets accepted_qty=0).
   - Footer matrix:
     | Status | Source actions | Dest actions |
     |---|---|---|
     | draft | Edit Items, Submit Request, Discard Draft | — |
     | requested | Cancel Request | Accept Transfer In Request, Reject |
     | accepted | Adjust & Transfer, Cancel Request | (read-only) |
     | transferring | (read-only) | Mark "Transfer Received" → BatchTransferReceive |
     | received | (read-only, link to inventory log) | (read-only) |
     | cancelled / rejected | (read-only) | (read-only) |

   - On mount, update `last_viewed_by_source_at` or `last_viewed_by_dest_at`.

6. **`BatchTransferReceive.js`** — when dest presses "Transfer Received" from the detail screen. Shows each entry with its `adjusted_qty` (default value for received_qty input). Dest can edit each received qty individually before confirming. "Confirm Received" calls `confirmTransferReceived`.

### Components (new under [src/components/](src/components/))

- **`src/components/branchPicker/BranchPickerSheet.js`** — modal bottom-sheet autocomplete; queries `useInfiniteQuery(['branches', {search}])` against `getBranches()`. Excludes current branch.
- **`src/components/batchTransfer/TransferStatusBadge.js`** — small color-coded badge per status.
- **`src/components/batchTransfer/TransferEntryRow.js`** — per-row component with remark stack and `[···]` options.
- **`src/components/batchTransfer/OriginDestinationCard.js`** — the dual-input + swap-icon component reused by Form and Detail screens.

### Stack registration — [src/stacks/RootStack.js](src/stacks/RootStack.js)

Register all six new screens (modal-style headers like ConfirmPurchases for the Form / ItemSelection / Detail / Receive screens; standard header for List and TypePicker).

### Home button — [src/screens/Home.js](src/screens/Home.js)

Insert a new `batchTransfer` pressable between `batchPurchase` (lines 174–199) and `endingInventory` in the buttons array around line 130, mirroring the badge pattern via `getBatchTransferUnreadCount`.

```js
batchTransfer: (
  <Pressable
    key={routes.batchTransferTypePicker()}
    onPress={() => navigation.navigate(routes.batchTransferTypePicker())}>
    {renderBatchTransferButtonBadge()}
    <MaterialCommunityIcons name="swap-horizontal-bold" size={37} />
    <Text numberOfLines={3} style={styles.buttonText}>Batch Transfer</Text>
  </Pressable>
)
```

---

## Sync Service Integration — [src/services/syncService.js](src/services/syncService.js)

Add to `GROUP_A_ENTITIES`:

```js
{key: 'batch_transfer_groups', table: 'batch_transfer_groups',
  pushFieldMap: {
    source_branch_id: 'source_branch_sync_id',          // if branches use sync_id; otherwise plain id
    destination_branch_id: 'destination_branch_sync_id',
  }},
{key: 'batch_transfer_entries', table: 'batch_transfer_entries',
  pushFieldMap: {
    batch_transfer_group_id: 'batch_transfer_group_sync_id',
    master_item_id: 'master_item_sync_id',
    source_item_id: 'source_item_sync_id',
    dest_item_id: 'dest_item_sync_id',
  }},
```

(Branch IDs: confirm whether server expects sync_id or row id; align with existing `getBranches` response shape.)

After `runSync()` finishes the pull phase, call `materializeReceivedTransferLogs()` once.

---

## Backend Changes (fcms-api)

### 1. Migration

[fcms-api/src/database/migrations/2026_XX_XX_create_batch_transfer_tables.php](../fcms-api/src/database/migrations/) — creates `batch_transfer_groups` and `batch_transfer_entries` with the column set above plus standard `company_id`, `branch_id` (= source_branch_id), `device_id`, `sync_id` unique.

### 2. Models

- [fcms-api/src/app/Models/Sync/BatchTransferGroup.php](../fcms-api/src/app/Models/Sync/BatchTransferGroup.php)
- [fcms-api/src/app/Models/Sync/BatchTransferEntry.php](../fcms-api/src/app/Models/Sync/BatchTransferEntry.php)

Model after [fcms-api/src/app/Models/Sync/BatchPurchaseGroup.php](../fcms-api/src/app/Models/Sync/BatchPurchaseGroup.php).

### 3. SyncController — [fcms-api/src/app/Http/Controllers/SyncController.php](../fcms-api/src/app/Http/Controllers/SyncController.php)

Add to `GROUP_A` (around line 73 next to batch_purchase entries):

```php
'batch_transfer_groups' => [BatchTransferGroup::class, [
  'source_branch_sync_id','destination_branch_sync_id','mode','status',
  'source_remarks','dest_remarks','initiator_account_uid',
  'date_requested','date_accepted','date_transferring','date_received',
  'date_cancelled','date_rejected',
  'last_viewed_by_source_at','last_viewed_by_dest_at',
  'is_deleted','updated_at','created_at',
]],
'batch_transfer_entries' => [BatchTransferEntry::class, [
  'batch_transfer_group_sync_id','master_item_sync_id',
  'source_item_sync_id','dest_item_sync_id',
  'item_display_name','item_display_sku','item_uom_abbrev','unit_cost_snapshot',
  'requested_qty','accepted_qty','adjusted_qty','received_qty',
  'entry_status','source_remarks','dest_remarks',
  'is_deleted','updated_at','created_at',
]],
```

Modify `pull()` filter logic (around line 441, after the `master_items` exception):

```php
} elseif ($entityKey === 'batch_transfer_groups') {
  $query->where(function ($q) use ($branchId) {
    $q->where('source_branch_id', $branchId)
      ->orWhere('destination_branch_id', $branchId);
  })->where(function ($q) use ($branchId) {
    // hide drafts from the non-source branch
    $q->where('status', '!=', 'draft')
      ->orWhere('source_branch_id', $branchId);
  });
} elseif ($entityKey === 'batch_transfer_entries') {
  $query->whereIn('batch_transfer_group_sync_id', function ($sub) use ($branchId) {
    $sub->select('sync_id')->from('batch_transfer_groups')
        ->where(function ($q) use ($branchId) {
          $q->where('source_branch_id', $branchId)
            ->orWhere('destination_branch_id', $branchId);
        });
  });
}
```

Modify `push()` validation (around line 154): for batch_transfer entities, allow push if the device's branch_id matches EITHER `source_branch_id` OR `destination_branch_id` of the target row. (Cross-branch writes are required because dest must update entries it didn't originate.)

### 4. Routes — [fcms-api/src/routes/api.php](../fcms-api/src/routes/api.php)

No new routes needed for v1; sync handles everything. (Branch listing endpoint already exists.)

---

## Permissions

New permission keys (added wherever the existing permission catalog lives — discover in [src/constants/](src/constants/) and corresponding server-side permission seeder):

- `transfer.create` — initiate a new request (draft + submit) and cancel.
- `transfer.review` — dest reviews entries, accepts or rejects.
- `transfer.transfer_out` — source presses "Transfer" (status accepted → transferring).
- `transfer.receive` — dest presses "Transfer Received".

Wire each action button visibility behind the permission check using the existing `usePermission` / role-check hook used by Batch Purchase. Root account bypasses all checks (existing behavior).

---

## File-by-File Change List

### Client — new files
- [src/screens/BatchTransferTypePicker.js](src/screens/BatchTransferTypePicker.js)
- [src/screens/BatchTransferRequestList.js](src/screens/BatchTransferRequestList.js)
- [src/screens/BatchTransferRequestForm.js](src/screens/BatchTransferRequestForm.js)
- [src/screens/BatchTransferItemSelection.js](src/screens/BatchTransferItemSelection.js)
- [src/screens/BatchTransferRequestDetail.js](src/screens/BatchTransferRequestDetail.js)
- [src/screens/BatchTransferReceive.js](src/screens/BatchTransferReceive.js)
- [src/components/batchTransfer/OriginDestinationCard.js](src/components/batchTransfer/OriginDestinationCard.js)
- [src/components/batchTransfer/TransferStatusBadge.js](src/components/batchTransfer/TransferStatusBadge.js)
- [src/components/batchTransfer/TransferEntryRow.js](src/components/batchTransfer/TransferEntryRow.js)
- [src/components/branchPicker/BranchPickerSheet.js](src/components/branchPicker/BranchPickerSheet.js)
- [src/localDbQueries/batchTransfer.js](src/localDbQueries/batchTransfer.js)

### Client — modified files
- [src/localDb/index.js](src/localDb/index.js) — schema, views, `DELTA_SYNC_TABLES`, `alterTables` for `inventory_logs.batch_transfer_group_id`.
- [src/services/syncService.js](src/services/syncService.js) — register entities; call `materializeReceivedTransferLogs()` after pull.
- [src/constants/routes.js](src/constants/routes.js) — six new route names.
- [src/stacks/RootStack.js](src/stacks/RootStack.js) — register six screens.
- [src/screens/Home.js](src/screens/Home.js) — insert Batch Transfer button between Batch Purchase and Ending Inventory; wire badge.
- [src/constants/permissions.js](src/constants/permissions.js) (or wherever permissions live — locate during implementation) — add four new keys.

### Server — new files
- `database/migrations/2026_XX_XX_create_batch_transfer_tables.php`
- `app/Models/Sync/BatchTransferGroup.php`
- `app/Models/Sync/BatchTransferEntry.php`

### Server — modified files
- [fcms-api/src/app/Http/Controllers/SyncController.php](../fcms-api/src/app/Http/Controllers/SyncController.php) — add to `GROUP_A`; modify `pull()` and `push()` for cross-branch visibility.
- Permissions seeder — add four new permission rows.

---

## Verification Plan

End-to-end smoke test with two devices (or two emulator branches of one company):

1. **Setup**: Two branches of the same company, both signed in on separate devices with sync working. Seed inventory on Branch A.
2. **Happy path** (Branch A → B):
   - On A, Home → Batch Transfer → Type Picker → Branch-to-Branch.
   - A creates a draft, picks 3 items with qty, submits → status = Requested. Verify B's app shows unread badge after sync.
   - On B, open request, mark item 1 as "don't send" (accepted_qty=0), reduce item 2 qty, accept → status = Accepted. Verify A's badge.
   - On A, adjust item 2 down further, press Transfer → status = Transferring. Verify B's badge.
   - On B, BatchTransferReceive: adjust item 3 received_qty (less than adjusted), confirm received → status = Received. Verify inventory logs:
     - On B: `inventory_logs` rows with `operation_id=stock_transfer_in`, `branch_id=B`, `batch_transfer_group_id=X`. Stock increased.
     - On A (after next sync): `inventory_logs` rows with `operation_id=stock_transfer_out`, `branch_id=A`. Stock decreased.
3. **Reject path**: Submit request, B rejects → status = Rejected, no inventory impact on either side.
4. **Cancel path**: Submit request, A cancels before B acts → status = Cancelled; verify B sees Cancelled.
5. **Cancel after accept**: A submits, B accepts, A cancels → status = Cancelled.
6. **Item not in dest branch**: source has "Special Chicken Variant"; dest doesn't. Verify dest sees denormalized display info; on Receive, item is auto-created at dest with `master_item_id` link.
7. **Offline-first**: airplane-mode B, A submits + status changes; reconnect B → status syncs in correct order.
8. **Idempotency**: Receive once, kill app mid-sync on source, reopen — materialization runs exactly once (no duplicate `inventory_logs`).
9. **Drill-down**: Item history on both branches shows the transfer with link back to the request.
10. **Lint + tests**: `npm run lint` and `npm test` clean.
11. **DB integrity**: Run app on a previously-installed user (with existing data) — `alterTables` adds `inventory_logs.batch_transfer_group_id` without data loss.

---

## Out of Scope for v1

- **Log Batch Transfer mode** — UI shows "Coming Soon"; tables support `mode='log'` already so v2 just needs the authoring screen.
- **Push notifications** — relies on the in-app badge from sync pull. Real OS push can come later.
- **Editing received qty after status=Received** — not allowed in v1 (requires audit-trail design).
- **Multi-currency / cost reconciliation between branches** — uses `unit_cost_snapshot` from source for valuation on both sides for v1.
- **Bulk transfer import (CSV)** — not in v1; uses the existing IDT template pattern in a future increment.
