# Revenue Groups: internal POS (sale_logs) + reusable external POS sources

## Context

Today a Revenue Group's monthly revenue is a single number the user types in by hand
(`revenues.amount`, one row per group per month) — it came from a third‑party/external
POS. That number is the denominator for every **Cost Percentage** shown for items and
categories whose category belongs to the group.

The app now has an internal POS; all internal sales live in `sale_logs`. We want each
Revenue Group's monthly revenue to be **computed from `sale_logs`** (filtered by the
selected month) for the categories in that group, **plus** any number of manually entered
**external** revenue amounts — and those external amounts should be enterable **per POS
source** (e.g. "External POS1", "Portable Terminal"), not as one lump sum.

Decisions confirmed with the user:
- **External revenue = reusable POS sources.** A managed list of named sources; the user
  inputs an amount per source per group per month. (New synced table + management UI.)
- **Internal sales basis = gross (VAT‑inclusive):** `SUM(sale_unit_selling_price * sale_qty)`,
  matching the meaning of the current "Total Revenue" field. Voided / refunded sale_logs
  are excluded.

Target behavior (per the user's example, selected month = Jun 2026):
```
Food .......... 23,000   (accordion)
  Total revenue (Sales)        20,000   ← computed from sale_logs
  + External POS1               1,000
  + External POS2               2,000
  Total                        23,000
```
Result everywhere: **revenue group monthly total = (gross sale_logs for its categories)
+ (sum of that group's external per‑source amounts)**. This new total replaces
`SUM(revenues.amount)` as the cost‑percentage denominator in every place that computes it.

---

## Data model changes

### 1. New delta‑sync table `revenue_sources` (branch‑scoped, mirrors `revenue_groups`)

Reusable named external POS sources. Branch‑scoped like `revenue_groups`.

**Client** [`src/localDb/index.js`](src/localDb/index.js):
- `createTables()` — add `CREATE TABLE IF NOT EXISTS revenue_sources (...)` with columns
  `id TEXT PRIMARY KEY NOT NULL, name VARCHAR NOT NULL, date_created DATETIME DEFAULT
  CURRENT_TIMESTAMP, date_updated DATETIME` + the 5 sync columns
  (`device_id, branch_id, sync_id, updated_at, synced_at, is_deleted`). Copy the
  `revenue_groups` block at [index.js:1007](src/localDb/index.js#L1007) verbatim and rename.
- `DELTA_SYNC_TABLES` [index.js:1253](src/localDb/index.js#L1253) — add `'revenue_sources'`.
  This auto‑creates the `active_revenue_sources` view via `createViews()` and includes the
  table in the runSync/migration loops. (`createTables` is idempotent and runs on every
  `setActiveCompanyDb`, so existing installs get the table — no separate ALTER needed.)

**Server** (`fcms-api`):
- New migration `..._create_revenue_sources_table.php` mirroring the `revenue_groups`
  block in [`2024_01_01_000009_create_sync_transactional_tables.php`](../fcms-api/src/database/migrations/2024_01_01_000009_create_sync_transactional_tables.php#L102)
  (uuid `id`, unique `sync_id`, `company_id`, `branch_id`, `device_id`, `name`,
  `date_updated`, `is_deleted`, `updated_at`, `created_at`).
- New model `src/app/Models/Sync/RevenueSource.php` — copy `Revenue.php`/`RevenueGroup.php`,
  `$table = 'revenue_sources'`, fillable = sync columns + `name`.
- `SyncController.php` `GROUP_A` ([line ~89](../fcms-api/src/app/Http/Controllers/SyncController.php#L89)) —
  add `'revenue_sources' => [RevenueSource::class, ['name','date_updated','is_deleted','updated_at','created_at']]`.

**Client sync** [`src/services/syncService.js`](src/services/syncService.js):
- `GROUP_A_ENTITIES` — add `{key: 'revenue_sources', table: 'revenue_sources'}` near
  `revenue_groups` ([line 140](src/services/syncService.js#L140)). No `pushFieldMap` (only
  `name`, passes through).

### 2. New column `revenues.revenue_source_id` (FK → `revenue_sources`, nullable)

Each external revenue row now belongs to a source. Legacy rows keep `NULL` (treated as an
unnamed external amount).

- **Client** [`src/localDb/index.js`](src/localDb/index.js):
  - `createTables()` `revenues` block ([index.js:1022](src/localDb/index.js#L1022)) — add
    `revenue_source_id TEXT`.
  - `alterTables()` — add an `executeSqlIfColumnNotExist(db, 'revenues',
    'revenue_source_id', 'ALTER TABLE revenues ADD COLUMN revenue_source_id TEXT DEFAULT
    NULL;')` (follow the existing pattern at [index.js:1660](src/localDb/index.js#L1660)).
- **Client sync** [`syncService.js:142`](src/services/syncService.js#L142) — extend the
  `revenues` `pushFieldMap` to `{revenue_group_id:'revenue_group_sync_id',
  revenue_source_id:'revenue_source_sync_id'}`. Reverse mapping on pull is generic (same as
  `revenue_group_sync_id → revenue_group_id`).
- **Server**: new migration `ALTER TABLE revenues ADD revenue_source_sync_id` (string(36),
  nullable, indexed); add `'revenue_source_sync_id'` to `Revenue` model fillable and to the
  `revenues` `allowedFields` in `SyncController.php` ([line 90](../fcms-api/src/app/Http/Controllers/SyncController.php#L90)).

---

## Shared revenue-total SQL helper (single source of truth)

The "revenue group total for a month" is currently re‑derived as `SUM(revenues.amount)` in
~6 places. To avoid drift, add **one** exported SQL builder in
[`src/localDbQueries/revenues.js`](src/localDbQueries/revenues.js) and reuse it everywhere:

```js
// gross internal sales for a group's categories in a month
export const buildRevenueGroupMonthSalesSql = ({groupIdSql, dateSql}) => `
  (SELECT IFNULL(SUM(sl.sale_unit_selling_price * sl.sale_qty), 0)
   FROM active_sale_logs sl
   JOIN active_items it ON it.id = sl.item_id
   JOIN active_revenue_categories rc ON rc.category_id = it.category_id
   WHERE rc.revenue_group_id = ${groupIdSql}
     AND IFNULL(sl.voided, 0) = 0 AND IFNULL(sl.is_refunded, 0) = 0
     AND strftime('%m %Y', sl.sale_date) = strftime('%m %Y', ${dateSql}))`;

// external manual amounts for a group in a month
export const buildRevenueGroupMonthExternalSql = ({groupIdSql, dateSql}) => `
  (SELECT IFNULL(SUM(rv.amount), 0)
   FROM active_revenues rv
   WHERE rv.revenue_group_id = ${groupIdSql}
     AND strftime('%m %Y', rv.revenue_group_date) = strftime('%m %Y', ${dateSql}))`;

// total = sales + external
export const buildRevenueGroupMonthTotalSql = (args) =>
  `(${buildRevenueGroupMonthSalesSql(args)} + ${buildRevenueGroupMonthExternalSql(args)})`;
```

`groupIdSql` / `dateSql` are raw SQL fragments so each caller passes its own
(`'revenue_groups.id'` vs a literal id; `'${dateFilter}'` vs `datetime('now','localtime')`).
No circular import: `revenues.js` does not import the consumer files.

---

## Query layer changes (reuse the helper everywhere)

- [`revenues.js`](src/localDbQueries/revenues.js):
  - `getRevenueGroups` ([L34‑63](src/localDbQueries/revenues.js#L34)) — replace the
    `r.amount`/grand‑total subqueries. Per group expose `sales_total`, `external_total`,
    `total_amount` (helper with `groupIdSql='revenue_groups.id'`, `dateSql="'${dateFilter}'"`),
    and `percentage = total_amount / grandTotal * 100`, where `grandTotal` = `SUM` of the
    total helper over `active_revenue_groups`. The `LEFT JOIN ... as r` can be dropped.
  - `getRevenueGroupsGrandTotal` / `getRevenueGroupsTotals` ([L86‑134](src/localDbQueries/revenues.js#L86)) —
    `SELECT IFNULL(SUM(<total helper with groupIdSql='revenue_groups.id'>),0) FROM
    active_revenue_groups revenue_groups`.
- [`inventoryLogs.js`](src/localDbQueries/inventoryLogs.js):
  - `getItemCostPercentage` ([L911‑928](src/localDbQueries/inventoryLogs.js#L911)) and
    `getCategoryCostPercentage` ([L1069‑1085](src/localDbQueries/inventoryLogs.js#L1069)) —
    replace the `SELECT SUM(amount) FROM revenues ...` block with
    `buildRevenueGroupMonthTotalSql({groupIdSql:"'${revenueGroupId}'", dateSql:"datetime('now','localtime')"})`.
    (Keep the existing "current month" semantics — `datetime('now','localtime')`.)
- [`reports.js`](src/localDbQueries/reports.js): grep for **all** occurrences of
  `selected_month_revenue_group_total_amount` (at least [L134‑144](src/localDbQueries/reports.js#L134)
  and [L493‑502](src/localDbQueries/reports.js#L493)) and replace each external‑only
  subquery with the total helper, passing the existing correlated `revenue_group_id`
  subselect as `groupIdSql` and `datetime('${dateFilter}')` as `dateSql`.

> Assumption (inherited from current code): a category belongs to one revenue group. Grand
> total sums per group; a category shared across two groups would be counted in both.

---

## Write paths

[`revenues.js`](src/localDbQueries/revenues.js):
- `createRevenue` ([L415‑479](src/localDbQueries/revenues.js#L415)) — accept
  `values.revenue_source_id`; change the existence check / upsert key from
  `(group, month)` to `(group, month, revenue_source_id)`, and write `revenue_source_id`
  on insert. Keep `revenue_group_date` written LOCAL from the picker (business date — per
  CLAUDE.md date convention) and `updated_at = CURRENT_TIMESTAMP` (UTC).
- New source CRUD (kept in `revenues.js` for cohesion; `revenue_sources` → `revenues.js`):
  `getRevenueSources`, `createRevenueSource`, `updateRevenueSource`, `deleteRevenueSource`
  (soft‑delete `is_deleted=1, updated_at=CURRENT_TIMESTAMP`; on delete also soft‑delete the
  source's `revenues` rows, mirroring `deleteRevenueGroup` at [L394](src/localDbQueries/revenues.js#L394)).
  Model each on `createRevenueGroup`/`updateRevenueGroup`, with a duplicate‑name guard.
- New `getRevenueEntries({queryKey})` — returns a group's per‑source external rows for the
  selected month: `active_revenues` joined to `active_revenue_sources` (source name),
  `WHERE revenue_group_id = ? AND strftime('%m %Y', revenue_group_date) = strftime('%m %Y', dateFilter)`.

All SELECTs use `active_*` views; INSERT/UPDATE/soft‑delete target base tables. `scheduleSyncSoon()` after each write (existing pattern).

---

## UI changes

- **`RevenueGroupListItem`** [src/components/foodCostAnalysis/RevenueGroupListItem.js](src/components/foodCostAnalysis/RevenueGroupListItem.js) —
  convert to an expandable accordion using `List.Accordion` (already used in
  [RolePermissionEditor.js](src/components/roles/RolePermissionEditor.js#L56)). Header: group
  name + `total_amount`. Expanded body renders:
  - `Total revenue (Sales)` → `item.sales_total`
  - one row per external source (name + amount) with edit / delete (uses `getRevenueEntries`)
  - `+ Add external revenue` → opens source picker + amount form
  - `Total` → `item.total_amount`
- **`RevenueForm`** [src/components/forms/RevenueForm.js](src/components/forms/RevenueForm.js) —
  add a **source selector** (pick from `getRevenueSources`) alongside the amount field;
  validate source + amount. Submitting passes `revenue_source_id`.
- **`RevenueGroupList`** [src/components/foodCostAnalysis/RevenueGroupList.js](src/components/foodCostAnalysis/RevenueGroupList.js) —
  wire `getRevenueEntries`, source‑aware `createRevenue`, and source CRUD mutations
  (invalidate `revenueGroups`, `revenueGroupsGrandTotal`, `revenues`, `revenueSources`).
  Replace the single group‑level "Update/Delete revenue amount" options with the
  accordion‑driven per‑source add/edit/delete.
- **Manage external revenue sources** — add a "Manage external revenue sources" button on
  the Revenue Groups tab (mirror the existing `ManageListButton` →
  `routes.manageRevenueGroups()` at [RevenueGroupList.js:623](src/components/foodCostAnalysis/RevenueGroupList.js#L623)),
  a new route in [src/constants/routes.js](src/constants/routes.js), a stack entry, and a
  simple list screen for create/rename/delete of `revenue_sources`.
- `FoodCostAnalysis` [src/screens/FoodCostAnalysis.js](src/screens/FoodCostAnalysis.js) already
  passes `dateFilter` to the tabs — no change beyond the manage‑sources entry point.

---

## Sync parity checklist (load‑bearing — see CLAUDE.md "Sync Invariants")

- **Schema parity (rule 1):** server `allowedFields` ↔ client columns for both
  `revenue_sources` (`name`) and `revenues.revenue_source_sync_id`.
- **Entity parity (rule 2):** `revenue_sources` present in **both** server `GROUP_A` and
  client `GROUP_A_ENTITIES`; `revenues` `pushFieldMap` extended with the source link.
- **Soft‑delete views (rule 3) / writes (rule 4):** new table joins `DELTA_SYNC_TABLES` →
  `active_revenue_sources` auto‑created; all deletes are soft + `updated_at`.
- **Date convention:** `revenue_group_date` stays LOCAL (business date); `updated_at` UTC;
  `revenue_sources.date_created` UTC default — consistent with existing rows.
- Update CLAUDE.md's delta‑sync table list (and README IDT/sync notes if applicable) to add
  `revenue_sources`.

---

## Verification

1. `npm run lint` and `npm test`.
2. Run the app (`npm run android`). In one branch:
   - Create a Revenue Group with ≥1 category; add internal POS sales for items in those
     categories in the current month.
   - Define 2 external sources; input an amount per source for the group/month.
   - Confirm the accordion breakdown = `sales_total` + per‑source externals = `total_amount`,
     and the tab grand total matches.
   - Confirm item & category **Cost Percentage** now divide by the new total (sales +
     external), and the Reports screens show the same denominator.
   - Edit/delete a per‑source amount and a source; confirm totals recompute.
3. Sync round‑trip: confirm `revenue_sources` and `revenues.revenue_source_id` appear on a
   second device/branch (pull), and locally created sources push (check `synced_at` set).
4. Backward‑compat: a historical month with no `sale_logs` shows external‑only totals
   (unchanged); legacy `revenues` rows with `NULL revenue_source_id` still display.
