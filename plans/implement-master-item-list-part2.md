# Master Item List — Implementation Plan

> **Status:** Part 1 (original Master Item List) shipped across Phases 1–3.
> **Active work:** Part 2 below — variant-lock redesign + pre-Register Item picker. Scroll to the **"Part 2"** heading near the end of this file.

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

---

# Part 2 — Variant Lock + Pre-Register Picker

## Context

The original Master Item List shipped with `items.name` (branch-side) and `master_items.description` (server-side) as **separate fields**. That was an intentional decision in Part 1 ("Branch `items.name` untouched — branches keep their own local naming") — but it defeats the very purpose of a centralized catalog: the same SKU can end up with different variants across branches.

Concrete example surfaced by the user:
- Master: `AKA-12345 / Alaska Milk Evap 500g Can`
- Branch A items row with sku `AKA-12345`: name = "Alaska Milk Evap **150g** Can"
- Branch B items row with sku `AKA-12345`: name = "Alaska Milk Evap **250g** Can"

For the future branch-to-branch batch-transfer feature this is broken — SKU is supposed to be the agreement that "this is the same product."

This part fixes the data model so the variant identity (name + SKU) lives on the master and **propagates** to every linked branch row, and introduces an explicit pre-Register picker so users consciously choose between "use an existing master" vs "create a new master."

User-confirmed decisions:
- **Variant lock**: hard lock. Once a branch item is linked to a master, `items.name` and `items.sku` are read-only at the branch and are kept in sync with the master via the existing root-only edit path.
- **Picker filter**: hide masters already linked to an item in the current branch (prevents duplicate `(branch_id, master_item_sync_id)` rows).
- **FAB routing**: all three current Register Item entry points (Items, Purchases, Sales Counter FABs) route through the picker.

## Architecture

Two changes at the data layer, three at the UI layer.

**Data layer:**
1. Server: `MasterItemController::update` already mirrors `sku` changes onto `items.sku`; extend it to also mirror `description` → `items.name` when description changes. Same join key (`(company_id, sku)`), same `updated_at` bump so the rename propagates to every device on next pull.
2. Client: `applyPulledRecord` already overwrites local rows on pull; no extra work needed for the propagation direction. The variant lock is an enforcement-at-edit-time rule in the UI/registration code.

**UI layer:**
1. New `SelectAddItemMode` screen — radio picker. Two options ("Add from Master Item List" / "Register new master"). Default selection: option 1 if local `active_master_items` has any rows usable in this branch; otherwise option 2.
2. New `SelectMasterItem` screen — searchable infinite list of local `active_master_items` filtered to those NOT yet linked to a row in this branch's `active_items`. Reads from local SQLite (works offline). Tap → navigates to `AddItem` with `route.params.masterItem`.
3. `AddItem` / `ItemForm` accept `masterItem` route param: pre-fill name + sku from the master, lock both fields, and pass the master reference to `registerItem` so it skips the master_items INSERT.

## Backend changes — `/Users/eleyjambaro/fcms-api`

### MasterItemController::update — mirror description to items.name

In `src/app/Http/Controllers/MasterItemController.php`, after the existing SKU mirror block (lines 140-147), add an analogous block for description:

```php
if (isset($changes['description'])) {
    // Mirror the new description onto every branch item in this company
    // joined by the master's SKU. Bumps items.updated_at so the rename
    // syncs back to all devices on next pull.
    Item::where('company_id', $account->company_id)
        ->where('sku', $changes['sku'] ?? $mi->sku)  // use new sku if it changed in same request
        ->update([
            'name'       => $changes['description'],
            'updated_at' => $changes['updated_at'],
        ]);
}
```

Note: must run **after** the SKU mirror block (so when both fields change in one request, the new SKU is already on the items rows and the description mirror uses the right join key). Same caveat about capturing `$oldSku` before `$mi->update()` applies — already handled.

### Optional defensive guard on the sync push handler (deferred)

We could also reject `items` push rows where the row has a `master_item_sync_id` and the supplied `name` differs from the master's `description`. Defer this — the UI lock is sufficient for now, and adding a server-side reject without UI feedback would cause silent push failures.

## Client changes — `/Users/eleyjambaro/fcms-rn-79`

### 1. New screen — `src/screens/SelectAddItemMode.js`

Full-screen radio picker with two options, modeled after the existing radio-card patterns in the codebase (e.g. the modifier kind selection).

- Option 1: **"Add Item from Company Master Item List"** — subtitle "Recommended if the product already exists in your company catalog."
- Option 2: **"Register new item to Company Master Item List"** — subtitle "Use this for products not yet in the catalog."
- Continue button (disabled until a selection is made).
- Default selection: query `SELECT COUNT(*) FROM active_master_items mi WHERE NOT EXISTS (SELECT 1 FROM active_items i WHERE i.master_item_sync_id = mi.sync_id)` on mount; if > 0, pre-select option 1, else option 2.
- Continue navigates to either `SelectMasterItem` or `AddItem` accordingly.

### 2. New screen — `src/screens/SelectMasterItem.js`

Match the existing list-then-form idiom from `src/modals/SelectRecipeIngredient.js`.

- Searchbar (300ms debounce) — filters by SKU or description, case-insensitive.
- FlatList of master items: `SKU + description` per row.
- Data source: **local** SQLite query against `active_master_items` filtered by `NOT EXISTS (SELECT 1 FROM active_items i WHERE i.master_item_sync_id = mi.sync_id)` so already-linked masters are hidden. Works offline.
- Empty state: "No new master items available. Use 'Register new item' instead, or sync to pull the latest catalog."
- Tap a row → `navigation.replace('AddItem', {masterItem: {sync_id, sku, description}})` (use `replace` so back doesn't return to this intermediate screen).

Add a query helper to `src/localDbQueries/masterItems.js` (new file):
- `getLocalMastersAvailableForBranch({pageParam, queryKey})` — returns active masters not yet in current branch's active_items, with the same `{data, pagination}` envelope shape as the cloud endpoint so the screen can reuse `useInfiniteQuery` patterns. Pagination is purely client-side here.

### 3. `src/screens/Items.js`, `src/screens/Purchases.js`, `src/screens/SalesCounterItems.js` — FAB routing

In all three files, change the FAB's onPress from `navigation.navigate(routes.addItem())` (or equivalent) to `navigation.navigate(routes.selectAddItemMode())`. Verify the change at:
- `src/screens/Items.js:35`
- `src/screens/Purchases.js:101`
- `src/screens/SalesCounterItems.js:37`

### 4. `src/modals/AddItem.js` — accept and forward masterItem param

Read `route.params.masterItem` and pass it through to `<ItemForm>`. Pass it to the `registerItem` mutation so it can skip the master INSERT path.

### 5. `src/components/forms/ItemForm.js` — variant lock + master pre-fill

Accept a new prop `masterItem` (optional). When present:
- `initialValues.name = masterItem.description` (and the field becomes read-only: `disabled` + `editable={false}` on the TextInput; HelperText: "From Master Item List — edit on the Master Item List screen").
- `initialValues.sku = masterItem.sku` (same read-only treatment, HelperText: "From Master Item List").
- Hide the existing SKU auto-generate helper text.

In **edit mode**, also apply the lock when the items row has a non-null `master_item_sync_id` — name + sku are read-only there too, regardless of role. (The Master Item List edit screen is the one and only way to change them, and that screen is already root-only.)

### 6. `src/localDbQueries/items.js` — registerItem `masterItem` branch

Extend `registerItem` (line 140+) to accept a `masterItem` reference. When provided:
- Skip the local `master_items` INSERT block (line ~464-482). The master row already exists locally because we read it from `active_master_items` in the picker.
- Set `items.master_item_sync_id = masterItem.sync_id`, `items.sku = masterItem.sku`, `items.name = masterItem.description`.

When `masterItem` is absent, keep current behavior (create the master + branch item, as Part 1 implemented).

### 7. Routes + stack registration

- `src/constants/routes.js`: add `selectAddItemMode: () => 'SelectAddItemMode'` and `selectMasterItem: () => 'SelectMasterItem'`.
- `src/stacks/RootStack.js`: register both new screens inside the same modal `Stack.Group` that holds `AddItem` and `MasterItemList`. Header titles: "Add Item" and "Select from Master Item List" respectively.

### 8. MasterItemList screen — invalidate items queries on master edit

When the root edits a master's description (`updateMasterItem` mutation in `src/screens/MasterItemList.js` line 82-96), after `invalidateQueries(['masterItems'])` also invalidate `['items']` so the renamed branch items appear correctly in the local Items list view after the next sync brings the mirrored items.name down.

## Edge cases

- **Two devices register against the same master concurrently** — both succeed (the dedup is per-branch, not per-master), each creates an items row in its own branch. Picker hides the master after registration on each branch independently.
- **Picker shows masters from branches the current user can't see** — that's fine; the master list is company-scoped by design. The point is to let any branch attach to any master.
- **User edits an already-locked items row** — the form input is `editable={false}`; even if someone bypasses via React DevTools, the server will accept it on push (no defensive guard yet — see deferred backend item). UI lock is sufficient for honest users; defensive backend guard can come later if needed.
- **Master gets soft-deleted while a branch still has an items row linked to it** — already blocked: `MasterItemController::destroy` returns 409 if any active items row still references the SKU.
- **Items.name backfill for pre-existing rows where master.description and items.name differ** — when root edits any master's description, the mirror fixes that master's linked rows. For untouched masters where descriptions already drifted before Part 2 shipped, root can resave the description (no-op edit) to trigger the mirror. Alternative: extend `masteritems:backfill` with a `--sync-descriptions` flag — defer unless drift turns out to be widespread in prod.
- **Picker's local-only data source** — new device that hasn't completed initial sync sees an empty picker. Acceptable: empty state nudges them to option 2, and after first sync the picker fills up.

## Phased rollout

**Phase 2A — Backend description mirror** (ships dark, safe to deploy first):
- `MasterItemController::update` — extend with description mirror block.
- Verify: edit a master's description on device A, sync, pull on device B → device B's `items.name` for the linked row matches the new description.

**Phase 2B — Picker + variant lock UI**:
- New screens: SelectAddItemMode, SelectMasterItem.
- New query helper: `src/localDbQueries/masterItems.js`.
- Route registration + FAB rewiring (3 callsites).
- ItemForm + AddItem masterItem param wiring + name/sku lock.
- registerItem masterItem branch.
- MasterItemList mutation invalidates `['items']`.

Both sub-phases are independent — 2A can ship without 2B and vice versa.

## Critical files

Backend:
- `/Users/eleyjambaro/fcms-api/src/app/Http/Controllers/MasterItemController.php` (lines 124-147) — add description mirror block after SKU mirror.

Client:
- `/Users/eleyjambaro/fcms-rn-79/src/screens/Items.js:35` — FAB target.
- `/Users/eleyjambaro/fcms-rn-79/src/screens/Purchases.js:101` — FAB target.
- `/Users/eleyjambaro/fcms-rn-79/src/screens/SalesCounterItems.js:37` — FAB target.
- `/Users/eleyjambaro/fcms-rn-79/src/modals/AddItem.js` — forward masterItem param.
- `/Users/eleyjambaro/fcms-rn-79/src/components/forms/ItemForm.js` (lines 54-124, 96+ initialValues, TextInput for name and sku) — accept masterItem prop, lock name + sku fields.
- `/Users/eleyjambaro/fcms-rn-79/src/localDbQueries/items.js` (registerItem, line 140+, master INSERT at ~464) — accept masterItem arg, skip master INSERT when present.
- `/Users/eleyjambaro/fcms-rn-79/src/constants/routes.js` — two new route names.
- `/Users/eleyjambaro/fcms-rn-79/src/stacks/RootStack.js` (modal Stack.Group, near AddItem registration) — register two new screens.
- `/Users/eleyjambaro/fcms-rn-79/src/screens/MasterItemList.js:82-96` (updateMutation) — also invalidate `['items']`.
- New: `src/screens/SelectAddItemMode.js`, `src/screens/SelectMasterItem.js`, `src/localDbQueries/masterItems.js`.

## Verification

After Phase 2A (description mirror):
- As root: edit a master's description on device A. Sync. On device B (any branch with an items row linked to that master via `master_item_sync_id`/`sku`), pull → device B's `items.name` reflects the new description.
- DB check: `SELECT name FROM items WHERE sku = '<SKU>' AND company_id = '<id>'` on the API DB shows the new name on every linked row.

After Phase 2B (picker + lock):
- Tap FAB on Items → SelectAddItemMode renders. Tap "Add from Master" → SelectMasterItem renders, lists only masters not already in this branch. Tap one → AddItem renders with name + SKU disabled, both pre-filled from the master. Submit → new items row exists with `master_item_sync_id` set; **no new master_items row** was created.
- Pick the same master from a different branch's device → that branch also gets an items row with the same master_item_sync_id, same name, same SKU. MasterItemList screen now shows both branches under that master.
- Try registering a "new" master with a name that produces the same prefix → the existing Part 1 SKU-collision regeneration on push still works; no regression.
- Edit an existing items row that has a `master_item_sync_id` → name + SKU fields are disabled in the form. Edit one without a master link → both fields editable (existing pre-Part-2 behavior, unchanged).
- Offline: airplane mode, tap FAB → picker still renders from local `active_master_items`. Pick a master, submit → row queued for push. Restore network → push succeeds, no duplicate master.
- Three FAB callsites checked: Items, Purchases, Sales Counter — all open SelectAddItemMode first.
