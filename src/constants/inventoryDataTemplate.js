export const normalizeHeader = s =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

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
