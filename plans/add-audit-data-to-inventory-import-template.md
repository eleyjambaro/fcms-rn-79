# Audit IDT imports + show import provenance on inventory logs

## Context

Currently, when a user imports an Inventory Data Template (IDT) — Excel file with categories, items, taxes, vendors, and per-item initial stock — the import creates `inventory_logs` rows (one per imported item) but there is no record of the import event itself. We cannot tell: which logs came from which import, who imported them, when, and we cannot distinguish IDT-originated logs from manually entered ones.

This change introduces a new branch-scoped audit table `inventory_data_template_imports` (delta-synced) that records each IDT import event, and threads its id into every `inventory_logs` row created by that import via a new `idt_import_id` FK column. The Inventory Operation Logs UI then surfaces IDT provenance:

- a small icon on each log list item indicating "imported via IDT"
- an `(import via IDT)` subtext next to the quantity on the log detail view
- a new `Import Details` section on the log detail view — modeled after the existing `Yield Details` section but with a real table relation (showing import date and importing account) rather than just the bare id

The same data is synced to fcms-api so every device in the branch can see the same import history.

---

## Schema

### Client — [src/localDb/index.js](src/localDb/index.js)

**New table** `inventory_data_template_imports` (add a new `createInventoryDataTemplateImportsTableQuery` const, paired with `master_items` since it follows the same audit-stamp pattern):

```sql
CREATE TABLE IF NOT EXISTS inventory_data_template_imports (
  id TEXT PRIMARY KEY NOT NULL,
  imported_by_account_id VARCHAR,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  device_id VARCHAR DEFAULT NULL,
  branch_id VARCHAR DEFAULT NULL,
  sync_id VARCHAR(36) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  synced_at DATETIME DEFAULT NULL,
  is_deleted INTEGER DEFAULT 0
);
```

Wire-up in `createTables()` at [src/localDb/index.js:1211-1263](src/localDb/index.js#L1211-L1263) — `await db.executeSql(createInventoryDataTemplateImportsTableQuery);` next to the master_items call at line 1227.

Add to `DELTA_SYNC_TABLES` at [src/localDb/index.js:1163-1195](src/localDb/index.js#L1163-L1195). This automatically creates the `active_inventory_data_template_imports` view via `createViews()` at line 1197.

**New column on `inventory_logs`** — `idt_import_id VARCHAR DEFAULT NULL`. Added in `alterTables()` via `executeSqlIfColumnNotExist` (mirror the master_items column pattern around [src/localDb/index.js:1900-1932](src/localDb/index.js#L1900-L1932)):

```js
await executeSqlIfColumnNotExist(
  db,
  'inventory_logs',
  'idt_import_id',
  `ALTER TABLE inventory_logs ADD COLUMN idt_import_id VARCHAR DEFAULT NULL;`,
);
```

Reasoning on naming: keep the local column as `idt_import_id` (matches the local table id, follows `*_id` convention). The push step remaps it to `idt_import_sync_id` for the server (see sync section).

### Server — [fcms-api/src/database/migrations/](../fcms-api/src/database/migrations/)

Two new migration files (next available number after `2024_01_01_000020_add_dedup_key_to_master_items_table.php`):

1. **`2024_01_01_000021_create_inventory_data_template_imports_table.php`** — mirror [`2024_01_01_000017_create_master_items_table.php`](../fcms-api/src/database/migrations/2024_01_01_000017_create_master_items_table.php), but branch-scoped (not company-scoped like master_items):

```php
Schema::create('inventory_data_template_imports', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('sync_id', 36)->unique();
    $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
    $table->foreignUuid('branch_id')->constrained('branches')->cascadeOnDelete();
    $table->string('device_id', 36)->nullable();
    $table->string('imported_by_account_id', 36)->nullable();
    $table->timestamp('imported_at')->nullable();
    $table->tinyInteger('is_deleted')->default(0);
    $table->timestamp('updated_at')->nullable();
    $table->timestamp('created_at')->nullable();
});
```

2. **`2024_01_01_000022_alter_inventory_logs_add_idt_import_sync_id.php`** — add nullable indexed column to `inventory_logs`:

```php
Schema::table('inventory_logs', function (Blueprint $table) {
    $table->string('idt_import_sync_id', 36)->nullable()->index();
});
```

**New model** [`fcms-api/src/app/Models/Sync/InventoryDataTemplateImport.php`](../fcms-api/src/app/Models/Sync/InventoryDataTemplateImport.php) — mirror [`MasterItem.php`](../fcms-api/src/app/Models/Sync/MasterItem.php):

```php
class InventoryDataTemplateImport extends SyncModel
{
    protected $table = 'inventory_data_template_imports';
    protected $fillable = [
        'sync_id', 'company_id', 'branch_id', 'device_id',
        'imported_by_account_id', 'imported_at',
        'is_deleted', 'updated_at', 'created_at',
    ];
}
```

---

## IDT import flow — write the parent record, thread the id

[src/localDbQueries/inventoryDataTemplate.js](src/localDbQueries/inventoryDataTemplate.js)

Reuse the existing `loadCurrentAccountId` helper at [src/localDbQueries/inventoryDataTemplate.js:23-33](src/localDbQueries/inventoryDataTemplate.js#L23-L33) — it already reads `account.id` from secure storage and returns null when unsigned (kept nullable for backward compatibility, matching the `registered_by_account_id` precedent).

In `insertTemplateDataToDb()` at [src/localDbQueries/inventoryDataTemplate.js:213](src/localDbQueries/inventoryDataTemplate.js#L213):

1. Near the top (after `getCloudSyncParams()` at line 222), generate the import id and insert the parent row **once per import call** — before any inventory_logs are inserted:

```js
const idtImportId = uuid.v4();
const importedByAccountId = await loadCurrentAccountId();
const insertImportQuery = `
  INSERT INTO inventory_data_template_imports (
    id, imported_by_account_id, imported_at,
    device_id, branch_id, sync_id, updated_at
  ) VALUES (
    '${idtImportId}',
    ${importedByAccountId ? `'${importedByAccountId}'` : 'NULL'},
    CURRENT_TIMESTAMP,
    ${deviceId ? `'${deviceId}'` : 'NULL'},
    ${branchId ? `'${branchId}'` : 'NULL'},
    '${idtImportId}',
    CURRENT_TIMESTAMP
  );
`;
await db.executeSql(insertImportQuery);
```

2. In the inventory_logs bulk insert at [src/localDbQueries/inventoryDataTemplate.js:1444-1599](src/localDbQueries/inventoryDataTemplate.js#L1444-L1599):
   - Add `idt_import_id` to the column list (line 1445-1466)
   - Add `'${idtImportId}'` as the value for every row (line 1568-1589)

The same `idtImportId` is stamped on **every** `inventory_logs` row produced by this single `insertTemplateDataToDb` call regardless of operation type (initial_stock / new_purchase / stock_transfer_in) — they were all created by the same import event.

---

## UI — surface IDT provenance

### List item icon — [src/components/items/ItemLogListItem.js](src/components/items/ItemLogListItem.js)

Add `renderIdtImportIcon()` mirroring `renderRemarksIcon()` at [src/components/items/ItemLogListItem.js:53-64](src/components/items/ItemLogListItem.js#L53-L64):

```jsx
const renderIdtImportIcon = () => {
  if (item.idt_import_id) {
    return (
      <MaterialCommunityIcons
        style={{marginLeft: 8}}
        name="file-import-outline"
        size={18}
        color={colors.primary}
      />
    );
  }
};
```

Render it in the header row right after `{renderRemarksIcon()}` at [src/components/items/ItemLogListItem.js:230](src/components/items/ItemLogListItem.js#L230).

### Quantity subtext — [src/components/items/ItemLogDetails.js](src/components/items/ItemLogDetails.js)

In the qty Subheading at [src/components/items/ItemLogDetails.js:332-343](src/components/items/ItemLogDetails.js#L332-L343), add an `(import via IDT)` Text after `renderRemovedStockQtySubtext()` when `log.idt_import_id` is set — same styling pattern as `renderRemovedStockQtySubtext` at [src/components/items/ItemLogDetails.js:224-240](src/components/items/ItemLogDetails.js#L224-L240).

### Import Details section — [src/components/items/ItemLogDetails.js](src/components/items/ItemLogDetails.js)

Mirror `renderYieldDetails()` at [src/components/items/ItemLogDetails.js:174-222](src/components/items/ItemLogDetails.js#L174-L222), but show three rows instead of just the bare id (this is the "slightly different" the user called out — Import Details has a real table relation):

- **Import ID**: `idtImport.sync_id` (use sync_id for display since it is the stable cross-device identifier)
- **Imported At**: `moment(idtImport.imported_at).format('MMM DD, YYYY hh:mm A')`
- **Imported By**: account name lookup (see data fetch below) — falls back to the raw account id when name unavailable

Render between Yield Details and Remarks at [src/components/items/ItemLogDetails.js:535-538](src/components/items/ItemLogDetails.js#L535-L538). Conditional on `idtImport != null`. Use a fitting icon (e.g. `file-import-outline`).

### Data fetch for Import Details — [src/localDbQueries/inventoryLogs.js](src/localDbQueries/inventoryLogs.js)

Extend `getInventoryLog` at [src/localDbQueries/inventoryLogs.js:136-196](src/localDbQueries/inventoryLogs.js#L136-L196):

- Add `inventory_logs.idt_import_id` to the SELECT
- After the existing SELECT, if `idt_import_id` is non-null, run a second small lookup:

```sql
SELECT id, sync_id, imported_by_account_id, imported_at
FROM active_inventory_data_template_imports
WHERE id = ?
LIMIT 1
```

Return `{result, idtImport}` (where `idtImport` is null when there is no link). Use the `active_` view so soft-deleted parent imports are hidden (the inventory_logs themselves are still shown).

In [src/screens/LogView.js](src/screens/LogView.js) (where `getInventoryLog` is consumed), pass the resolved `idtImport` down to `ItemLogDetails` as a prop, alongside the existing `log` prop.

**Account name resolution**: Account id-to-name lookup mirrors however the app already resolves `adjusted_by_account_uid` or `sold_by_account_uid` elsewhere. If no existing mechanism exists in this client, render the raw id — keep this change scoped; do not introduce a new account-fetch dependency.

---

## Sync registration

### Client — [src/services/syncService.js](src/services/syncService.js)

Add to `GROUP_A_ENTITIES` at [src/services/syncService.js:41-195](src/services/syncService.js#L41-L195) (placed near master_items in the catalog/master section since it's branch-scoped audit metadata — no FK remapping needed, account ids are not sync_ids):

```js
{key: 'inventory_data_template_imports', table: 'inventory_data_template_imports'},
```

Extend the `inventory_logs` entry at [src/services/syncService.js:184-194](src/services/syncService.js#L184-L194) to remap the new FK:

```js
{
  key: 'inventory_logs',
  table: 'inventory_logs',
  pushFieldMap: {
    operation_id: 'operation_sync_id',
    item_id: 'item_sync_id',
    recipe_id: 'recipe_sync_id',
    batch_purchase_group_id: 'batch_purchase_group_sync_id',
    invoice_id: 'invoice_sync_id',
    idt_import_id: 'idt_import_sync_id',  // ← new
  },
},
```

### Server — [fcms-api/src/app/Http/Controllers/SyncController.php](../fcms-api/src/app/Http/Controllers/SyncController.php)

Add the import to the `use` block at [SyncController.php:1-43](../fcms-api/src/app/Http/Controllers/SyncController.php#L1-L43): `use App\Models\Sync\InventoryDataTemplateImport;`

Add to `GROUP_A` at [SyncController.php:55-90](../fcms-api/src/app/Http/Controllers/SyncController.php#L55-L90):

```php
'inventory_data_template_imports' => [InventoryDataTemplateImport::class, [
    'imported_by_account_id', 'imported_at',
    'is_deleted', 'updated_at', 'created_at'
]],
```

Extend the `inventory_logs` entry on line 89 to include `'idt_import_sync_id'` in allowed fields.

This satisfies the schema-parity invariant (CLAUDE.md sync rule 1) and entity-parity invariant (rule 2).

---

## Files to modify

**Client**:
- [src/localDb/index.js](src/localDb/index.js) — new table create, new column alter, DELTA_SYNC_TABLES add
- [src/localDbQueries/inventoryDataTemplate.js](src/localDbQueries/inventoryDataTemplate.js) — insert parent record, thread id into inventory_logs insert
- [src/localDbQueries/inventoryLogs.js](src/localDbQueries/inventoryLogs.js) — extend `getInventoryLog` to fetch idtImport
- [src/screens/LogView.js](src/screens/LogView.js) — pass idtImport to ItemLogDetails
- [src/components/items/ItemLogListItem.js](src/components/items/ItemLogListItem.js) — add list item icon
- [src/components/items/ItemLogDetails.js](src/components/items/ItemLogDetails.js) — qty subtext + Import Details section
- [src/services/syncService.js](src/services/syncService.js) — register new entity + extend inventory_logs pushFieldMap

**Server** (fcms-api):
- `src/database/migrations/2024_01_01_000021_create_inventory_data_template_imports_table.php` (new)
- `src/database/migrations/2024_01_01_000022_alter_inventory_logs_add_idt_import_sync_id.php` (new)
- `src/app/Models/Sync/InventoryDataTemplateImport.php` (new)
- `src/app/Http/Controllers/SyncController.php` — import + GROUP_A entry + extend `inventory_logs` allowedFields

---

## Verification

1. **Migration runs cleanly on existing DB**: sign into an existing branch (uses an existing `FCMS_<companyId>_<branchId>.db`) and confirm via `PRAGMA table_info(inventory_logs)` (or by inspecting `__DEV__` console) that `idt_import_id` was added and `inventory_data_template_imports` table exists with the `active_` view.

2. **End-to-end import**: import a sample `.xlsx` IDT via Account → Import Inventory Data Template. Confirm:
   - One new row in `inventory_data_template_imports` with `imported_by_account_id` matching the signed-in cloud account and `imported_at` ~ now
   - Every `inventory_logs` row created by this import has `idt_import_id` set to that row's id
   - Logs from earlier (pre-change) imports have `idt_import_id IS NULL` (column nullable)

3. **UI on Inventory Operation Logs screen**:
   - List items from the new import show the IDT icon next to the remarks icon
   - Logs from pre-change imports do NOT show the icon
   - Tap a new-import log → detail screen shows `4.00 Pieces (import via IDT)` next to qty
   - `Import Details` section renders below `Transaction Details`, with Import ID / Imported At / Imported By rows
   - Tap a pre-change log → no IDT subtext, no Import Details section, existing behavior intact
   - Tap a yield log → existing `Yield Details` still renders unchanged

4. **Sync round-trip**:
   - On Device A: import an IDT. Confirm `runSync()` pushes both `inventory_data_template_imports` and the linked `inventory_logs` rows (check server DB: `inventory_data_template_imports` has the row, `inventory_logs.idt_import_sync_id` is populated)
   - On Device B in the same branch: pull, then open Inventory Operation Logs. The IDT icon and Import Details section appear on the logs pulled from Device A.

5. **Lint and unit tests**: `npm run lint`, `npm test`. On the server: `php artisan migrate` runs both new migrations successfully and `php artisan test` passes.
