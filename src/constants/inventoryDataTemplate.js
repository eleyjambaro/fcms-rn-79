// Fields that are NOT offered when exporting a current-inventory snapshot.
// They are per-purchase-log columns (only meaningful for a new purchase/transfer
// row on import), so they are always left blank on a populated export.
export const IDT_EXPORT_EXCLUDED_FIELDS = [
  'official_receipt_number',
  'remarks',
  'purchase_date',
  'transfer_in_date',
];

// Exportable fields the user MAY deselect on a populated export. Every other
// exportable column is locked-required-on-export (pre-selected and not
// deselectable) — not because the DB requires it, but so the exported IDT
// always carries these values; that lets us verify them when the file is later
// re-imported.
export const IDT_EXPORT_OPTIONAL_FIELDS = [
  'initial_stock_qty', // Total Stock Qty
  'unit_cost', // Unit Cost (Gross)
  'total_cost', // Total Cost (Gross)
  'vendor_name', // Stock Vendor
  'barcode', // Barcode
];

export const normalizeHeader = s =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Recompute which rows the IDT import drops as within-file duplicates. Mirrors
 * `insertTemplateDataToDb` exactly: group by lower(trim(item_name)), the first
 * occurrence is imported, the rest are skipped. Only groups that actually have
 * skipped rows are returned, ordered by first appearance. `rowNumbers` must be
 * aligned with `rows` (the 1-based spreadsheet row of each parsed item).
 *
 * Returns: [{itemName, kept: {row, sourceRow}, skipped: [{row, sourceRow}, ...]}]
 */
export const findDuplicateGroups = (rows, rowNumbers = []) => {
  const groups = new Map();
  const order = [];

  rows.forEach((row, i) => {
    const key = String(row?.item_name ?? '')
      .trim()
      .toLowerCase();
    if (!key) {
      return;
    }

    const occ = {row, sourceRow: rowNumbers[i] ?? i + 1};
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        itemName: String(row?.item_name ?? '').trim(),
        kept: occ,
        skipped: [],
      });
      order.push(key);
    } else {
      existing.skipped.push(occ);
    }
  });

  return order.map(k => groups.get(k)).filter(g => g.skipped.length > 0);
};

export const IDT_COLUMNS = [
  {field: 'count', header: 'Count', required: false, width: 7},
  {
    field: 'category_name',
    header: 'Category Name *',
    required: true,
    width: 18,
    acceptedNormalized: ['category', 'categories'],
  },
  {
    field: 'item_name',
    header: 'Item Name *',
    required: true,
    width: 30,
    acceptedNormalized: ['itemnames'],
  },
  {
    field: 'uom_abbrev',
    header: 'UOM (Abbrev) *',
    required: true,
    width: 15,
    acceptedNormalized: ['uom', 'unitofmeasurement', 'unitofmeasurements'],
  },
  {
    field: 'initial_stock_qty',
    header: 'Total Stock Qty',
    required: false,
    width: 18,
    acceptedNormalized: ['stock', 'totalstock', 'totalstocks'],
  },
  {
    field: 'unit_cost',
    header: 'Unit Cost (Gross)',
    required: false,
    width: 20,
    acceptedNormalized: [
      'unitcost',
      'unitcostincludingtax',
      'unitcosttaxincluded',
      'unitcosttaxinclusive',
    ],
  },
  {
    field: 'total_cost',
    header: 'Total Cost (Gross)',
    required: false,
    width: 20,
    acceptedNormalized: [
      'totalcost',
      'totalcostincludingtax',
      'totalcosttaxincluded',
      'totalcosttaxinclusive',
    ],
  },
  {
    field: 'uom_abbrev_per_piece',
    header: 'UOM Per Piece',
    required: false,
    width: 15,
    acceptedNormalized: ['uomperpiece', 'uomperpackage', 'uomabbrevperpackage'],
  },
  {
    field: 'qty_per_piece',
    header: 'Qty Per Piece / Item Net Wt.',
    required: false,
    width: 30,
    // Each entry is the header text after normalizeHeader() (lowercased,
    // non-alphanumerics stripped). Example: "Qty Per Piece" -> 'qtyperpiece'.
    acceptedNormalized: [
      'qtyperpiece',
      'qtyperpackage',
      'itemnetwt',
      'itemnetweight',
      'netweight',
      'netwt',
    ],
  },
  {field: 'tax_name', header: 'Tax Name', required: false, width: 15},
  {
    field: 'tax_rate_percentage',
    header: 'Tax Rate (%)',
    required: false,
    width: 15,
    acceptedNormalized: ['taxrate', 'taxpercentage'],
  },
  {
    field: 'vendor_name',
    header: 'Stock Vendor',
    required: false,
    width: 20,
    acceptedNormalized: ['vendor', 'vendorname'],
  },
  {
    field: 'official_receipt_number',
    header: 'Stock OR Number',
    required: false,
    width: 20,
    acceptedNormalized: [
      'or',
      'ornum',
      'ornumber',
      'officialreceipt',
      'receipt',
      'receiptnum',
      'receiptofficialnum',
      'receiptofficialnumber',
    ],
  },
  {field: 'remarks', header: 'Remarks', required: false, width: 30},
  {
    field: 'purchase_date',
    header: 'Purchase Date (If new purchase)',
    required: false,
    width: 35,
    acceptedNormalized: ['purchasedate'],
  },
  {
    field: 'transfer_in_date',
    header: 'Transfer In Date (If new transfer)',
    required: false,
    width: 35,
    // Accepts the header even if the user removes the parenthetical hint.
    // "Transfer In Date" -> 'transferindate'.
    acceptedNormalized: ['transferindate'],
  },
  {
    field: 'packaging_type',
    header: 'Packaging Type',
    required: false,
    width: 18,
    acceptedNormalized: ['packaging'],
  },
  {field: 'barcode', header: 'Barcode', required: false, width: 20},
];
