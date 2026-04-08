# Plan: Migrate Database from INTEGER IDs to UUID.v4

## Context

The app uses SQLite with INTEGER PRIMARY KEY AUTOINCREMENT for all 39 tables (35 main DB + 4 local account DB) and 18 FK relationships. Cloud sync already uses `sync_id VARCHAR(36)` (UUID) as a parallel identifier, but local queries still rely on integer `id` columns for every join and filter.

The goal is to replace integer `id` columns with UUID TEXT across the entire database so local and cloud identifiers are unified. This must not break:
- App functionality that relies on knowing specific operations by their hardcoded integer IDs (1–11)
- All 18 FK relationships between tables
- Existing user data (data migration required)

---

## Scope Summary (from exploration)

**Hardcoded integer operation ID references:**
- 300+ SQL `CASE WHEN operation_id = N` in `src/localDbQueries/reports.js`
- JS: `operation.id === 1`, `parseInt(log.operation_id) === 11`, etc. in ~8 files
- SQL: `operation_id = 1` in `items.js`, `inventoryLogs.js`, `endingInventory.js`

**parseInt() patterns to fix:**
- `parseInt(taxId) === 0` / `parseInt(vendorId) === 0` — "no selection" sentinel
- `parseInt(operationId) === 1` / `=== 11` — operation identity checks
- `parseInt(id) === value` in filters in `SubRecipeForm.js`, `RecipeForm.js`
- `parseInt(insertId)` after INSERT (no longer needed — UUID is generated before insert)
- `parseInt(values.is_app_default) === 1` — non-ID check, stays as-is or convert to `Boolean()`

**SQLite constraint:** Cannot ALTER COLUMN type — tables must be recreated to change `id` from INTEGER to TEXT.

---

## Critical Files

| File | Role |
|------|------|
| `src/localDb/index.js` | All CREATE TABLE statements + `alterTables()` migration |
| `src/localDbQueries/operations.js` | `inventoryDefaultOperations`, `createInventoryOperation` |
| `src/localDbQueries/reports.js` | 300+ hardcoded `operation_id` SQL comparisons |
| `src/localDbQueries/inventoryLogs.js` | INSERT/UPDATE with operation_id FKs |
| `src/localDbQueries/items.js` | `operation_id = 1` in WHERE clauses |
| `src/localDbQueries/endingInventory.js` | `parseInt(operationId)` in UPDATE |
| `src/localDbQueries/recipes.js` | `parseInt(insertId)` after INSERT |
| `src/localDbQueries/sellingMenus.js` | `parseInt(insertId)` after INSERT |
| `src/localDbQueries/batchPurchase.js` | `parseInt(insertId)` after INSERT |
| `src/components/forms/AddStockForm.js` | Multiple `parseInt(operation_id) === 1` |
| `src/screens/LogView.js` | `parseInt(log.operation_id) === 11/1` |
| `src/components/items/ItemLogDetails.js` | `log.operation_id === 1` |
| `src/components/items/ItemLogListItem.js` | `item.operation_id === 1` |
| `src/components/categories/CategoryInventoryDetailsModal.js` | `operation.id === 1` |
| `src/screens/ItemAddedStocks.js` | `operation.id === 1` |
| `src/screens/Logs.js` | `operation.id === 1` |
| `src/components/forms/SubRecipeForm.js` | `category.id === parseInt(categoryId)` |
| `src/components/forms/RecipeForm.js` | `unit.id === parseInt(uomId)` |

---

## Implementation Plan

### Phase 1: Operations Table — Add `code` Column (Semantic Identifier)

The operations table has hardcoded integer IDs referenced in 300+ places. Rather than replacing all those comparisons with UUID lookups, add a stable `code` TEXT column as the semantic key. This decouples logic from numeric IDs and survives any future ID format change.

**Step 1.1 — Update `inventoryDefaultOperations` in `operations.js`**

Add a `code` field to each entry:
```js
{ id: 1, code: 'pre_app_stock',      type: 'add_stock',    name: `Pre-${...} Stock`, ... }
{ id: 2, code: 'new_purchase',       type: 'add_stock',    name: 'New Purchase', ... }
{ id: 3, code: 'inventory_recount_in', type: 'add_stock',  name: 'Inventory Re-count', ... }
{ id: 4, code: 'stock_transfer_in',  type: 'add_stock',    name: 'Stock Transfer In', ... }
{ id: 5, code: 'initial_stock',      type: 'remove_stock', name: 'Initial Stock', ... }
{ id: 6, code: 'stock_usage',        type: 'remove_stock', name: 'Stock Usage', ... }
{ id: 7, code: 'inventory_recount_out', type: 'remove_stock', name: 'Inventory Re-count', ... }
{ id: 10, code: 'stock_transfer_out', type: 'remove_stock', name: 'Stock Transfer Out', ... }
{ id: 11, code: 'new_yield_stock',   type: 'add_stock',    name: 'New Yield Stock', ... }
```

**Step 1.2 — Update CREATE TABLE for `operations` in `localDb/index.js`**

Add `code VARCHAR(100) DEFAULT NULL` column to the operations table schema.

**Step 1.3 — Migration: `ALTER TABLE operations ADD COLUMN code`**

Add to `alterTables()` (or a new migration block):
```sql
ALTER TABLE operations ADD COLUMN code VARCHAR(100) DEFAULT NULL;
UPDATE operations SET code = 'pre_app_stock' WHERE id = 1;
UPDATE operations SET code = 'new_purchase' WHERE id = 2;
-- etc. for all 9 default operations
```

**Step 1.4 — Update `createInventoryOperation()` to INSERT `code`**

The INSERT query in `operations.js:96` must include the `code` column.

**Step 1.5 — Migrate all SQL comparisons in `reports.js`, `items.js`, `inventoryLogs.js`, `endingInventory.js`**

Replace every `operation_id = 1` with `operation_id IN (SELECT id FROM operations WHERE code = 'pre_app_stock')`, or (better) JOIN to the operations table and filter by code:
```sql
-- Before:
CASE WHEN operation_id = 1 THEN ...
-- After:
CASE WHEN op.code = 'pre_app_stock' THEN ...
-- (requires adding: LEFT JOIN operations op ON op.id = inventory_logs.operation_id)
```

**Step 1.6 — Migrate all JS comparisons**

Export a constants map from `operations.js`:
```js
export const OPERATION_CODES = {
  PRE_APP_STOCK: 'pre_app_stock',
  NEW_PURCHASE: 'new_purchase',
  // ...
};
```

Replace in all component/screen files:
- `operation.id === 1` → `operation.code === OPERATION_CODES.PRE_APP_STOCK`
- `parseInt(log.operation_id) === 11` → `log.operation_code === OPERATION_CODES.NEW_YIELD_STOCK`
  - Note: `inventory_logs` stores `operation_id` (FK), not `code` directly, so either JOIN when querying or add `operation_code` denormalized column to inventory_logs

---

### Phase 2: Schema Migration — INTEGER id → UUID TEXT for All Tables

**Step 2.1 — Pre-INSERT UUID generation pattern**

All INSERT functions currently use SQLite's `insertId` after insert. Change to:
1. Generate `const newId = uuid.v4()` before INSERT
2. Include `id = '${newId}'` in INSERT
3. Return `newId` directly (no more `result[0].insertId`)

This affects: `recipes.js`, `sellingMenus.js`, `batchPurchase.js`, `batchStockUsage.js`, and every other `localDbQueries/*.js` file.

**Step 2.2 — Table recreation migration**

SQLite cannot ALTER COLUMN, so each table must be recreated. The migration runs once at app startup (version-gated):

For each table:
```sql
-- 1. Create new table with id TEXT PRIMARY KEY
CREATE TABLE IF NOT EXISTS items_new (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT,  -- updated FK type
  ...
);
-- 2. Migrate data: generate UUID for each existing row, propagate FKs
-- 3. Drop old table, rename new
```

**Critical: FK propagation order**

Migrate tables in dependency order (parents before children):
1. `categories`, `taxes`, `vendors`, `recipe_kinds` (no FK deps within main DB)
2. `items` (refs categories, taxes, vendors, recipes — but recipes refs items via recipe_id, so careful)
3. `recipes`, `ingredients` (refs items, recipe_kinds)
4. `modifiers`, `modifier_options` (refs items, modifiers)
5. `selling_menus`, `selling_menu_items` (refs items, modifiers)
6. `batch_purchase_groups`, `batch_purchase_entries` (refs items, taxes, vendors)
7. `batch_stock_usage_groups`, `batch_stock_usage_entries` (refs items)
8. `invoices`, `sale_logs`, `sales_orders`, `payments`, `refunds`
9. `inventory_logs` (refs operations, items, recipes, batch_purchase_groups, invoices)
10. `spoilages`, `revenue_groups`, `revenues`, `expenses`, `expense_groups`, etc.
11. `operations` (standalone, no FK deps)
12. Local account DB: `roles`, `companies`, `accounts`, `settings`

**Migration data mapping approach:**

Use a temporary mapping table during migration:
```sql
CREATE TABLE _id_map (table_name TEXT, old_id INTEGER, new_id TEXT);
-- Populate per-table, then use in JOIN to propagate FKs
```

**Step 2.3 — `sync_id` consolidation**

Since delta sync tables already have `sync_id`, for those tables: use the existing `sync_id` as the new UUID `id` (avoids generating duplicate UUIDs). Migration maps old integer `id` → existing `sync_id` value where available.

For rows where `sync_id IS NULL` (non-sync tables, or rows created before sync was added), generate new `uuid.v4()`.

**Step 2.4 — Operations table special: deterministic UUIDs**

The 9 default operations must have fixed (not random) UUIDs so the codebase can reference them as constants if needed. Define them in `operations.js`:
```js
export const OPERATION_IDS = {
  PRE_APP_STOCK: '00000000-0001-4000-a000-000000000001',
  NEW_PURCHASE:  '00000000-0001-4000-a000-000000000002',
  // ...
};
```
During migration, assign these fixed UUIDs to the default operations (where `is_app_default = 1`).

---

### Phase 3: Fix parseInt() and ID Comparison Patterns

**Step 3.1 — "No selection" sentinel: `parseInt(taxId) === 0`**

The pattern `parseInt(taxId) === 0` is used when a dropdown has a "none" option with value `0`. Replace with:
- `!taxId` (covers null, undefined, '', '0')
- Or use `null` as the "no selection" value explicitly

Files: `AddStockForm.js:354,394`, `inventoryLogs.js:302,329`, `items.js:906,955,1020,1067`

**Step 3.2 — Operation identity checks**

After Phase 1 lands `code` column:
- `parseInt(log.operation_id) === 11` → `log.operation_code === 'new_yield_stock'`
- `operation.id === 1` → `operation.code === 'pre_app_stock'`

**Step 3.3 — Filter comparisons: `parseInt(categoryId)`**

`SubRecipeForm.js:114`: `category.id === parseInt(categoryId)` → `category.id === categoryId`
`RecipeForm.js:140`: `unit.id === parseInt(uomId)` → `unit.id === uomId`

After UUID migration, IDs are strings — remove parseInt calls and ensure both sides of comparison are strings.

**Step 3.4 — insertId removal**

`recipes.js:182`, `sellingMenus.js:172`, `batchPurchase.js:1108`, etc.:
- Remove `parseInt(createRecipeResult[0].insertId)` 
- Use the pre-generated UUID directly

**Step 3.5 — toString() form initializers**

`ItemForm.js:1208-1231`, `AddStockForm.js:640-667`: `.toString()` calls on integer IDs become no-ops once IDs are strings — safe to keep (strings have `.toString()`) but can be cleaned up.

**Step 3.6 — `is_app_default` and `voided` parseInt checks**

`parseInt(values.is_app_default) === 1`, `parseInt(log.voided) === 1` — these are NOT ID columns, they are boolean-like integers. Keep `parseInt()` or convert to `Number()` / `Boolean()`. These are out of scope for UUID migration.

---

## Rollout Order

1. **Phase 1** (Operations `code` column) — safest first; adds new column, doesn't change IDs yet
2. **Phase 3.1** (parseInt sentinel fixes) — independent cleanup, low risk  
3. **Phase 2** (UUID schema migration) — highest risk, requires careful migration + testing
4. **Phase 3.2–3.5** (remaining parseInt/comparison cleanup) — cleanup after Phase 2

---

## Key Reusable Utilities

- `uuid.v4()` — already imported in 19 query files via `react-native-uuid`
- `alterTables()` in `src/localDb/index.js` — existing migration hook to extend
- `getDBConnection()` / `getCloudSyncParams()` — existing helpers in `src/localDb/`

---

## Verification

1. **Operations display**: Open Manage Stock → Add Stock → verify all operation types appear and are selectable
2. **Inventory logs**: Add stock, remove stock; verify logs record with correct operation displayed
3. **Reports**: Open any report (food cost, purchase summary) — verify operation-based breakdowns show correct figures
4. **Batch purchase/sell**: Create a batch purchase, complete it; verify inventory adjustments
5. **Sales counter**: Complete a sale; verify sale_logs, invoice, and payments created with correct FK linkage
6. **Cloud sync**: Push/pull delta; verify sync_id-based upsert still works correctly
7. **Log view**: Open a yield stock log; verify it shows correct operation name and related actions
