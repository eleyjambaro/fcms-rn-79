# Plan: Batch Transfer **In** (inbound request)

## Context

The Batch Transfer feature ships with **Out** flow only: the current branch is always the source, drafts/requests/transfers go to a destination branch. The Form's swap button currently just shows a "Coming Soon" toast ([BatchTransferRequestForm.js:84-89](src/screens/BatchTransferRequestForm.js#L84-L89)).

We now want to enable the symmetric direction — **Batch Transfer In**: the current branch is the **destination** asking another branch (source) to send items. Per the user, "the only difference is I'm the one initiating; same UI."

The state machine, schema, sync invariants, inventory materialization, and screens are all already in place and bidirectionally-aware in structure (`isSource` / `isDest` already exist throughout). The change is therefore not "a parallel feature" but a **direction toggle** layered on the existing infrastructure, plus targeted fixes to places that assumed initiator = source.

UX decisions confirmed with the user:
- **Tab semantics: by inventory flow** — keep current Drafts/Incoming/Outgoing rules (source/dest). An In-request I initiated appears under **Incoming** (I am the destination), not Outgoing. Each row gets a small `In` / `Out` direction badge so the user can tell them apart at a glance.
- **Missing-item handling on source side**: if the source counterparty doesn't have the requested item locally (no `master_item_sync_id` match), they **cannot accept that line** — qty is locked to 0 with an "Item not in your catalog" hint. They can still accept other lines, or reject the whole request. **No auto-create on source side in v1** (symmetric to dest's auto-create on Receive is deferred).

---

## High-level design

### The one schema change: `initiator_branch_id`

Today, drafts are hidden from the counterpart branch via `source_branch_id = $branchId` in the server pull filter ([SyncController.php:465-468](../fcms-api/src/app/Http/Controllers/SyncController.php#L465-L468)). For an In-request the initiator is the *destination*, so that filter would either leak the draft to the source prematurely (if we relax) or hide it from the initiator (if we keep). We need to know **who created the request** independent of inventory roles.

Add one column to `batch_transfer_groups` (client + server):

| Column | Type | Meaning |
| --- | --- | --- |
| `initiator_branch_id` | UUID / FK branches | The branch whose user created the draft. Equals `source_branch_id` for Out, equals `destination_branch_id` for In. Never mutates after creation. |

This is the **only** schema change. Everything else builds on top of it.

### Direction is derived, not stored

There is no `direction` column. A request is **Out** for current branch when `initiator_branch_id == current AND source_branch_id == current`. It is **In** for current branch when `initiator_branch_id == current AND destination_branch_id == current`. From the counterparty's side, the labels invert (an In-request initiated by them is "someone asking me to send" — an outbound dispatch obligation for me).

The In/Out badge on every screen is derived from `(initiator_branch_id, current_branch_id, source/dest)` — no DB column needed.

### Role refactor: source/dest **and** initiator/counterparty

The existing Detail-screen footer matrix is keyed on `isSource` / `isDest`. Some actions truly belong to **physical role** (source dispatches, dest receives), some belong to **initiator role** (initiator drafts/submits/cancels, counterparty reviews/accepts/rejects).

| Action | Belongs to | Out-mode (initiator=source) | In-mode (initiator=dest) |
| --- | --- | --- | --- |
| Submit / Discard draft | initiator | source | dest |
| Cancel REQUESTED | initiator | source ✓ existing | dest — **new** |
| Accept / Reject REQUESTED | counterparty | dest ✓ existing | source — **new** |
| Adjust + Transfer (ACCEPTED → TRANSFERRING) | source (physical) | source ✓ existing | source ✓ same actor, just no longer the initiator |
| Cancel ACCEPTED | source OR initiator | source = both ✓ existing | source ✓ + dest (initiator) — **new** |
| Receive (TRANSFERRING → RECEIVED) | dest (physical) | dest ✓ existing | dest ✓ same actor |

Net change: we add helper flags `isInitiator = group.initiator_branch_id === currentBranchId` and `isCounterparty = !isInitiator`, and re-key three branches of the footer matrix on them.

### Item-picking on the In flow

The In-initiator (current = dest) picks from **their own** local items catalog (same `getItems` query the Out flow uses today on the source side). On the entry row:

- `master_item_id` = dest's item's `master_item_sync_id` (the cross-branch bridge — already used by Out).
- `dest_item_id` = dest's local `items.id` (known eagerly because dest is picking).
- `source_item_id` = NULL (source resolves it when they accept).
- `unit_cost_snapshot`, `item_display_name/sku/uom`, `item_category_name` = denormalized from dest's item.

Why this works: the existing Out flow already denormalizes display fields on the source side and resolves `dest_item_id` lazily via `master_item_id` at Receive time ([batchTransfer.js:551-562](src/localDbQueries/batchTransfer.js#L551-L562)). The In flow is the mirror image: `dest_item_id` is eager, `source_item_id` is lazy.

### Source-side `source_item_id` resolution (In flow)

When source (counterparty) reviews an In-request, the existing source-adjust path needs `source_item_id` to materialize `stock_transfer_out` logs at the end ([batchTransfer.js:758](src/localDbQueries/batchTransfer.js#L758) requires `source_item_id IS NOT NULL`).

Per user's "force-decline" decision, we **don't auto-create** at source. Instead:

1. On the Detail screen, when source views entries in REQUESTED status, run a one-shot pass per entry: if `source_item_id IS NULL AND master_item_id IS NOT NULL`, look up `active_items WHERE master_item_sync_id = master_item_id`. If found, write `source_item_id = found.id` on the entry. If not found, leave NULL.
2. The per-entry editor UI checks `source_item_id`. If NULL, the qty field is **locked to 0** with helper text "Item not in your catalog — can't fulfill". User can still type a remark.
3. `acceptBatchTransferRequest` validation already requires "at least one entry with accepted_qty > 0". No further validation needed — if all lines are unfulfillable, the user is nudged toward Reject (existing behavior).

This resolution happens on the source's device; `dest_item_id` stays as it was (resolved on the dest's device at Receive).

---

## File-by-file change list

### Client — schema + queries

**[src/localDb/index.js](src/localDb/index.js)** — `alterTables()`:
- Add `initiator_branch_id TEXT` to `batch_transfer_groups` (idempotent via `PRAGMA table_info` check, matching the existing pattern for other ALTER ADDs in this file).
- Backfill once: `UPDATE batch_transfer_groups SET initiator_branch_id = source_branch_id WHERE initiator_branch_id IS NULL`. Idempotent — only touches NULL rows.
- No view change needed (`active_batch_transfer_groups` is `SELECT *`).
- No change to `DELTA_SYNC_TABLES`.

**[src/localDbQueries/batchTransfer.js](src/localDbQueries/batchTransfer.js)**:

- `getOrCreateDraftBatchTransferGroup({direction, counterpartyBranchId, initiatorAccountUid?})`:
  - Rename param `destinationBranchId` → `counterpartyBranchId`; add required `direction` ('out' | 'in'); keep `destinationBranchId` accepted as a deprecated alias for backward compat with any caller we miss.
  - For 'out': `source_branch_id = current`, `destination_branch_id = counterparty`, `initiator_branch_id = current`.
  - For 'in': `source_branch_id = counterparty`, `destination_branch_id = current`, `initiator_branch_id = current`.
  - Draft uniqueness key becomes `(initiator_branch_id = current, source_branch_id, destination_branch_id, status='draft')` — naturally allows separate In- and Out- drafts to the same counterparty.
  - Always stamp `branch_id = current` (echo-suppression), `device_id = current`. (Unchanged; current branch always equals initiator for new drafts.)

- `createBatchTransferEntry({values})`: extend so callers can supply either a source-side item context (existing) or a **dest-side** item context for In-mode drafts:
  - Accept new optional fields: `destItemId`, `direction`. When `direction === 'in'`: set `dest_item_id = destItem.id`, leave `source_item_id` NULL. When 'out' (default): existing behavior.
  - `master_item_id` derivation, denormalized display fields, soft-delete-on-zero-qty — all unchanged.

- `getBatchTransferRequests` — Drafts tab filter changes to **`initiator_branch_id = current`** (was `source_branch_id = current`). Incoming/Outgoing/History/All remain on source/dest filters per user's "by inventory flow" choice. Also select `g.initiator_branch_id` in the projection so the list row can show the In/Out badge.

- `getBatchTransferRequest` — include `g.initiator_branch_id` in the projection (used by Detail screen).

- Add a new helper used by the Detail screen's source-side review pass:
  ```js
  export const resolveMissingSourceItemIdsForGroup = async ({groupId}) => { … }
  ```
  Iterates entries where `source_item_id IS NULL AND master_item_id IS NOT NULL`, joins `active_items` on `master_item_sync_id`, writes `source_item_id` back. Updates `updated_at` only on rows it changes. Idempotent. Returns affected count.

- **Direction-aware `last_viewed_by_*_at` writes** — gap discovered in existing code: several mutations hardcode the viewed-column based on Out-mode assumptions and must be made actor-aware:
  - `submitBatchTransferRequest` writes `last_viewed_by_source_at` ([line 283](src/localDbQueries/batchTransfer.js#L283)) — wrong for In (initiator is dest).
  - `acceptBatchTransferRequest` writes `last_viewed_by_dest_at` ([line 384](src/localDbQueries/batchTransfer.js#L384)) — wrong for In (counterparty/actor is source).
  - `rejectBatchTransferRequest` writes `last_viewed_by_dest_at` ([line ~399](src/localDbQueries/batchTransfer.js#L399)) — same issue.
  - `cancelBatchTransferRequest`, `cancelDraftBatchTransfer` — verify and fix if they hardcode either column.
  - `confirmTransferOut` (source physical action — always source, leave as-is) and `confirmTransferReceived` (dest physical action — always dest, leave as-is) need no change.
  - Fix pattern: introduce a tiny helper near the top of the module that takes `(db, groupId, currentBranchId)` and stamps the correct column based on whether the actor is source or dest. Replace the hardcoded `last_viewed_by_source_at` / `last_viewed_by_dest_at` literals in the affected mutations with a call to this helper.
- `confirmTransferReceived`, `materializeReceivedTransferLogs`, `confirmTransferOut`, `updateEntryReceivedQty`, `markBatchTransferViewed`, `getBatchTransferUnreadCount`, `removeBatchTransferEntry` — no changes needed (already direction-correct or direction-agnostic).
- `updateEntryDestReview` — keep the export name (avoid churn; many callers + grep history). Generalize internals: accept an optional `actorRole` param ('source' | 'dest', default 'dest' for backward compat). When 'source', write to `source_remarks` instead of `dest_remarks`. `accepted_qty` and `entry_status` writes are unchanged (they're inventory-flow values, not actor-perspective). Caller in the Detail screen derives `actorRole` from `currentBranchId === group.source_branch_id`.
- `updateEntrySourceAdjustment` — physical-source action only, unchanged.

### Client — Form (the swap button)

**[src/screens/BatchTransferRequestForm.js](src/screens/BatchTransferRequestForm.js)**:

- Replace the `destination` state with a single `counterparty` state plus a `direction` state (`'out'` | `'in'`, default `'out'`).
- `handleSwap` flips `direction`; the counterparty value persists across the swap (i.e., if I picked Branch A as destination in Out, after swap A becomes origin in In).
- Render the two pin inputs from `direction`:
  - 'out': top input = current (Origin), bottom input = counterparty (Destination, tappable).
  - 'in': top input = counterparty (Origin, tappable), bottom input = current (Destination).
- Direction badge label: `'Batch Transfer Out'` (red) for out, `'Batch Transfer In'` (blue/indigo) for in. Use the existing `colors.primary`/`#1E88E5` accent for In to match the destination pin color.
- Swap icon: drop the disabled style; render in `colors.text` (active).
- `BranchPickerSheet` modal — `excludeBranchId={currentBranchId}` already excludes self (works in both directions). Sheet title becomes "Select destination branch" or "Select source branch" depending on `direction`.
- `handleNext`: pass `{direction, counterpartyBranchId: counterparty.id}` to `getOrCreateDraftBatchTransferGroup`.
- `navigation.replace(routes.batchTransferItemSelection(), {groupId, counterpartyBranchId, direction})` — pass direction forward so ItemSelection knows whose catalog to render and whose item field to write.
- Helper text: directional ("…the source branch will review your request and confirm before any stock changes" stays accurate for both Out and In if we phrase it as **counterparty** reviewing).

### Client — Item Selection

**[src/screens/BatchTransferItemSelection.js](src/screens/BatchTransferItemSelection.js)**:

- Accept `direction` from route params (default 'out').
- Both directions render **current branch's local items** — for Out the source picks; for In the destination picks their own catalog. `getItems` is the same; nothing changes about the item list.
- When opening the per-item qty form, pass `direction` to `createBatchTransferEntry` so the mutation writes `source_item_id` (Out) or `dest_item_id` (In). The denormalized fields (name/sku/uom/cost/category_name) are always pulled from the same picked item — no branch difference.
- "Review" button navigates to `BatchTransferRequestDetail` (unchanged).

### Client — Detail screen

**[src/screens/BatchTransferRequestDetail.js](src/screens/BatchTransferRequestDetail.js)** is where most of the role refactor lives.

- After loading `group`, compute `isInitiator = group.initiator_branch_id === currentBranchId`, `isCounterparty = !isInitiator`. (Keep `isSource` / `isDest` — both are needed.)
- On mount, when `status === REQUESTED && isSource && isCounterparty` (i.e., we are the source counterparty reviewing an In-request), call the new `resolveMissingSourceItemIdsForGroup({groupId})` once, then invalidate the entries query.
- Footer matrix (only the three changed cells; the rest stays):

  | Status | Existing | After |
  | --- | --- | --- |
  | DRAFT + isSource | Edit / Discard / Submit | **`isInitiator`** instead of `isSource` (drafts only exist for the initiator anyway, so this is a tightening, not a behavior change) |
  | REQUESTED + isSource | Cancel Request | `isInitiator` → Cancel Request. `isCounterparty` (source side of an In-request) → Accept + Reject (the buttons currently shown to dest, with adapted labels). |
  | REQUESTED + isDest | Accept + Reject | `isInitiator` (dest side of own In-request — impossible by structure; dest can't be initiator unless In) → Cancel Request. `isCounterparty` → Accept + Reject (existing). |
  | ACCEPTED + isSource | Cancel + Transfer | Keep, but add `OR isInitiator` to the Cancel button visibility so the In-initiator (dest) can also cancel. Transfer stays source-only (physical role). |

  To avoid a tangle of `&&` conditions, re-organize the function as:
  ```
  if (DRAFT && isInitiator) { … }
  else if (REQUESTED && isCounterparty) { Accept + Reject }
  else if (REQUESTED && isInitiator) { Cancel }
  else if (ACCEPTED) {
     if (isSource) push Transfer
     if (isSource || isInitiator) push Cancel
  }
  else if (TRANSFERRING && isDest) { Receive }
  ```

- Button labels — keep generic to work in both directions:
  - "Accept Transfer In Request" → **"Accept Request"** (the orange note card above already provides directional context).
  - "Transfer" stays.
  - "Cancel Request" / "Cancel" stays.
  - "Mark Transfer Received" stays.

- Status-contextual note cards ([BatchTransferRequestDetail.js:554-600](src/screens/BatchTransferRequestDetail.js#L554-L600)) — rewrite the body strings to be initiator-aware. Pattern: instead of asking `isDest`, ask `isInitiator`. Example for REQUESTED:
  - `isCounterparty`: "`<initiator branch>` has sent you a Batch Transfer Request. Review the items below and tap Accept to proceed or Reject to decline."
  - `isInitiator`: "Your Batch Transfer Request has been sent to `<counterparty branch>`. You'll be notified once they accept or reject it."
  (Same template applies for ACCEPTED and TRANSFERRING cards.)

- Per-entry editor dialog ([BatchTransferRequestDetail.js:293-329](src/screens/BatchTransferRequestDetail.js#L293-L329)):
  - The existing `REQUESTED && isDest` branch (dest reviewing entries on an outbound) becomes **`REQUESTED && isCounterparty`** so source can review In-request entries with the same UI.
  - Lock the qty input to 0 with helper text "Item not in your catalog — can't fulfill this line. You can still leave a remark." when **EITHER** of:
    - `isSource && isCounterparty && entry.source_item_id IS NULL` (resolveMissingSourceItemIdsForGroup couldn't find a match).
    - `isSource && isCounterparty && entry.master_item_id IS NULL` (no bridge at all — initiator picked a local-only item that was never assigned a master_item_sync_id; source can never resolve it).
  - The Save button stays enabled — writing accepted_qty=0 is a valid review outcome.
  - The mutation called is the generalized `updateEntryDestReview` (now actor-aware per the query-module section above). The Detail screen passes `actorRole = isSource ? 'source' : 'dest'`.

- **Direction (In/Out) badge in the Detail screen header area** — add the same small chip used in the list rows, placed near the top of the screen (e.g., next to or just below the status badge already rendered around the existing header rows). Reuses the same derivation: `'Out'` when `source_branch_id === current`, `'In'` when `destination_branch_id === current`. Color matches the list-row chip.

### Client — List row direction badge

**[src/screens/BatchTransferRequestList.js](src/screens/BatchTransferRequestList.js)** — the row component already shows `directionPrefix = perspective === 'out' ? 'To:' : 'From:'`. Add a small chip before the prefix:
- `'Out'` chip (red) when the row is an outbound transfer relative to current branch (`source_branch_id === current`).
- `'In'` chip (blue) when inbound (`destination_branch_id === current`).
- Use the existing badge token; place at the top-right of the row to leave the existing layout intact.

No change to the tab filter logic (per user choice).

### Client — sync service

**[src/services/syncService.js](src/services/syncService.js)** — add `initiator_branch_id` to the `pushFieldMap` for `batch_transfer_groups`. If branch IDs are pushed as `*_sync_id` (per the existing `source_branch_sync_id` / `destination_branch_sync_id` pattern), add `initiator_branch_sync_id`. Otherwise add the plain field. Verify against the existing mapping shape during implementation.

### Server — fcms-api

**[fcms-api/src/database/migrations/](../fcms-api/src/database/migrations/)** — new migration `2024_01_01_000026_alter_batch_transfer_groups_add_initiator_branch_id.php` (next sequence after 000025):
- `ALTER TABLE batch_transfer_groups ADD COLUMN initiator_branch_id UUID NULL` with FK to `branches.id`.
- Backfill: `UPDATE batch_transfer_groups SET initiator_branch_id = source_branch_id WHERE initiator_branch_id IS NULL`.
- Index `['initiator_branch_id', 'status']` (mirrors the existing source/dest indexes).

**[fcms-api/src/app/Models/Sync/BatchTransferGroup.php](../fcms-api/src/app/Models/Sync/BatchTransferGroup.php)** — add `initiator_branch_id` to `$fillable`.

**[fcms-api/src/app/Http/Controllers/SyncController.php](../fcms-api/src/app/Http/Controllers/SyncController.php)**:
- `GROUP_A` `batch_transfer_groups` allowedFields: add `initiator_branch_sync_id` (or `initiator_branch_id` if branches push as plain IDs — match the existing source/dest pattern in the same array around [line 84-85](../fcms-api/src/app/Http/Controllers/SyncController.php#L84-L85)).
- `pull()` filter — change the draft sub-clause from `source_branch_id = $branchId` to `initiator_branch_id = $branchId`:
  ```php
  ->where(function ($q) use ($branchId) {
      $q->where('status', '!=', 'draft')
        ->orWhere('initiator_branch_id', $branchId);
  });
  ```
  Same file, lines [465-468](../fcms-api/src/app/Http/Controllers/SyncController.php#L465-L468). The outer source-OR-dest filter is unchanged.
- `push()` validation is already permissive enough (both branches can write); no change.

No new API routes — sync handles everything.

### Deploy ordering

Server migration + SyncController update must ship **before** the new client builds reach users. Reason: a v_new client that pushes `initiator_branch_id` to a v_old server hits an "unknown column" rejection. A v_old client talking to a v_new server is fine — the server backfills existing rows on migrate, the column is nullable, and old clients never read or write it. Standard sync-feature deploy order; matches how `item_category_name` was added in migration 000025.

---

## Verification plan

Two devices, two branches of the same company, fresh signed-in state on both. Seed inventory on **Branch A**. (Branch A has Flour, Sugar in its local catalog; Branch B has Sugar, Salt — overlap by `master_item_sync_id` is Sugar.)

### A. Schema + migration safety
1. Existing user (DB has rows pre-change): launch app, watch `setActiveCompanyDb` run `alterTables`. Confirm `initiator_branch_id` column added and back-filled to `source_branch_id` value on all existing rows. No data loss. `npm run lint`, `npm test` clean.
2. Server: `php artisan migrate` adds the new migration; existing rows back-filled identically.

### B. Out flow regression
3. On Branch A: Home → Batch Transfer → submit a normal outbound to B. Confirm Drafts/Outgoing/Incoming tabs, badges, and full happy path still work (no behavior change for existing user flows).

### C. In flow happy path
4. On Branch B: Home → Batch Transfer → New Request. Verify swap button is enabled. Default direction = Out. Tap swap → direction badge flips to **Batch Transfer In** (blue). Top input becomes tappable (Origin), bottom input shows "Current branch (B)".
5. Tap Origin → pick Branch A in the sheet. Press Next → ItemSelection opens with **B's** local items. Pick Sugar qty 5 + remark "low stock here". Press Review.
6. Detail screen shows direction badge "In", status DRAFT, footer = Edit / Discard / Submit. Press Submit. Status → REQUESTED.
7. On Branch A: pull sync. Open Batch Transfer list — the row appears under **Outgoing** tab (per user's "by inventory flow" choice; A is the source). Row has the "Out" chip and "To: Branch B" prefix.
8. Open the request. Footer shows Accept + Reject (because A is the counterparty here, not the initiator). The orange REQUESTED note card reads "Branch B has sent you a Batch Transfer Request…". Open the Sugar entry — qty editable, no lock (A has Sugar locally).
9. Tap Accept → status ACCEPTED. Source sees Transfer + Cancel; dest (B, also initiator) sees only Cancel.
10. On A, tap Transfer → status TRANSFERRING. On B, the row's status updates after sync. Footer on B (dest) shows "Mark Transfer Received".
11. Tap Mark Transfer Received on B → BatchTransferReceive screen → confirm. Status RECEIVED.
12. Inventory logs verification:
    - On B: `inventory_logs` with `operation_id = stock_transfer_in`, qty 5, item_id = B's Sugar. Sugar stock increased.
    - On A (after next sync, via `materializeReceivedTransferLogs`): `inventory_logs` with `operation_id = stock_transfer_out`, qty 5, item_id = A's Sugar. Sugar stock decreased.

### D. Missing-item path (force-decline)
13. On B: New In-request → pick Salt (B has Salt; A does not). Submit.
14. On A: open the request, open the Salt entry. Confirm qty is locked to 0 with helper text "Item not in your catalog — can't fulfill this line." Save with that line at 0 + a remark. Sugar line stays acceptable in another test, but for this case all lines are 0 — Accept button (or backend validation) prompts to use Reject instead, OR accepting with all-zero is blocked (matches existing `acceptBatchTransferRequest` validation around [batchTransfer.js:362-372](src/localDbQueries/batchTransfer.js#L362-L372)).
15. Tap Reject → status REJECTED. No inventory impact. Verify B's list shows it in History.

### E. Cancel paths
16. Initiator cancel from REQUESTED: B submits In-request, then B cancels before A acts → CANCELLED. A sees Cancelled after sync.
17. Initiator cancel from ACCEPTED: B submits, A accepts, then B cancels → CANCELLED. A sees Cancelled.
18. Source cancel from ACCEPTED on an In-request: B submits, A accepts, A cancels → CANCELLED. B sees Cancelled.

### F. Draft visibility
19. B starts an In-request (status DRAFT) and pauses. Force-sync on A. Confirm A does NOT see the draft. Confirm B's Drafts tab does show it. Submit → A sees it after next sync.

### G. Offline-first / idempotency
20. Airplane-mode A. On B: full In flow → RECEIVED. Reconnect A. After sync, `materializeReceivedTransferLogs` writes A's `stock_transfer_out` row exactly once even after multiple sync cycles.

### H. Lint + tests
21. `npm run lint` clean. `npm test` clean. No new failures on `fcms-api` side either (`./vendor/bin/phpunit` if there's a test for SyncController; otherwise manual smoke).

---

## Out of scope (deferred)

- **Source-side auto-create** when the requested item doesn't exist locally — user's force-decline choice. Revisit in v2 with an audit-trail-friendly design.
- **Direction-aware filter chips** in the list (e.g., "show only In requests") — the per-row badge is enough for v1.
- **Different permission keys for In vs Out** — current keys (`transfer.create`, `.review`, `.transfer_out`, `.receive`) map cleanly to actions regardless of direction. No permission changes.
- **Log Batch Transfer mode** — still v2 per the original plan.
