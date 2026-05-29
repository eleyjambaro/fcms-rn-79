# Export Inventory as IDT

## Context

The Account screen's Inventory Data Template (IDT) section currently offers "Download Empty Inventory Data Template" (a blank Excel template the user populates by hand) and "Import Inventory Data Template" (reads a populated template back into the local DB). The third leg — exporting the current branch's inventory **in IDT format** so the same file can be round-tripped through the import flow — is missing. There is already a commented-out drawer entry for it ([Account.js:1094-1098](src/screens/Account.js#L1094-L1098)) and a partially-wired confirmation dialog/permission state, so the placeholder was clearly intentional.

This change finishes that placeholder: it lets the user pick which IDT columns to include (required ones locked-on), then downloads an `.xlsx` file with one row per active item, populated from the local SQLite DB. The output must remain a valid IDT — re-importing it via "Import Inventory Data Template" reproduces the same items on another branch/device.

## Approach

Mirror the existing "Download Empty Inventory Data Template" flow:

1. Drawer item → permission check → confirmation dialog → modal with file-name + column picker → write `.xlsx` to `RNFS.DownloadDirectoryPath` → success/failure dialog.
2. Reuse the existing `exportInvDataTemplateDialogVisible`, `exportNeedPermissionDialogVisible`, `exportSuccessDialogVisible`, and `exportFailedDialogVisible` state — they were added for exactly this flow and are unused today.
3. Reuse `IDT_COLUMNS` as the single source of truth for both headers and which fields each item maps to (already established convention; see [CLAUDE.md IDT section](CLAUDE.md)).
4. Build a small extension to `SelectionButtonList` so required columns render as "selected + disabled" chips, since the user requirement is that required columns cannot be unselected.

## Files to modify

### 1. [src/localDbQueries/items.js](src/localDbQueries/items.js)

Add a new exported function `getAllItemsForExport()` that returns **all** active items in one shot (no pagination) with the joined data needed for IDT export. Mirror the SELECT in `getItems` so stock/cost figures come from `active_inventory_logs` (this is what the user specifically asked for — accuracy must come from inventory logs, **not** the static `items.unit_cost`).

```js
// New function, alongside existing getItems
export const getAllItemsForExport = async () => { ... }
```

Required fields per row (all derivable from one query):

- `items.name`, `items.uom_abbrev`, `items.uom_abbrev_per_piece`, `items.qty_per_piece`, `items.packaging_type`, `items.barcode`
- `categories.name AS category_name` — **add `LEFT JOIN active_categories categories ON categories.id = items.category_id`** (not present in the current `getItems`)
- `taxes.name AS tax_name`, `taxes.rate_percentage AS tax_rate_percentage` — already done via `LEFT JOIN taxes` in `getItems`
- `vendors.vendor_display_name AS vendor_name` — **add `LEFT JOIN active_vendors vendors ON vendors.id = items.preferred_vendor_id`** (not present today; importer writes to `items.preferred_vendor_id`)
- `current_stock_qty`, `current_stock_cost`, `avg_unit_cost` — copy the `inventory_logs_added_and_removed_totals` subquery + COALESCE wrappers from `getItems` ([items.js:64-98](src/localDbQueries/items.js#L64-L98), [items.js:100-132](src/localDbQueries/items.js#L100-L132)). These already use `active_inventory_logs` and the NULLIF/COALESCE fallback pattern.

No `LIMIT`/`OFFSET`. No `queryFilter` (we want every item).

**Why a new function instead of extending `getItems`:** `getItems` is consumed across the app with React Query infinite scroll and a hardcoded `limit=10`; widening its joins or removing pagination has too much blast radius. A dedicated read-only export query is the right shape.

### 2. [src/components/buttons/SelectionButtonList.js](src/components/buttons/SelectionButtonList.js)

Add a single backward-compatible prop:

```js
const { ..., disabledValues = [] } = props;
```

- A value listed in `disabledValues` is rendered as always-selected (initial `value` should include it) and `onPress` becomes a no-op for those chips.
- Pass `disabled` to the `Chip` so it gets the standard react-native-paper disabled visual.

All existing callers ignore the new prop and behave identically.

### 3. [src/components/forms/InventoryDataTemplateFileExportForm.js](src/components/forms/InventoryDataTemplateFileExportForm.js)

Add a `mode` prop with two values: `'empty'` (default, current behavior) and `'populated'` (new). Branch the second section:

- `mode='empty'`: render the existing "Select an additional guide worksheet…" section unchanged. Initial values: `{ sheets: [] }`.
- `mode='populated'`: render a new "Select columns to include in the export:" section using `SelectionButtonList` (`selectMany`) populated from `IDT_COLUMNS`, with two filters:
  - **Skip per-log columns** that can't be meaningfully populated per-item: `official_receipt_number`, `remarks`, `purchase_date`, `transfer_in_date` (user-confirmed).
  - **Required columns** (those with `required: true` — `category_name`, `item_name`, `uom_abbrev`) are passed via the new `disabledValues` prop and pre-selected in `defaultValue`.
  - `count` is shown as an optional toggleable chip (default off — same as the empty template, it's a display-only row counter).
  - Selected columns go into a new Formik field `columns: string[]` (array of `IDT_COLUMNS[i].field`).

Form `initialValues` for `'populated'` mode: `{ fileName: <default>, columns: <required field names> }`.

### 4. [src/screens/Account.js](src/screens/Account.js)

Five small additions, all following patterns already in this file:

**a. Drawer item.** Uncomment [Account.js:1094-1098](src/screens/Account.js#L1094-L1098) and rename label to `"Export Inventory as IDT"`. The handler `handlePressExportInvDataTemplate` is already wired at [Account.js:828-878](src/screens/Account.js#L828-L878) and gates on `enableExportInventoryDataTemplate` from `getAppConfig()`.

**b. New visibility state.** Add one new state next to the existing IDT state block ([Account.js:130-167](src/screens/Account.js#L130-L167)):

```js
const [exportPopulatedOptionsModalVisible, setExportPopulatedOptionsModalVisible] = useState(false);
```

The other IDT-export state (`exportInvDataTemplateDialogVisible`, `exportNeedPermissionDialogVisible`, `exportSuccessDialogVisible`, `exportFailedDialogVisible`, `isFileExportLoading`) is already declared and unused — wire those up rather than creating duplicates.

**c. Confirmation dialog "Next" wiring.** Update the existing dialog at [Account.js:2024-2049](src/screens/Account.js#L2024-L2049) so its `Next` button opens the new columns modal:

```js
onPress={() => {
  setExportPopulatedOptionsModalVisible(() => true);
  setExportInvDataTemplateDialogVisible(() => false);
}}
```

**d. New modal.** Add a `Portal`/`Modal` near the existing export modal at [Account.js:2111-2121](src/screens/Account.js#L2111-L2121):

```jsx
<Portal>
  <Modal
    visible={exportPopulatedOptionsModalVisible}
    onDismiss={() => setExportPopulatedOptionsModalVisible(() => false)}
    contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
    <Title style={{marginBottom: 15, textAlign: 'center'}}>
      Export Inventory as IDT
    </Title>
    <InventoryDataTemplateFileExportForm
      mode="populated"
      initialValues={{ fileName: `${appDefaults.appDisplayName}_Inventory_${<yyyy-mm-dd>}`, columns: <required fields> }}
      submitButtonTitle="Download"
      onSubmit={exportInventoryAsIdt}
      onCancel={() => setExportPopulatedOptionsModalVisible(() => false)}
    />
  </Modal>
</Portal>
```

**e. New `exportInventoryAsIdt(values)` function.** Sibling to `downloadEmptyInventoryDataTemplate` at [Account.js:407-496](src/screens/Account.js#L407-L496). Structure:

```js
const exportInventoryAsIdt = async values => {
  try {
    const items = await getAllItemsForExport();
    const selectedColumns = IDT_COLUMNS.filter(c => values.columns.includes(c.field));

    // header row
    const headerRow = selectedColumns.map(c => c.header);

    // data rows
    const dataRows = items.map((item, idx) => selectedColumns.map(c => {
      switch (c.field) {
        case 'count': return String(idx + 1);
        case 'category_name': return item.category_name ?? '';
        case 'item_name': return item.name ?? '';
        case 'uom_abbrev': return item.uom_abbrev ?? '';
        case 'initial_stock_qty': return item.current_stock_qty ?? 0;
        case 'unit_cost': return item.avg_unit_cost ?? 0;  // gross moving WA from inventory_logs
        case 'total_cost': return item.current_stock_cost ?? 0;  // sum of (qty * unit_cost) from inventory_logs
        case 'uom_abbrev_per_piece': return item.uom_abbrev_per_piece ?? '';
        case 'qty_per_piece': return item.qty_per_piece ?? '';
        case 'tax_name': return item.tax_name ?? '';
        case 'tax_rate_percentage': return item.tax_rate_percentage ?? '';
        case 'vendor_name': return item.vendor_name ?? '';
        case 'packaging_type': return item.packaging_type ?? '';
        case 'barcode': return item.barcode ?? '';
        default: return '';
      }
    }));

    // build workbook + write to file — copy pattern from downloadEmptyInventoryDataTemplate
    const workbook = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    ws['!cols'] = selectedColumns.map(c => ({wch: c.width}));
    XLSX.utils.book_append_sheet(workbook, ws, `${appDefaults.appDisplayName}_Items`);
    const wbout = XLSX.write(workbook, {type: 'binary', bookType: 'xlsx'});
    const filepath = RNFS.DownloadDirectoryPath + `/${values.fileName}.xlsx`;
    await RNFS.writeFile(filepath, wbout, 'ascii');

    setExportPopulatedOptionsModalVisible(() => false);
    setExportSuccessDialogVisible(() => true);
  } catch (error) {
    console.debug(error);
    setExportPopulatedOptionsModalVisible(() => false);
    setExportFailedDialogVisible(() => true);
  }
};
```

**Why `avg_unit_cost` for `unit_cost` and `current_stock_cost` for `total_cost`:** The user explicitly called this out — `items.unit_cost` is the *last saved* unit cost and is misleading. `avg_unit_cost` is the moving weighted average computed from `active_inventory_logs` (gross, with VAT-stripped fallback for items with no logs), and `current_stock_cost` is `total_added_stock_cost − total_removed_stock_cost`. These two figures are internally consistent: `avg_unit_cost × current_stock_qty ≈ current_stock_cost`. Both already exist on `getItems`'s output and the COALESCE fallback guarantees no NULLs.

## Why per-log columns (OR number, remarks, purchase/transfer dates) are hidden

A single item has many `inventory_logs` rows (one per purchase, transfer, usage, etc.) — there is no canonical per-item OR number or remarks string. Including them as blank columns would either invite confused user reports ("why are these empty?") or, worse, picking a single log's value would mis-represent the data. The exported file still imports cleanly: the IDT importer treats missing optional headers as empty strings and creates an `initial_stock` log when `purchase_date`/`transfer_in_date` are absent ([inventoryDataTemplate.js importer logic](src/localDbQueries/inventoryDataTemplate.js)).

## Verification

1. `npm start` then `npm run android` (or iOS), sign in to a branch that already has several items including: items with stock, items without stock, items with a tax, items with a vendor, items in different categories.
2. Account → IDT section → **Export Inventory as IDT** appears.
3. Tap it → confirmation dialog appears with the existing copy.
4. Tap **Next** → modal opens with file-name input pre-filled and the column picker. Verify:
   - The three required chips (`Category Name *`, `Item Name *`, `UOM (Abbrev) *`) are pre-selected and tapping them does nothing.
   - All other optional chips toggle on/off (except the four per-log fields, which should NOT appear).
   - The `Download` button is disabled until the form is dirty + valid.
5. Tap **Download** → success dialog appears → tap **View Downloads** → pick the file.
6. Open the file: verify exactly one row per active item, headers match selected columns, required-column values are populated, `Total Stock Qty` matches the Items screen's stock badge, `Unit Cost (Gross)` matches the moving WA seen in item details (not the static configured cost when they differ).
7. **Round-trip:** on a freshly registered second branch, IDT → **Import Inventory Data Template** → pick the exported file → verify items, categories, taxes, and vendors are created and stock matches.
8. Edge cases to spot-check:
   - Branch with zero items → either disable the action or export a header-only file (current plan: header-only file, since blocking is over-engineering).
   - Item with `current_stock_qty = 0` → `initial_stock_qty` exports as `0` and `total_cost` as `0`; importer should still create the item.
   - Item with no tax / no vendor → corresponding columns are blank.
