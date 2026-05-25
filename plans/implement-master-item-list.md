# Master Item List — Implementation Plan

## Context

FCMS is a multi-company / multi-branch POS where every company-branch pair has its own SQLite DB and its own `items` table. Branches in the same company today share **no** item catalog — there is no common identifier across branches.

A future feature ("branch-to-branch batch transfer") needs a stable identifier so Branch A and Branch B can agree on "this is the same SKU." This plan introduces a **Master Item List**: a company-wide, server-of-truth catalog. Each entry has a unique-per-company SKU, an auto-generated uppercased description, and audit fields. Branches keep their existing local item rows but stamp them with the SKU that links to the master entry.

Access: root accounts get full CRUD on the Master Item List screen; team members get read-only. The screen lives under the Cloud Account screen.

User-confirmed decisions:
- **Offline registration**: queue-and-push. SKU generated client-side; server may regenerate on collision and echo the corrected SKU back.
- **Cross-branch dedup**: each branch creates its own master entry. Root merges duplicates later (out of scope for MVP).
- **Description**: uppercase of `items.name`. Root can hand-edit.
- **SKU**: `<NameAbbrev>-<4char-suffix>` (e.g. `AKA-7K2P`). Server validates uniqueness; on conflict regenerates.

## Architecture

`master_items` rides on the existing delta-sync rails (added to `GROUP_A`) but is **company-scoped, not branch-scoped**. Two carve-outs in `SyncController`:
1. Push handler stamps `branch_id` for every entity — for `master_items` this means "registering branch," which is exactly what the audit field needs, so this is incidentally fine.
2. Pull handler currently filters by `branch_id` — needs special-case to filter by `company_id` for `master_items`.

The dedicated REST endpoint `GET /api/v2/master-items` serves the screen with branch-name joins (which the device-local DB can't compute, since each device only holds its own branch's items).

`items.sku` is added to both client and server `items` tables and joins to `master_items.sku`. `description` lives **only** on `master_items` — never denormalized to branch `items`.

## Backend changes — `/Users/eleyjambaro/fcms-api`

### 1. Migrations
New files in `src/database/migrations/` (use next timestamp). Mirror style of `2024_01_01_000008_create_sync_master_data_tables.php`.

- **`create_master_items_table`** — UUID PK; `sync_id` (UUID, unique); `company_id` FK; `branch_id` (the registering branch — populated by existing push stamping); `device_id`; `registered_by_account_id`; `sku` (varchar, indexed); `description` (text); `is_deleted` tinyint; `created_at`, `updated_at` timestamps. Unique index `(company_id, sku)` where `is_deleted = 0` (or just `(company_id, sku)` if MySQL version doesn't support partial — accept that soft-deleted rows hold their SKU).
- **`add_sku_to_items_table`** — adds nullable `sku VARCHAR(64)` to existing `items` table. Indexed `(company_id, sku)`.

### 2. Model
- `src/app/Models/MasterItem.php` — `HasUuids` trait, `$fillable` matches the columns above. Casts for `is_deleted`. Soft-delete-aware scopes.

### 3. SyncController carve-outs
Edit `src/app/Http/Controllers/SyncController.php`:
- **`GROUP_A` constant** (line 53): add `'master_items' => [MasterItem::class, ['sku', 'description', 'registered_by_account_id', 'is_deleted', 'updated_at', 'created_at']]`. Add `'sku'` to the `items` entry's `allowedFields` (line 63).
- **Push handler** (lines 161-208): add a per-row pre-write step **only for `master_items`** that checks `(company_id, sku)` uniqueness. If the SKU is already taken by a different `sync_id`, regenerate a fresh 4-char suffix (preserve the name prefix), persist with the new SKU, and append a corrected-record envelope to a new `sku_updates` array in the response. The client uses this to fix up its local `master_items.sku` AND `items.sku` (both rows share the same SKU). Reuse the existing `$conflicts` response shape pattern (line 158, 250-254).
- **Pull handler** (line ~258): when querying `master_items`, scope by `company_id` instead of `branch_id`. Keep the `device_id != self` filter so devices don't re-pull their own master entries (but respect the "initial pull omits device_id" rule documented in CLAUDE.md sync invariant #10).
- **Write-permission gate for master_items in push**: non-root accounts may **create** master items (item registration is universal) but may not **update** existing ones via sync. Inside the upsert branch, when `$existing` is found and `$entityKey === 'master_items'`, require `$account->is_root_account` — otherwise skip with a logged warning. Creation goes through as normal.

### 4. REST controller + routes
- `src/app/Http/Controllers/MasterItemController.php`:
  - `index(Request)` — paginated list scoped by company; eager-loads or LEFT-JOINs `items` to attach per-branch `{branch_id, name}` rows for each master item. Optional `q` query param for SKU/description search.
  - `update(Request, $id)` — root-only; updates `sku` and `description`. Validates `(company_id, sku)` uniqueness manually. Bumps `updated_at` so it propagates via the next pull.
  - `destroy($id)` — root-only soft-delete; **blocks with 409** if any `items` row in the company still references the SKU with `is_deleted = 0`.
- Routes in `src/routes/api.php`:
  ```php
  Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
      Route::get('master-items',         [MasterItemController::class, 'index']);
      Route::put('master-items/{id}',    [MasterItemController::class, 'update']);
      Route::delete('master-items/{id}', [MasterItemController::class, 'destroy']);
  });
  ```
  Root gating is inline (`if (! $account->is_root_account) return 403`) — simpler than introducing a new permission feature flag for one screen.

### 5. Backfill Artisan command (Phase 3)
- `php artisan masteritems:backfill` — for each company, scan `items WHERE is_deleted = 0 AND sku IS NULL`, generate a master item per row (no fuzzy-dedup; root cleans up after), assign SKU, stamp `items.sku`. Idempotent on re-run.

## Client changes — `/Users/eleyjambaro/fcms-rn-79`

### 1. Schema (`src/localDb/index.js`)
- In `createTables()`: add `master_items` table mirroring server columns (UUID PK `id`, `sync_id`, `sku`, `description`, `registered_by_account_id`, plus the standard `device_id`, `branch_id`, `updated_at`, `synced_at`, `is_deleted`). Plus a soft-delete view in `createViews()`: `active_master_items`.
- In `alterTables()`: add `sku VARCHAR` to `items` (idempotent `ALTER TABLE … ADD COLUMN` with try/catch swallow on "duplicate column").
- Add `'master_items'` to `DELTA_SYNC_TABLES` so the four sync columns get added.

### 2. SKU generator utility
- `src/utils/generateMasterItemSku.js`:
  ```js
  // pure: takes (name) -> 'AKA-7K2P' style
  // prefix = first 3 letters after stripping non-alpha, uppercased; pad with 'X'
  // suffix = 4-char draw from 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' (no 0/O/1/I)
  ```
- Add a brief Jest test in `__tests__/` covering: normal name, name with leading digits, short name, empty/whitespace name.

### 3. Sync service (`src/services/syncService.js`)
- Add `{key: 'master_items', table: 'master_items'}` to `GROUP_A_ENTITIES` (line 41). No `pushFieldMap` needed — master items have no `*_id` FKs to other sync entities.
- Where the push response is applied to local state, handle the new `sku_updates` envelope: for each entry, `UPDATE master_items SET sku=? WHERE sync_id=?` AND `UPDATE items SET sku=? WHERE sync_id IN (SELECT sync_id FROM items WHERE sku=<old>)` — actually simpler: store `master_item_sync_id` on local items so the join is on sync_id not SKU, then SKU updates only touch master_items. **Decision: yes, add `master_item_sync_id` to client `items` instead of `sku`** to decouple the join from the SKU string. Server-side keep `items.sku` for query convenience.

  **Revised**: client `items` table gets `sku VARCHAR` (denormalized for offline display) AND `master_item_sync_id VARCHAR(36)` (stable join key). On `sku_updates` ACK, update both `master_items.sku` and `items.sku` for matching `master_item_sync_id`. Server `items` table gets only `sku`.

### 4. Item registration (`src/localDbQueries/items.js`)
- Edit `registerItem` (line 122): after inserting into `items` (line ~340-388), also:
  1. Generate `sku = generateMasterItemSku(item.name)` if the form-supplied SKU is blank.
  2. Generate a fresh `sync_id` for the master_items row.
  3. INSERT into local `master_items` (`sync_id`, `sku`, `description = item.name.toUpperCase()`, `registered_by_account_id = currentAccountId`, `updated_at = CURRENT_TIMESTAMP`).
  4. UPDATE the just-inserted `items` row with `master_item_sync_id = <new master sync_id>` and `sku = <new sku>`.
  5. Existing `scheduleSyncSoon()` call (line 699) already triggers push.

### 5. Item form (`src/components/forms/ItemForm.js`)
- Add an optional `sku` text input near the top (above `name`). Yup schema: `sku: Yup.string().trim().max(64).matches(/^[A-Z0-9-]*$/i, 'Letters, digits, dashes only').nullable()`.
- Helper text: "Leave blank to auto-generate (e.g. AKA-7K2P)."

### 6. Server queries (`src/serverDbQueries/v2/masterItems.js`)
New file following `src/serverDbQueries/v2/accounts.js` pattern:
- `getMasterItems({pageParam = 1, q = ''})` — `GET /api/v2/master-items?page=…&q=…`. Returns `{data: [...], pagination: {...}}`.
- `updateMasterItem({id, sku, description})` — `PUT /api/v2/master-items/:id`.
- `deleteMasterItem({id})` — `DELETE /api/v2/master-items/:id`.

### 7. Master Item List screen
- `src/screens/MasterItemList.js` — Accordion list using `react-native-paper`'s `List.Accordion`. Each entry: SKU + description as the title; expanded body shows `branch_items: [{branch_id, name}]` from the server.
- Root-only affordances (gated by `useCurrentUser().authUser.is_root_account`):
  - Pencil icon → opens edit modal (Formik) for SKU + description.
  - Trash icon → confirms then calls `deleteMasterItem`.
- React Query: `useInfiniteQuery(['masterItems', q], getMasterItems)`. Invalidate on mutation success.

### 8. Account screen entry (`src/screens/CloudAccount.js`)
- Add a `Pressable` styled like the existing Logout button, with a `format-list-bulleted` icon and label "Master Item List". Navigates to `MasterItemList` route. Visible to everyone; the screen itself enforces read-only for non-root.
- Register route in the stack that owns CloudAccount (look in `src/stacks/` — likely `RootStack` or a sub-stack — and add `MasterItemList` screen).

## Edge cases addressed in the design

- **Concurrent SKU collisions across offline branches** → server-side regenerate + `sku_updates` echo back.
- **Root edits description** → propagates via normal sync pull. Branch `items.name` untouched (intentional — branches keep their own local naming).
- **Delete with live references** → server returns 409. UI shows count.
- **Pre-existing items before this ships** → `masteritems:backfill` Artisan command.
- **Sub-account writes** → SyncController carve-out: create allowed, update blocked.
- **NULL-safe view** on `active_master_items` follows CLAUDE.md sync invariant #3 (`IFNULL(is_deleted, 0) != 1`).
- **Schema parity** — every column on `GROUP_A.master_items.allowedFields` exists in both client `createTables()` and server migration before merging.

## Phased rollout

**Phase 1 — Schema + plumbing, no UI** (ships dark):
- Backend: migrations, `MasterItem` model, `GROUP_A` extension, `items.sku` column.
- Client: `createTables` for `master_items`, `alterTables` for `items.sku` and `items.master_item_sync_id`, `active_master_items` view, `GROUP_A_ENTITIES` update.
- Client: SKU generator utility + tests.
- Client: `registerItem` writes master entry + stamps `items.sku` + `master_item_sync_id`.
- Server: pull handler company-scope carve-out for `master_items`; push handler SKU-collision regenerate + `sku_updates` envelope.
- Client: sync service applies `sku_updates`.

**Phase 2 — Read-only screen**:
- Backend: `GET /api/v2/master-items` with branch-name join + pagination + search.
- Client: `MasterItemList.js` accordion screen, route registration, Account-screen entry.
- Client: optional `sku` input on `ItemForm.js`.

**Phase 3 — Root CRUD + backfill**:
- Backend: `PUT` and `DELETE` endpoints with root gate and 409-on-referenced.
- Client: edit modal + delete confirmation, root-only affordances.
- Backend: `masteritems:backfill` Artisan command. Run once per environment.

Phase 4 (deferred): duplicate merge UI.

## Critical files

Backend:
- `/Users/eleyjambaro/fcms-api/src/app/Http/Controllers/SyncController.php` (lines 53, 161-208, 258+) — GROUP_A entry, push collision carve-out, pull company-scope carve-out.
- `/Users/eleyjambaro/fcms-api/src/routes/api.php` — new master-items routes.
- `/Users/eleyjambaro/fcms-api/src/database/migrations/` — two new migrations.
- New: `src/app/Models/MasterItem.php`, `src/app/Http/Controllers/MasterItemController.php`, `src/app/Console/Commands/BackfillMasterItems.php`.

Client:
- `/Users/eleyjambaro/fcms-rn-79/src/localDb/index.js` — `createTables`, `alterTables`, `createViews`, `DELTA_SYNC_TABLES`.
- `/Users/eleyjambaro/fcms-rn-79/src/services/syncService.js` — `GROUP_A_ENTITIES`, push-response handler for `sku_updates`.
- `/Users/eleyjambaro/fcms-rn-79/src/localDbQueries/items.js` — extend `registerItem` (line 122+).
- `/Users/eleyjambaro/fcms-rn-79/src/components/forms/ItemForm.js` — optional SKU field.
- `/Users/eleyjambaro/fcms-rn-79/src/screens/CloudAccount.js` — entry pressable.
- New: `src/utils/generateMasterItemSku.js`, `src/serverDbQueries/v2/masterItems.js`, `src/screens/MasterItemList.js`.

## Verification

After Phase 1:
- `docker compose down && docker compose up -d --build` against `fcms-api`, then `docker compose exec app php artisan migrate`. Confirm both migrations apply cleanly.
- Sign in on a fresh device, register an item. Confirm in MySQL: `SELECT sku, description, branch_id FROM master_items WHERE company_id = …` returns the new row. Confirm `items.sku` is stamped.
- Tail RN dev logs while syncing to catch the `__DEV__` schema-parity throw in `applyPulledRecord` — if it fires for `master_items`, a column is missing on one side.
- Two devices, two different branches, both offline, register same-named item, reconnect sequentially. Confirm device 2's local `items.sku` AND `master_items.sku` update to the server-corrected SKU after sync.

After Phase 2:
- Open Cloud Account screen → tap "Master Item List". Read-only accordion renders. Expanding an entry shows the local item name from the registering branch.

After Phase 3:
- As root: edit description on device A, sync, pull on device B (sub-account), confirm new description visible but B's local `items.name` unchanged.
- As sub-account: hit `PUT /api/v2/master-items/<id>` directly → expect 403.
- As root: delete a master with a live referencing item → expect 409 with a count.
- Run `php artisan masteritems:backfill` against a DB with pre-existing items → master_items table populates, items.sku gets stamped. Re-run → no-op.
