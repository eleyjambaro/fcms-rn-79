# Master Item dedup across branches on IDT import

## Context

Multiple branches in the same company frequently share a single populated **Inventory Data Template (IDT)** file (Excel) — the master catalog is typically identical across branches, so it's faster to import once and reuse.

Today, when Branch A imports the IDT, the client generates a fresh `master_item.sync_id` (UUID) and `sku` (random 4-char suffix) for every row. Branch B importing the **same file** generates *different* UUIDs/SKUs for the same logical items. On sync push, the server's identity check is `sync_id`-based (`updateOrCreate(['sync_id' => …])`), so Branch B's items become **new** `master_items` rows. The existing `(company_id, sku)` constraint catches identical SKUs only by reshuffling the suffix — it doesn't merge. Result: 5 branches importing the same IDT produce up to 5 duplicate `master_items` rows per product.

**Goal**: same logical item across branches → exactly one `master_items` row per company. New items still register normally; duplicates are silently merged with a count shown to the user. Existing duplicates on production get cleaned up by a one-time backfill.

---

## Approach

Introduce a **deterministic dedup key** on `master_items` derived from the normalized variant tuple. Enforce uniqueness at the DB level, check it on both client and server, and add a `sync_id_remaps` envelope to the push response (mirrors the existing `sku_updates`) so the client can repoint its local `items.master_item_sync_id` when the server merges a push into an existing master.

### Dedup key

A new column `dedup_key` (TEXT) on `master_items`. Value = lowercase, trimmed, pipe-joined tuple:

```
{name} | {uom_abbrev} | {uom_abbrev_per_piece} | {qty_per_piece} | {packaging_type} | {barcode}
```

- `name` is the source `items.name` (single canonical column needs to be added to `master_items` since today it only stores `description`). All branches importing the same IDT row produce the identical key.
- Empty/null per-piece/packaging/barcode become empty strings so they compare equal across rows that omit them.
- `qty_per_piece` normalized via `String(Number(v))` so `260.0000` and `260` collapse to `"260"`.

A shared helper computes the key on both sides:
- **Client**: [src/utils/generateMasterItemDedupKey.js](src/utils/generateMasterItemDedupKey.js) (new)
- **Server**: `App\Support\MasterItemDedupKey::build($attrs)` (new, in [src/app/Support/](../fcms-api/src/app/Support/))

The two implementations stay in lockstep — same normalization rules, tested with parity fixtures.

### Where dedup runs

**Client (pre-insert, best UX)** — in [src/localDbQueries/inventoryDataTemplate.js](src/localDbQueries/inventoryDataTemplate.js) `insertTemplateDataToDb()`:
- For each IDT row, compute `dedup_key`.
- Lookup `active_master_items` in this company for matching `dedup_key`.
- If found: reuse the existing master's `sync_id` and `sku` for `items.master_item_sync_id` / `items.sku`. **Skip** the master_items INSERT for this row.
- If not found: insert master_items as today, with the new `dedup_key` column populated.

**Server (push-time, race-safe)** — in [src/app/Http/Controllers/SyncController.php](../fcms-api/src/app/Http/Controllers/SyncController.php) `push()`:
- For each `master_items` record in the delta: before `updateOrCreate`, check for an existing row in the same company with the same `dedup_key` and a **different** `sync_id`.
- If found:
  - Skip the insert.
  - Append to a new `sync_id_remaps` response envelope: `{ from: pushed_sync_id, to: existing_sync_id, sku: existing_sku }`.
- The existing `resolveMasterItemSkuOnPush` SKU collision logic stays — it now only fires for genuinely-new masters with an accidentally-clashing SKU prefix.

**Client (post-push, apply remaps)** — in [src/services/syncService.js](src/services/syncService.js) `runSync()`:
- After reading `accepted` / `sku_updates`, also read `sync_id_remaps`.
- For each `{from, to, sku}`:
  - `UPDATE items SET master_item_sync_id = ?, sku = ? WHERE master_item_sync_id = ?` (`to`, `sku`, `from`).
  - **Hard-delete** the local orphan master row: `DELETE FROM master_items WHERE sync_id = ? AND synced_at IS NULL`. Safe because the server never accepted this row, so no other device knows about it. Soft-delete would incorrectly re-push as a delete and corrupt other branches' state.

### Schema changes (server)

New migration `2024_01_01_000020_add_dedup_key_to_master_items_table.php`:
- Add `name` VARCHAR(255) nullable (backfilled from earliest linked `items.name`).
- Add `dedup_key` TEXT nullable.
- Add UNIQUE INDEX `master_items_company_dedup_unique` on `(company_id, dedup_key)`.
- Idempotent guards via `Schema::hasColumn`.

Server's `SyncController::GROUP_A` allowedFields for `master_items` needs `name` and `dedup_key` added so they survive the `array_intersect_key` filter (sync rule #1 — schema parity).

### Client schema changes

In [src/localDb/index.js](src/localDb/index.js):
- `createTables()` for `master_items` gains `name TEXT` and `dedup_key TEXT` columns.
- `alterTables()` adds an idempotent migration: `ALTER TABLE master_items ADD COLUMN name TEXT` / `… ADD COLUMN dedup_key TEXT` (each wrapped in try/catch like existing alterTables entries, since SQLite has no IF NOT EXISTS for columns).
- `active_master_items` view is unaffected.

### Other paths that create master_items rows

Audit and update to populate the new columns and check for an existing master before inserting:

1. **IDT import** — [src/localDbQueries/inventoryDataTemplate.js](src/localDbQueries/inventoryDataTemplate.js) lines 1086–1334. Primary site for this fix.
2. **`registerItem` no-picker path** — [src/localDbQueries/items.js](src/localDbQueries/items.js) (grep for `master_items` INSERT). Single-item registration via the normal item form must also dedup, otherwise the same product registered manually on two branches creates two masters.
3. **`MasterItemController` REST endpoint** — [src/app/Http/Controllers/MasterItemController.php](../fcms-api/src/app/Http/Controllers/MasterItemController.php). Server-side direct CRUD also needs to compute and store `dedup_key`, and return a 409 if it would create a duplicate.

### Backfill (one-time)

New Artisan command `php artisan masteritems:dedup-merge` in [src/app/Console/Commands/](../fcms-api/src/app/Console/Commands/):
- For each company:
  - Group existing `master_items` rows by computed `dedup_key`.
  - For each group with >1 row: pick the oldest by `created_at` as canonical (`to`).
  - For each non-canonical row (`from`): `UPDATE items SET master_item_sync_id = to.sync_id, sku = to.sku WHERE master_item_sync_id = from.sync_id`.
  - Soft-delete the non-canonical master rows (`is_deleted = 1`, bump `updated_at`) so all client devices receive the deletion on next pull.
- Then populate `name` and `dedup_key` on the survivors.
- Dry-run flag (`--dry-run`) prints the plan without writing.
- Idempotent — safe to re-run.

After clients sync, the resolved duplicates disappear from Master Item List on every device.

---

## Files to change

| Side | Path | Change |
|---|---|---|
| Server | `src/database/migrations/2024_01_01_000020_add_dedup_key_to_master_items_table.php` | New — add `name`, `dedup_key`, unique index |
| Server | `src/app/Support/MasterItemDedupKey.php` | New — `build($attrs)` helper |
| Server | `src/app/Http/Controllers/SyncController.php` | Dedup check before `updateOrCreate` for `master_items`; emit `sync_id_remaps`; extend `allowedFields` |
| Server | `src/app/Http/Controllers/MasterItemController.php` | Compute/store `dedup_key` on create/update; 409 on collision |
| Server | `src/app/Models/Sync/MasterItem.php` | Add `name`, `dedup_key` to fillable |
| Server | `src/app/Console/Commands/MasterItemsDedupMerge.php` | New Artisan command (one-time backfill) |
| Client | `src/utils/generateMasterItemDedupKey.js` | New — parity helper |
| Client | `src/localDb/index.js` | `createTables` + `alterTables` for `name`, `dedup_key` columns |
| Client | `src/localDbQueries/inventoryDataTemplate.js` | Pre-insert dedup lookup; populate new columns; surface "X already in catalog" in result |
| Client | `src/localDbQueries/items.js` | `registerItem` path: same dedup lookup before master INSERT |
| Client | `src/services/syncService.js` | Handle `sync_id_remaps` from push response |
| Client | `src/components/forms/InventoryDataTemplateFileImportForm.js` or success modal | Show merged count alongside inserted count |

## Reused utilities

- `generateMasterItemDescription` ([src/utils/generateMasterItemDescription.js](src/utils/generateMasterItemDescription.js)) — keep; description still useful for display. Dedup key is independent so a future tweak to description doesn't fragment the catalog.
- `generateMasterItemSku` ([src/utils/generateMasterItemSku.js](src/utils/generateMasterItemSku.js)) — still called only on the "truly new master" branch.
- `resolveMasterItemSkuOnPush` (SyncController) — unchanged; runs only when no dedup_key match exists.
- `removeDuplicatesFromArray` + existing per-branch name check in [inventoryDataTemplate.js:946-976](src/localDbQueries/inventoryDataTemplate.js#L946-L976) — unchanged; still removes intra-file dupes and skips items already on *this* branch.

---

## Verification

1. **Unit / parity**
   - Run JS test: `generateMasterItemDedupKey({ name: ' Coke ', uom_abbrev: 'EA', qty_per_piece: 260, packaging_type: 'CAN', barcode: '' })` produces the same string as the PHP `MasterItemDedupKey::build()` for the same input.
   - Variations: trailing whitespace, casing, missing per-piece, decimal qty → identical keys on both sides.

2. **Cross-branch IDT import (end-to-end, manual)**
   - On Branch A device: import a 10-row IDT. Verify 10 new master_items, 10 new items.
   - Sync; on Branch B device: pull, then import the same IDT.
   - Expected: Branch B success modal shows `0 new master items registered, 10 already in catalog (linked)`; Branch B's `items` rows exist with `master_item_sync_id` pointing to Branch A's masters.
   - Push from B; on the server: `master_items` count for this company is still 10 (not 20).
   - Pull on Branch A: no new masters appear in Master Item List.

3. **Race-safe server check**
   - Two devices push the same fresh master (same dedup_key, different sync_ids) within the same second. Server processes both — one wins, the other gets a `sync_id_remaps` entry in its response. Confirmed by inspecting both responses.

4. **Existing-duplicates backfill**
   - On a staging DB with seeded duplicates: `php artisan masteritems:dedup-merge --dry-run` prints the merge plan.
   - Run without `--dry-run`. Verify: surviving rows have populated `name` and `dedup_key`; `items` rows formerly pointing to merged masters now point to the canonical sync_id; merged masters have `is_deleted = 1`.
   - On a client signed into that company, pull and verify Master Item List collapses to one entry per logical product.

5. **Sync invariants regression**
   - `active_master_items` view still uses `IFNULL(is_deleted, 0) != 1` (rule #3).
   - All deletes performed by the backfill use `UPDATE … SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP` (rule #4) so soft-deletes propagate to clients.
   - `SyncController::GROUP_A` allowedFields includes `name`, `dedup_key` — `applyPulledRecord` on the client doesn't drop them (rule #1).
