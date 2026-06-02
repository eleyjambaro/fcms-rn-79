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

All Company DB tables participate in delta sync **except**: `app_versions`, `operations`, `saved_printers`, `settings`, and `sync_metadata`. Account DB tables are never synced.

Delta sync tables receive four extra columns added via `alterTables()` in `/src/localDb/index.js`:

- `sync_id` — UUID assigned on insert, used as the cloud record key
- `updated_at` — set to `CURRENT_TIMESTAMP` on every insert/update/soft-delete
- `synced_at` — stamped by the sync service after a successful push
- `is_deleted` — soft-delete flag (`1` = deleted); **never use `DELETE FROM` on these tables**

**Soft-delete rule**: all deletions on delta sync tables must use `UPDATE … SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP` instead of `DELETE FROM`. Hard deletes are only allowed on excluded tables (`app_versions`, `operations`, `saved_printers`, `settings`, `monthly_expenses`, and Account DB tables).

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
| `revenues`                  | `localDbQueries/revenues.js`        |
| `expense_groups`            | `localDbQueries/expenses.js`        |
| `expenses`                  | `localDbQueries/expenses.js`        |
| `revenue_deductions`        | `localDbQueries/expenses.js`        |
| `revenue_categories`        | `localDbQueries/revenues.js`        |

#### Sync Invariants (read before touching sync code)

These rules exist because each was learned the hard way — every violation in the past caused silent data loss (rows pulled but invisible, columns dropped, entities never returned). Treat them as load-bearing.

1. **Schema parity, server ↔ client.** Every column listed in a server-side `GROUP_A` entry's `allowedFields` (`fcms-api/src/app/Http/Controllers/SyncController.php`) must exist as a column in the matching client table (created in `createTables()` or added by an `alterTables` migration in `/src/localDb/index.js`). Adding a server column without the matching client `ALTER TABLE … ADD COLUMN …` causes `applyPulledRecord` to drop it; in dev that throws (see rule 6), in prod it just logs and drops.

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

### Batch Transfer (Branch-to-Branch)

Branch-to-branch batch transfer is a **non-VAT** operation — the receiving branch records stock at the source branch's cost basis, not at a freshly invoiced price.

When snapshotting an item's unit cost onto `batch_transfer_entries.unit_cost_snapshot` (in `/src/localDbQueries/batchTransfer.js`), use `item.avg_unit_cost_net` from `getItems` — the VAT-stripped moving weighted average from inventory logs. Do NOT use the static `item.unit_cost` (gross/VAT-inclusive) and do NOT use `item.avg_unit_cost` (also gross).

Why net, not gross: transfer itself does not add VAT. If the snapshot were gross/VAT-inclusive, VAT would be double-counted downstream when the destination later sells with VAT. This matches the existing `remove_stock` convention in `inventoryLogs.js` where `unitCost = avg_unit_cost_net` and `unitCostTax = 0`.

Why avg, not the static `unit_cost`: `unit_cost` is the configured/initial price and can be stale relative to actual purchase history. `avg_unit_cost_net` reflects what the source branch actually paid (net of VAT) for the stock being moved, which is what the destination should inherit as its cost basis.

`avg_unit_cost_net` is always populated by `getItems` / `getItem` — the SQL formula `(added_cost_net - removed_cost_net) / NULLIF(added_qty - removed_qty, 0)` is wrapped in `COALESCE(..., items.unit_cost / (IFNULL(taxes.rate_percentage, 0) / 100.0 + 1))`. This means even items with no inventory history (initial_stock_qty = 0, no purchases) or items where added_qty == removed_qty return a VAT-stripped fallback derived from the static `unit_cost` and the linked tax rate, instead of NULL. The same COALESCE pattern applies to `avg_unit_cost` (fallback = `items.unit_cost`) and `avg_unit_cost_tax` (fallback = `unit_cost - net`) for consistency.

The snapshot is captured once at entry creation in `createBatchTransferEntry` and then flows into the destination's `inventory_logs.adjustment_unit_cost` (`confirmTransferReceived`), the source's `inventory_logs.adjustment_unit_cost` (`materializeReceivedTransferLogs`), and any auto-created destination item's `unit_cost` (`autoCreateLocalItemForTransfer`). All three downstream sites already read from `entry.unit_cost_snapshot`, so the rule only needs to be enforced at the capture site.

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

### Inventory Data Template (IDT) Import/Export

The IDT is the Excel file users download to bulk-import inventory items. The full developer guide is in [`README.md`](README.md#inventory-data-template-idt); the rules below are load-bearing — every violation in the past silently mis-mapped column values into the wrong DB fields.

1. **Single source of truth.** Column metadata lives in `/src/constants/inventoryDataTemplate.js` as `IDT_COLUMNS` (ordered array of `{ field, header, required, width, acceptedNormalized? }`). Both `downloadEmptyInventoryDataTemplate` and `importInventoryDataTemplate` in `/src/screens/Account.js` read from it. Adding, renaming, or reordering a column is a one-line edit to this constant — never edit the export header literal or the import column list separately. Export and import drifting apart is exactly the bug this design eliminates.

2. **Importer is header-based, not position-based.** Never reintroduce positional parsing (e.g. `csvtojson({ headers: [...] })` with a hardcoded list, or `row[0]`/`row[1]` indexing). The importer reads the file's actual header row, normalizes each cell with `normalizeHeader` (lowercase + strip non-alphanumeric), and matches against `IDT_COLUMNS`. Column order in the spreadsheet is purely cosmetic — users can reorder, swap, or insert columns and the import still works.

3. **Renaming a header requires `acceptedNormalized`.** Templates the user downloaded before the rename still have the old header text. When you change `header`, add the old header's normalized form to that column's `acceptedNormalized` list **in the same commit** — otherwise older templates silently lose that column (and if the column was required, the import aborts). Only the canonical `header` is matched automatically; aliases must be listed.

4. **Required vs optional missing columns.** A `required: true` column missing from the header row makes the importer abort with a clear user-facing message naming the missing header(s) — no rows are inserted. An optional column missing is treated as empty string `''` for every row and the import proceeds. Unknown extra columns in the user's file are ignored.

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
