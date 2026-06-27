# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FCMS (Food Cost Management System) is a React Native POS/inventory management app for food service businesses. It supports offline-first operation via local SQLite, cloud sync, multi-company/multi-branch setups, and thermal receipt printing.

## Commands

```bash
# Development
npm start                  # Start Metro bundler
npm run android            # Build and run on Android
npm run ios                # Build and run on iOS
npm run android:clean      # Clean Android build artifacts

# iOS setup (after npm install)
bundle install && bundle exec pod install

# Validation
npm run lint               # ESLint
npm test                   # Jest (run all tests)

# Environment
npm run sync-ip            # Sync local IP to .env (for cloud API dev)

# Dependency management
npm run check-dependencies # Check dependency alignment
npm run fix-dependencies   # Auto-fix dependency alignment
```

## Environment

Copy `.env.example` to `.env` and set `CLOUD_API_V2_BASE_URL` to your local server IP. Use `npm run sync-ip` to auto-populate it.

## Architecture

### Authentication System

**Cloud Auth is the primary and only supported auth mode.** Local Auth (`AuthStack`) is legacy and deprecated — do not build new features against it.

- **Cloud Auth** (`CloudAuthStackV2`): Email/password or OTP sign-in → device registration → branch selection. Tokens stored in `react-native-fast-secure-storage` under keys in `/src/constants/rnSecureStorageKeys.js`. State managed by `CloudAuthContextProvider`.
  - Sub-accounts (team members) sign in via `CloudV2SubAccountSignIn` and require a `device_id` tied to their account via `DeviceAccountAssignment` on the server.
  - `App.js` gates on `isCloudAuthenticated && hasDevice && hasBranch` — all three must be true to show `RootStack`.
- **Local Auth** (`AuthStack`): **Deprecated.** Do not add new features here.

### Executive accounts & branch-scoped team management

An **executive account** (`is_executive_account`) is a trusted co-owner — like root except it
can't manage other executives or delete the company. Team-member management lives on the
`LocalUserAccounts` screen (`/src/screens/LocalUserAccounts.js`, `/src/components/accounts/LocalUserAccountList.js`,
`/src/components/forms/LocalUserAccountForm.js`, branch picker `ManageSubAccountBranchesModal.js`).
**The cloud API is the authoritative guard** (see `../fcms-api/CLAUDE.md` → "Executive accounts &
branch-scoped team management"); the app mirrors it for UX and must treat a 403 as final.

- **Branch access scoping.** An executive's branches = exactly their `branch_account_assignments`
  (synced via `syncCloudBranchAccountAssignments`); zero = none (only root sees all branches). A
  branch they create auto-assigns to them. **Only root** may edit an executive's branch access.
- **Team-member management is branch-scoped for executives.** An executive may **Edit, Edit
  Access, and Delete** a member **only if that member shares a branch with the executive's
  assignments**. Members outside those branches are **read-only** to the executive — list them but
  hide/disable the edit/access/delete options (the API returns 403 anyway).
- **Team-member filter dropdown** on `LocalUserAccounts`: options `All members | Branch A | Branch B | …`.

  | Viewer | Default | Dropdown options | Out-of-scope rows |
  | --- | --- | --- | --- |
  | **Root** | `All members` | `All members` + every branch | full control |
  | **Executive** | **current branch** | `All members` + their assigned branches | shown **read-only** |
  | **Ordinary member** | **current branch** | current branch + their other assigned branches — **no `All members`** | **never shown** (no cross-branch visibility) |

  "Current branch" = `getActiveBranchId()`. The dropdown drives the `branch_id` sent to the server
  account-list query; the server returns only the permitted set (ordinary members get a hard
  restricted list; executives get cross-branch rows flagged read-only). Don't rely on client-side
  filtering for ordinary members — request the scoped list from the API.

### Multi-Company / Multi-Branch Data Isolation

**Each company+branch pair gets its own SQLite database file.** This is enforced at the `getDBConnection()` level in `/src/localDb/index.js` — no query-level filtering is needed or used.

- DB filename: `FCMS_<companyId>_<branchId>` when both are known (normal operating state). Falls back to `FCMS_<companyId>` when only the company is known (e.g. during device registration before a branch is assigned), and to `FCMS.db` in the unauthenticated state where no company data is accessed.
- `setActiveCompanyDb(companyId, branchId)` in `/src/localDb/index.js` sets the active company and branch, creates tables (`createTables()`), runs migrations (`alterTables()`), and creates SQL views (`createViews()`). It is **async** and must be `await`ed. When both IDs are provided it also runs `migrateCompanyDbToBranchScopedDb` — a one-time file rename that promotes any legacy `FCMS_<companyId>` file to `FCMS_<companyId>_<branchId>` so existing users keep their data after the branch-scoped naming change.
- `getActiveCompanyId()` and `getActiveBranchId()` return the currently active IDs — used by company+branch-scoped AsyncStorage keys (e.g. units).
- `CloudAuthContextProvider` calls `setActiveCompanyDb` at every auth transition (restore, sign-in, sign-up, OTP verify, **and branch selection**) **before** dispatching state, so `isLoading` stays `true` until the DB is ready. It also seeds defaults (`setDefaultUnits`, `createDefaultSettings`) at the same point.
- On sign-out or user switch, `queryClient.clear()` is called to purge React Query's cache so no prior user's data is visible to the next user.

### Dual Database System

- **Company DB** (`FCMS_<companyId>_<branchId>`): Items, recipes, purchases, expenses, revenues, settings, units, etc. Queried via `/src/localDbQueries/`. **Company+branch-scoped — one file per company/branch combination.**
- **Account DB** (`FCMSLocalAccount.db`): Legacy local auth data (accounts, roles, companies). Used only by the deprecated local auth system. Do not add new tables here.
- Direct SQL queries use a promise-based wrapper in `/src/localDb/`.
- Query builders in `/src/utils/localDbHelpers.js` support `%IN`, `%LIKE` filter operators and `createQueryFilter()`.

#### Company+branch-scoped AsyncStorage

Units are stored in AsyncStorage under a company+branch-scoped key (`units_<companyId>_<branchId>`), managed by `/src/localData/units.js`. `getActiveCompanyId()` and `getActiveBranchId()` are used to derive the key. Never use a bare hardcoded key for per-company or per-branch data.

### Delta Sync (Cloud Sync)

All Company DB tables participate in delta sync **except**: `app_versions`, `operations`, and `sync_metadata`. Account DB tables are never synced.

`settings` and `saved_printers` **do** sync (so user config and saved/default printers survive an uninstall — `device_id` is stable across reinstall, so the normal branch pull restores them). Two non-obvious rules apply to them:

- **`settings` is branch-shared.** `settings.id` is `TEXT` (= `sync_id`, since `applyPulledRecord` inserts `id = sync_id`), and the `sync_id` is **deterministic per `(branch, name)`** via `getSettingSyncId()` in `/src/localDb/index.js` so every device in a branch converges on one row per setting name (never reintroduce a random `sync_id` here). Seeded defaults are stamped at the epoch sentinel `SETTINGS_SEED_SENTINEL` (`updated_at == synced_at`) so a fresh default neither pushes (clobbering a real server value) nor wins a pull against one; the first `updateSettings()` bumps `updated_at` so the change then pushes — and `updateSettings()` calls `scheduleSyncSoon()` so a toggle (e.g. `auto_deduct_spoilages` on `InventorySettings`) pushes immediately rather than waiting for the next foreground sync tick. Existing INTEGER-id installs are rebuilt by `migrateSettingsToTextId()` in `alterTables`. **`settings` is also exempt from the server's pull echo-suppression** (`$echoSuppressionExempt` in `SyncController::pull`, alongside `master_items`/batch-transfer entities). The row carries the `device_id` of whoever last *pushed* it, but a web edit (`InventorySettingsController::update` → `updateOrCreate`) does **not** change `device_id` — so without the exemption, the device that originally pushed the row would echo-suppress its own `device_id` and never pull the web's change back, stranding the toggle on its stale value. Pulling one's own unchanged row back is harmless (the `updated_at <= localRow.updated_at` merge guard skips it).
- **`saved_printers` is branch-stored but DEVICE-PRIVATE.** Every read in `/src/localDbQueries/printers.js` filters `WHERE device_id = <this device>` (and reads `active_saved_printers`) so a tablet never sees or auto-connects to another device's printer. The default printer is the per-device `saved_printers.is_default` flag (not the legacy company-wide `default_printer_id` setting); `setDefaultPrinter` flips it scoped to `device_id`.

Delta sync tables receive four extra columns added via `alterTables()` in `/src/localDb/index.js`:

- `sync_id` — UUID assigned on insert, used as the cloud record key
- `updated_at` — set to `CURRENT_TIMESTAMP` on every insert/update/soft-delete
- `synced_at` — stamped by the sync service after a successful push
- `is_deleted` — soft-delete flag (`1` = deleted); **never use `DELETE FROM` on these tables**

**Soft-delete rule**: all deletions on delta sync tables must use `UPDATE … SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP` instead of `DELETE FROM`. Hard deletes are only allowed on excluded tables (`app_versions`, `operations`, `monthly_expenses`, and Account DB tables) — note `settings` and `saved_printers` are now sync tables and must soft-delete.

**Active views**: `createViews()` in `/src/localDb/index.js` creates an `active_<table>` SQLite view for every delta sync table (e.g. `active_items`, `active_inventory_logs`). Each view is defined as `SELECT * FROM <table> WHERE IFNULL(is_deleted, 0) != 1` — **the `IFNULL` is required** because pulled records can have `is_deleted = NULL` and `NULL != 1` evaluates to NULL (falsy) in SQLite, which would silently hide every such row. **All SELECT queries in `/src/localDbQueries/` must use these views instead of the base tables** so soft-deleted records are automatically excluded. Use an alias matching the original table name to keep column references working:

```sql
FROM active_items items
JOIN active_inventory_logs inventory_logs ON inventory_logs.item_id = items.id
```

INSERT / UPDATE / DELETE continue to target the base tables directly. To change what "active" means globally, update only `createViews()`.

Delta sync tables (defined in `DELTA_SYNC_TABLES` constant in `/src/localDb/index.js`):

| Table                       | File                                |
| --------------------------- | ----------------------------------- |
| `taxes`                     | `localDbQueries/taxes.js`           |
| `categories`                | `localDbQueries/categories.js`      |
| `items`                     | `localDbQueries/items.js`           |
| `modifiers`                 | `localDbQueries/modifiers.js`       |
| `modifier_options`          | `localDbQueries/modifiers.js`       |
| `vendors`                   | `localDbQueries/vendors.js`         |
| `vendor_contact_persons`    | `localDbQueries/vendors.js`         |
| `recipe_kinds`              | `localDbQueries/recipeKinds.js`     |
| `recipes`                   | `localDbQueries/recipes.js`         |
| `ingredients`               | `localDbQueries/recipes.js`         |
| `selling_menus`             | `localDbQueries/sellingMenus.js`    |
| `selling_menu_items`        | `localDbQueries/sellingMenus.js`    |
| `inventory_logs`            | `localDbQueries/items.js`           |
| `batch_purchase_groups`     | `localDbQueries/batchPurchase.js`   |
| `batch_purchase_entries`    | `localDbQueries/batchPurchase.js`   |
| `batch_stock_usage_groups`  | `localDbQueries/batchStockUsage.js` |
| `batch_stock_usage_entries` | `localDbQueries/batchStockUsage.js` |
| `invoices`                  | `localDbQueries/salesCounter.js`    |
| `sale_logs`                 | `localDbQueries/salesCounter.js`    |
| `sales_order_groups`        | `localDbQueries/salesCounter.js`    |
| `sales_orders`              | `localDbQueries/salesCounter.js`    |
| `payments`                  | `localDbQueries/salesCounter.js`    |
| `refunds`                   | `localDbQueries/salesCounter.js`    |
| `spoilages`                 | `localDbQueries/spoilages.js`       |
| `revenue_groups`            | `localDbQueries/revenues.js`        |
| `revenue_sources`           | `localDbQueries/revenues.js`        |
| `revenues`                  | `localDbQueries/revenues.js`        |
| `expense_groups`            | `localDbQueries/expenses.js`        |
| `expenses`                  | `localDbQueries/expenses.js`        |
| `revenue_deductions`        | `localDbQueries/expenses.js`        |
| `revenue_categories`        | `localDbQueries/revenues.js`        |

#### Sync Invariants (read before touching sync code)

These rules exist because each was learned the hard way — every violation in the past caused silent data loss (rows pulled but invisible, columns dropped, entities never returned). Treat them as load-bearing.

1. **Schema parity, server ↔ client — including the Eloquent `$fillable`.** Every column listed in a server-side `GROUP_A` entry's `allowedFields` (`fcms-api/src/app/Http/Controllers/SyncController.php`) must exist (a) as a column in the matching client table (created in `createTables()` or added by an `alterTables` migration in `/src/localDb/index.js`), (b) as a real column on the server table (an `alter_..._sync_id` migration in `fcms-api/src/database/migrations/`), **and (c) in the server Eloquent model's `$fillable`** (`fcms-api/src/app/Models/Sync/*`). `(c)` is the silent one: `push()` builds the payload with `array_intersect_key($record, array_flip($allowedFields))`, but persists it via `updateOrCreate`, which calls `fill()` — Laravel's mass-assignment protection **silently drops any attribute not in `$fillable`** (no error, no log). So a field can be in `allowedFields`, in the migration, and on both client tables, yet **never persist on push** if it's missing from `$fillable`. Symptom: the column is always NULL on the server and on every device that obtains the row via pull, while a device that derives the value locally (e.g. the source re-stamping a transfer's `batch_transfer_group_id` in `materializeReceivedTransferLogs`) still shows it — the give-away asymmetry. This is exactly how transfer-IN logs lost their `batch_transfer_group_sync_id` (and IDT logs their `idt_import_sync_id`) while transfer-OUT logs kept it. Adding a server column without the matching client `ALTER TABLE … ADD COLUMN …` instead causes `applyPulledRecord` to drop it on pull; in dev that throws (see rule 6), in prod it just logs and drops.

2. **Entity parity.** Every entity in the server's `SyncController::GROUP_A` must appear in the client's `GROUP_A_ENTITIES` (`/src/services/syncService.js`) with the correct `pushFieldMap`. An entity present on one side and missing on the other is silently never synced.

3. **Soft-delete views are NULL-safe.** Always `WHERE IFNULL(is_deleted, 0) != 1`. Never bare `is_deleted != 1` — `NULL != 1` is NULL/falsy in SQLite and hides the row. `createViews()` is the single source; if you write any other view that filters soft-deletes, use the same pattern.

4. **Soft-delete writes set `updated_at`.** Every delete on a delta-sync table is `UPDATE … SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP`. Hard `DELETE FROM` is allowed only on excluded tables (see top of this section). A soft-delete without `updated_at` won't sync to other devices because push collects only rows where `updated_at > synced_at`.

5. **Pull queries tolerate NULL `updated_at`.** Server-side pull uses `COALESCE(updated_at, created_at, '1970-01-01 00:00:00') > ?` (not bare `updated_at > ?`). Legacy rows or rows from a client that forgot to set `updated_at` would otherwise be excluded from every pull, forever.

6. **Never use `INSERT OR IGNORE` in sync.** Use an explicit existence check then plain `INSERT`. `INSERT OR IGNORE` swallows NOT NULL, FK, and duplicate-column errors silently — which is exactly how "items pulled but invisible" stayed a mystery for so long. `applyPulledRecord` filters the payload against `PRAGMA table_info` so a stale schema produces a loud `__DEV__` throw, not a silent drop.

7. **FKs are OFF during sync.** `runSync()` issues `PRAGMA foreign_keys=OFF` before inserting because entities arrive out of dependency order (e.g. an `ingredients` row can land before its parent `recipes` row). The UUID migration turns FKs on at the end, so this PRAGMA is required on each sync.

8. **`runSync()` requires the active company DB.** It bails if `getActiveBranchId()` does not match the branch read from secure storage — otherwise the foreground sync started by `useAppLifecycle` can land on the unauth `FCMS.db` fallback before `CloudAuthContextProvider.restore()` has called `setActiveCompanyDb`.

9. **Branch switches await the first pull.** `setDesignatedBranch()` calls `runSync()` synchronously and only dispatches `SET_DESIGNATED_BRANCH` once the initial pull lands. `App.js` holds on `Splash` while `isSwitchingBranch` is true. Fire-and-forget syncs (`scheduleSyncSoon`) are fine for incremental updates but never for the first pull after a branch change — the user would see the empty new-branch DB.

10. **`device_id` is preserved in echo suppression, except on initial pull.** When `since === '1970-01-01T00:00:00Z'` (sync_metadata empty) the client omits the `X-Device-Id` header so the server does NOT filter out the requesting device's own historical rows. Without this, reinstalls and branch switches with locally-originated rows would pull nothing.

11. **Migrations are idempotent and run on every `setActiveCompanyDb`.** `createTables`, `alterTables`, and `createViews` all use `IF NOT EXISTS` (or `DROP + CREATE` for views, so view definitions update on existing DBs). Never write a non-idempotent migration here — it runs on every sign-in, restore, and branch switch.

12. **Sync timestamps are UTC `YYYY-MM-DD HH:MM:SS` on BOTH sides — never let the server ISO-serialize them.** The client stores `updated_at` / `created_at` / `synced_at` via `CURRENT_TIMESTAMP` (SQLite UTC, space-separated, no `T`/`Z`). The whole sync depends on plain **string** comparisons of these: push collection (`updated_at > synced_at` in `collectUnsynced`), the pull merge guard (`fields.updated_at <= localRow.updated_at` in `applyPulledRecord`), and the server pull filter (`COALESCE(updated_at, created_at, …) > since`). Those comparisons are only correct if every value is the **same format and timezone**. Two server-side facts make this hold and must be preserved:
    - **`SyncModel` sets `public $timestamps = false` and declares no `$casts`/`$dates`/`serializeDate` for datetime columns.** So Eloquent returns `updated_at`/`created_at` (and all business-date columns) from `->toArray()` as the **raw MySQL string** `YYYY-MM-DD HH:MM:SS`, matching the client. The moment you add a date `$cast` (or re-enable timestamps) on a sync model, Laravel serializes that column as ISO-8601 `…THH:MM:SS.uuuuuuZ` in the pull JSON; the client then string-compares `"…T…"` against local `"… …"` (the `T`=0x54 always sorts above space=0x20), which silently (a) makes a locally-edited, previously-synced row fail `updated_at > synced_at` and never push, and (b) makes the server's row always "win" the pull-merge guard. Incoming pushed datetimes are normalized server-side by `normalizeDatetimes()`/`toMysqlDatetime()` before storage, so storage stays clean regardless — the risk is purely on the **read/serialize** path.
    - **The server runs in UTC** (no `APP_TIMEZONE`/`config('app.timezone')` override; Laravel default). `now()` therefore matches the client's UTC `CURRENT_TIMESTAMP`, so the `pulled_at`/`since` watermark (`now()->toISOString()`, the one deliberately-ISO value — MySQL tolerates its `T`/`Z` in the `whereRaw` and it is never stored) and any `now()->toDateTimeString()` writes (dedup `updated_at` bump, `created_at` default) line up with client rows. Changing the server timezone would offset every cross-device watermark comparison.

    (This is distinct from the business/event-date convention below: those columns are LOCAL on the client and round-trip as **opaque** strings — the server never compares or casts them, so their local-ness survives untouched. `payments.payment_date` is a business date and is written LOCAL like the others; its sibling `payments.input_date` is an audit/entry timestamp and correctly stays on the UTC `DEFAULT CURRENT_TIMESTAMP`. Watch for business-date columns that carry a `DEFAULT CURRENT_TIMESTAMP` and are then **omitted** from an INSERT — the UTC default fires silently; always write them explicitly with the local idiom.)

### Batch Transfer (Branch-to-Branch)

Branch-to-branch batch transfer is a **non-VAT** operation — the receiving branch records stock at the source branch's cost basis, not at a freshly invoiced price.

When snapshotting an item's unit cost onto `batch_transfer_entries.unit_cost_snapshot` (in `/src/localDbQueries/batchTransfer.js`), use `avg_unit_cost_net` — the VAT-stripped moving weighted average from inventory logs — **of the SOURCE branch's item**. Do NOT use the static `item.unit_cost` (gross/VAT-inclusive) and do NOT use `item.avg_unit_cost` (also gross).

**The snapshot must always be the SOURCE branch's cost basis, on both branches' logs.** This is subtle because the authoring branch differs by direction: an Out-mode entry is authored by the source (picking its own item → `item.avg_unit_cost_net` is already the source's), but an In-mode entry is authored by the *destination* (picking its own item → `item.avg_unit_cost_net` would be the **destination's** cost, the wrong basis). The creation-time snapshot in `createBatchTransferEntry` is therefore only a provisional estimate; the **authoritative** value is (re)computed on the SOURCE's device at physical dispatch in `confirmTransferOut`, which resolves the source's local item (via `resolveLocalItemForEntry`, `createIfMissing:false`) and overwrites `unit_cost_snapshot` with `getSourceItemAvgUnitCostNet(db, sourceItemId)` (same COALESCE formula as `getItems`). Dispatch always runs on the source, before the destination confirms receipt (which writes the Transfer In log from this snapshot) and before `materializeReceivedTransferLogs` writes the source's Transfer Out log — so correcting it there makes both branches log the source's net cost, and the value syncs to the destination with the transferring-status update. Never reintroduce reliance on the destination-authored creation snapshot for In-mode.

Why net, not gross: transfer itself does not add VAT. If the snapshot were gross/VAT-inclusive, VAT would be double-counted downstream when the destination later sells with VAT. This matches the existing `remove_stock` convention in `inventoryLogs.js` where `unitCost = avg_unit_cost_net` and `unitCostTax = 0`.

Why avg, not the static `unit_cost`: `unit_cost` is the configured/initial price and can be stale relative to actual purchase history. `avg_unit_cost_net` reflects what the source branch actually paid (net of VAT) for the stock being moved, which is what the destination should inherit as its cost basis.

`avg_unit_cost_net` is always populated by `getItems` / `getItem` — the SQL formula `(added_cost_net - removed_cost_net) / NULLIF(added_qty - removed_qty, 0)` is wrapped in `COALESCE(..., items.unit_cost / (IFNULL(taxes.rate_percentage, 0) / 100.0 + 1))`. This means even items with no inventory history (initial_stock_qty = 0, no purchases) or items where added_qty == removed_qty return a VAT-stripped fallback derived from the static `unit_cost` and the linked tax rate, instead of NULL. The same COALESCE pattern applies to `avg_unit_cost` (fallback = `items.unit_cost`) and `avg_unit_cost_tax` (fallback = `unit_cost - net`) for consistency.

The snapshot is seeded at entry creation in `createBatchTransferEntry` and re-stamped (from the source's current `avg_unit_cost_net`) at dispatch in `confirmTransferOut`; from there it flows into the destination's `inventory_logs.adjustment_unit_cost` (`confirmTransferReceived`), the source's `inventory_logs.adjustment_unit_cost` (`materializeReceivedTransferLogs`), and any auto-created destination item's `unit_cost` (`autoCreateLocalItemForTransfer`). All three downstream sites already read from `entry.unit_cost_snapshot`, so the rule only needs to be enforced at the two capture sites (and the dispatch re-stamp is what guarantees the source basis regardless of who authored the entry). The server (`SyncController`) round-trips `unit_cost_snapshot` as an opaque `allowedFields` value and never computes it — no backend change is involved.

#### Item resolution must go through `resolveLocalItemForEntry` (no duplicate items)

When a transfer entry is materialized into an `inventory_logs` row, the code must find **this branch's** existing local item for the entry before writing the log. **Always resolve through `resolveLocalItemForEntry` in `/src/localDbQueries/batchTransfer.js` — never look up the item by `master_item_id`/`master_item_sync_id` alone.** That single helper matches in priority order: an already-stamped local id (`dest_item_id` for the destination, `source_item_id` for the source, validated against `active_items`) → the master link → the **SKU** → exact name+UOM, and only auto-creates a local item when `createIfMissing` is true and nothing matched.

The SKU/name fallbacks are load-bearing: `master_item_sync_id` is a client-only column derived from `sku` and is frequently NULL or divergent between two branches (items registered independently, link not yet rebuilt by `backfillItemMasterLinks`, or the entry authored before the server's master dedup converged). A master-only lookup falls straight through to auto-create and spawns a **duplicate** local item — the transfer-in/out log then lands on the duplicate, so the user's real item shows no Transfer In and the duplicate appears in the local item list (e.g. "Select Items to Transfer") with a different stock. (The server Master Item List dedups by SKU, so it stays correct — which is the tell-tale signature of this bug.) This is a client-only resolution concern; the sync layer and `SyncController` round-trip `source_item_sync_id` / `dest_item_sync_id` / `master_item_sync_id` as opaque values and need no change.

The three call sites — `confirmTransferReceived` (dest, `createIfMissing: true`), `materializeReceivedTransferLogs` (source, `createIfMissing: true`), and `resolveMissingSourceItemIdsForGroup` (source at request-open, `createIfMissing: false` so browsing never spawns stockless items) — must all route through this helper.

#### Date/time convention: business/event dates are LOCAL, audit/sync timestamps are UTC

This applies to **every** insert and update across `/src/localDbQueries/`, not just Batch Transfer — getting it wrong silently misorders rows in date-sorted lists.

**Business/event date columns are stored in LOCAL time** as `YYYY-MM-DD HH:mm:ss`: `inventory_logs.adjustment_date`, `inventory_logs.beginning_inventory_date`, `spoilages.in_spoilage_date`, and the sale / purchase / order / usage / ending-inventory dates. User-entered values come from a local date picker (built from `getHours()` etc.), and lists display and **sort** them as-is with no timezone conversion (e.g. `getInventoryLogs` orders by `adjustment_date DESC`). So when a write generates the date itself, it MUST use `datetime('now', 'localtime')` (or `datetime('now', 'localtime', 'start of month', …)` for beginning-inventory baselines, with `'localtime'` first so the month math runs on the local date). To carry over a stored-UTC value (e.g. a transfer's `group.date_received`), convert it with `datetime(<utc>, 'localtime')`.

**Never** stamp a business date with bare `CURRENT_TIMESTAMP` or `datetime('now')` — both are UTC and sink the row `tz-offset` hours into the past, hiding it below same-day local entries in the sorted list (the Batch Transfer "Transfer In missing from the log list" bug). The established per-write idiom is `userDate ? datetime('${userDate}') : datetime('now', 'localtime')`.

**Audit/sync timestamp columns stay UTC**: `updated_at` and `synced_at` (sync watermarks — the server compares `updated_at`, so it MUST be UTC), plus `date_created` / `date_saved` (uniformly UTC via `CURRENT_TIMESTAMP` / `datetime('now')`; flipping these to local would mix timezones within the column against existing rows and reintroduce the same misordering). Do not "localize" these.

#### UOM abbreviation display (all Batch Transfer screens)

Every UOM abbreviation rendered on a Batch Transfer screen — item rows, qty badges, input labels, dialog text — must be displayed **uppercase**, with one exception: `"ea"` (Each) renders as **`"ea (pc)"`** because users recognize "pc" (piece) more readily than "EA". Use the single helper `formatTransferUOMAbbrev(uomAbbrev)` from `/src/utils/stringHelpers.js` — never render a raw `uom_abbrev`/`item_uom_abbrev` string directly on these screens. (Note: this is distinct from the generic `formatUOMAbbrev`, which maps `"ea"` to `"PC"`; Batch Transfer intentionally keeps the `"ea (pc)"` form.)

### Revenue Groups (internal POS sales + external sources)

A Revenue Group's monthly revenue — which is the **denominator for every item/category Cost Percentage** — is computed as **internal POS sales + external per-source amounts**, not the old single hand-entered number:

- **Internal sales**: net (VAT-exclusive) `SUM(sale_unit_selling_price_net * sale_qty)` from `active_sale_logs`, joined `sale_logs → active_items → active_revenue_categories` for the group's categories, filtered to the month, excluding `voided`/`is_refunded`. (Use the `_net` column — gross `sale_unit_selling_price` is intentionally **not** used here.)
- **External amounts**: rows in `revenues`, each linked to a reusable `revenue_sources` record (e.g. "External POS1", "Portable Terminal") via `revenues.revenue_source_id`. Users add a **net (VAT-exclusive)** amount **per source per group per month** (`createRevenue` upserts on the `(group, month, source)` key).

**Single source of truth**: the SQL is built by `buildRevenueGroupMonthSalesSql` / `buildRevenueGroupMonthExternalSql` / `buildRevenueGroupMonthTotalSql` in `/src/localDbQueries/revenues.js`. Every place that needs a revenue-group monthly total reuses these so the formula can never drift — `getRevenueGroups`/`getRevenueGroupsGrandTotal` (revenues.js), `getItemCostPercentage`/`getCategoryCostPercentage` (inventoryLogs.js), and the `selected_month_revenue_group_total_amount` / all-categories grand-total subqueries in `reports.js` and `endingInventory.js`. **Never reintroduce a bare `SUM(revenues.amount)` for a revenue-group total** — route it through these helpers (pass your own `groupIdSql`/`dateSql` raw SQL fragments).

`revenue_sources` is a branch-scoped delta-sync table (mirrors `revenue_groups`); `revenues.revenue_source_id` maps to the server's `revenue_source_sync_id` (see `pushFieldMap` in `syncService.js` and `allowedFields` in `SyncController.php`). The breakdown UI is `RevenueGroupListItem` (a `List.Accordion`: sales line + per-source rows + total) fed by `getRevenueEntries`; sources are managed on the `ManageRevenueSources` screen.

### Inventory Data Template (IDT) Import/Export

The IDT is the Excel file users download to bulk-import inventory items. The full developer guide is in [`README.md`](README.md#inventory-data-template-idt); the rules below are load-bearing — every violation in the past silently mis-mapped column values into the wrong DB fields.

1. **Single source of truth.** Column metadata lives in `/src/constants/inventoryDataTemplate.js` as `IDT_COLUMNS` (ordered array of `{ field, header, required, width, acceptedNormalized? }`). Both `downloadEmptyInventoryDataTemplate` and `importInventoryDataTemplate` in `/src/screens/Account.js` read from it. Adding, renaming, or reordering a column is a one-line edit to this constant — never edit the export header literal or the import column list separately. Export and import drifting apart is exactly the bug this design eliminates.

2. **Importer is header-based, not position-based.** Never reintroduce positional parsing (e.g. `csvtojson({ headers: [...] })` with a hardcoded list, or `row[0]`/`row[1]` indexing). The importer reads the file's actual header row, normalizes each cell with `normalizeHeader` (lowercase + strip non-alphanumeric), and matches against `IDT_COLUMNS`. Column order in the spreadsheet is purely cosmetic — users can reorder, swap, or insert columns and the import still works.

3. **Renaming a header requires `acceptedNormalized`.** Templates the user downloaded before the rename still have the old header text. When you change `header`, add the old header's normalized form to that column's `acceptedNormalized` list **in the same commit** — otherwise older templates silently lose that column (and if the column was required, the import aborts). Only the canonical `header` is matched automatically; aliases must be listed.

4. **Required vs optional missing columns.** A `required: true` column missing from the header row makes the importer abort with a clear user-facing message naming the missing header(s) — no rows are inserted. An optional column missing is treated as empty string `''` for every row and the import proceeds. Unknown extra columns in the user's file are ignored.

### Recipes (domain model)

- **"Sub-recipe" is legacy — conceptually it no longer exists.** Every registered finished product is *automatically* a sub-recipe: a recipe's finished product is a registered, stockable item (it increases yield) and that item can itself be used as an ingredient in another recipe — which is exactly what a sub-recipe is. Don't build new features on the distinction. **The dedicated sub-recipe UI is removed** (2026-06-17): `CreateSubRecipe`/`SubRecipeForm`/`SubRecipeList`/`SubRecipeListItem` are deleted, the `createSubRecipe` route is gone, and `screens/Recipes.js` is now a single `ServingRecipes` screen (the old `RecipesTab` two-tab navigator — which only existed to host the "Sub Recipes" tab — is gone). The `recipes.is_sub_recipe` / `items.is_sub_recipe` columns stay (schema + `syncService` field-map) for back-compat only; don't reintroduce sub-recipe UI.
- **Markup is NOT set at the recipe level.** Add markup/SRP on the registered finished-product *item* — it's the real sellable entity. `saveRecipe`/`updateRecipe` (`/src/localDbQueries/recipes.js`) **no longer write** `recipes.markup_percentage` / `markup_amount`, and `EditRecipe` no longer seeds them; the columns remain in the schema for back-compat only. Don't surface or extend recipe-level markup.
- **Recipe kind** is the current way to categorize recipes (parity with web). It is wired into `RecipeForm` (create + edit) via the kind picker → `RecipeKind` modal (`/src/modals/RecipeKind.js`), persisted as `recipes.recipe_kind_id`, and managed through `/src/localDbQueries/recipeKinds.js` (`recipe_kinds` is a delta-sync table). Display name comes from a `LEFT JOIN active_recipe_kinds` in `getRecipe`.
- The User Guide is intentionally not updated for this yet (recipe UX is still changing).

### Navigation Structure

Five navigation stacks in `/src/stacks/`:

- `RootStack` — main app (items, recipes, purchases, revenues, expenses, reports, account)
- `AuthStack` — local authentication
- `CloudAuthStackV2` — cloud auth and onboarding
- `AccountSetupStack` — new account creation
- `ReinstallDetectedStack` — data recovery flow

Navigation outside components uses `RootNavigation.js` ref.

### State Management

Context API with 13+ providers in `/src/context/providers/`. Key providers:

- `CloudAuthContextProvider` — cloud auth state **and** company DB lifecycle (activates company DB, seeds defaults, clears React Query cache on sign-out). `AuthContextProvider` is deprecated.
- `AppConfigContextProvider` — global app config
- `ItemFormContextProvider`, `RecipeFormContextProvider`, `ExpenseFormContextProvider`, `SellingMenuFormContextProvider` — form state
- `SearchbarContextProvider`, `SalesCounterContextProvider` — feature-specific state

Access via corresponding `use*Context` hooks in `/src/hooks/`.

### Data Fetching

- **React Query v4** (`@tanstack/react-query`) for all cloud API calls. Config: 5-min `staleTime`, 10-min `cacheTime`, `refetchOnWindowFocus` and `refetchOnReconnect` disabled.
- **Axios** instance in `/src/api/cloudApiV2.js` with 30s timeout and Bearer token injection.
- Server query functions in `/src/serverDbQueries/v2/`.
- After mutations, invalidate relevant queries via `queryClient.invalidateQueries(['key'])`.

### Form Pattern

Formik + Yup throughout. Form state often stored in Context Providers for cross-component access. Most forms are in `/src/modals/`.

### Modal vs Screen Conventions

- **Do NOT add new screens to `/src/modals/`**. That directory contains legacy full-screen modals that will be migrated to `/src/screens/` in the future.
- New reusable modals/dialogs go in `/src/components/modals/`.
- New full-screen views go in `/src/screens/`.

### Key Directories

| Path                       | Purpose                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `/src/screens/`            | Full-screen views (~82 screens)                                                            |
| `/src/components/`         | Reusable UI components                                                                     |
| `/src/components/modals/`  | Reusable modal/dialog components (use this for new modals)                                 |
| `/src/modals/`             | Legacy full-screen modals (do not add new files here; will be migrated to `/src/screens/`) |
| `/src/hooks/`              | Custom hooks (~29)                                                                         |
| `/src/stacks/`             | React Navigation stack definitions                                                         |
| `/src/tabs/`               | Bottom-tab screen components                                                               |
| `/src/context/providers/`  | Context providers                                                                          |
| `/src/localDbQueries/`     | SQLite query functions                                                                     |
| `/src/serverDbQueries/v2/` | Cloud API query functions                                                                  |
| `/src/constants/`          | App-wide constants, route names, storage keys                                              |
| `/src/services/`           | App segment init, permissions, version check                                               |

## Tech Stack Highlights

- **React Native 0.79** / **React 19** — mostly JavaScript (not TypeScript despite tsconfig)
- **React Navigation** — stack, bottom-tabs, drawer, material-top-tabs
- **react-native-paper** — Material Design UI components
- **SQLite** via `react-native-sqlite-storage`
- **Secure storage** via `react-native-fast-secure-storage`
- **Thermal printing** via `@tumihub/react-native-thermal-receipt-printer`
- **Device binding** — app registers to a specific device; device tokens stored in secure storage
