import commaNumber from 'comma-number';
import XLSX from 'xlsx';
import moment from 'moment';

import {formatUOMAbbrev} from '../../utils/stringHelpers';
import appDefaults from '../../constants/appDefaults';

export const createInventoryOperationsReportWorksheet = ({
  selectedMonthAndYear,
  currencySymbol,
  itemsMonthlyReportData,
  itemsMonthlyReportGrandTotalData,
  totalItemsData,
  totalCategoriesData,
}) => {
  let itemsDataToExport = itemsMonthlyReportData?.result;
  let itemsGrandTotalData = itemsMonthlyReportGrandTotalData?.totals;
  const currentDate = moment(new Date()).format('MMMM DD, YYYY, hh:mma');

  const selectedMonthAllItemsTotalCost =
    itemsGrandTotalData?.selectedMonthAllItemsTotalCost || 0;
  const selectedMonthAllItemsTotalCostNet =
    itemsGrandTotalData?.selectedMonthAllItemsTotalCostNet || 0;
  const selectedMonthAllItemsTotalCostTax =
    itemsGrandTotalData?.selectedMonthAllItemsTotalCostTax || 0;

  const wholeMonthAllItemsTotalAddedStockCost =
    itemsGrandTotalData?.wholeMonthAllItemsTotalAddedStockCost || 0;
  const wholeMonthAllItemsTotalAddedStockCostNet =
    itemsGrandTotalData?.wholeMonthAllItemsTotalAddedStockCostNet || 0;
  const wholeMonthAllItemsTotalAddedStockCostTax =
    itemsGrandTotalData?.wholeMonthAllItemsTotalAddedStockCostTax || 0;

  const wholeMonthAllItemsTotalRemovedStockCost =
    itemsGrandTotalData?.wholeMonthAllItemsTotalRemovedStockCost || 0;
  const wholeMonthAllItemsTotalRemovedStockCostNet =
    itemsGrandTotalData?.wholeMonthAllItemsTotalRemovedStockCostNet || 0;
  const wholeMonthAllItemsTotalRemovedStockCostTax =
    itemsGrandTotalData?.wholeMonthAllItemsTotalRemovedStockCostTax || 0;

  const itemsSheetTitle = [
    `Monthly Report By Item and Operations: ${selectedMonthAndYear}`,
  ];

  let itemsSheetTable1 = [
    [`Report Generation Date: ${currentDate}`],
    [''],
    ['Category Name', 'Item Name', 'UOM', 'Inventory Operations'],
    [
      '',
      '',
      '',
      'A: ADDED STOCK',
      '',
      '',
      '(A: ADDED STOCK)',
      '',
      '',
      '(A: ADDED STOCK)',
      '',
      '',
      '(A: ADDED STOCK)',
      '',
      '',
      '',
      '',
      '', // space between
      'B: REMOVED STOCK',
      '',
      '',
      '(B: REMOVED STOCK)',
      '',
      '',
      '(B: REMOVED STOCK)',
    ],
    [
      '',
      '',
      '',
      `A-1: Pre-${appDefaults.appDisplayName} Stock`,
      '',
      '',
      'A-2: New Purchase',
      '',
      '',
      'A-3: Inventory Re-count',
      '',
      '',
      'A-4: Stock Transfer In',
      '',
      '',
      'ADDED STOCK TOTAL COST',
      '',
      '', // space between
      'B-1: Stock Usage',
      '',
      '',
      'B-2: Inventory Re-count',
      '',
      '',
      'B-3: Stock Transfer Out',
      '',
      '',
      'REMOVED STOCK TOTAL COST',
      '',
    ],
    [
      '',
      '',
      '',
      'Quantity',
      'Total Cost (Gross)',
      'Total Cost (Net)',
      'Quantity',
      'Total Cost (Gross)',
      'Total Cost (Net)',
      'Quantity',
      'Total Cost (Gross)',
      'Total Cost (Net)',
      'Quantity',
      'Total Cost (Gross)',
      'Total Cost (Net)',
      'Grand Total Cost (Gross)',
      'Grand Total Cost (Net)',
      '',
      'Quantity',
      'Total Cost (Gross)',
      'Total Cost (Net)',
      'Quantity',
      'Total Cost (Gross)',
      'Total Cost (Net)',
      'Quantity',
      'Total Cost (Gross)',
      'Total Cost (Net)',
      'Grand Total Cost (Gross)',
      'Grand Total Cost (Net)',
    ],
  ];

  let itemsSheetTable1Totals = [['']];

  itemsSheetTable1Totals.push([
    '',
    // Below Item name column
    'Grand Total',
    '---',
    // Stocks
    '---',
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId1TotalCost || 0
      ).toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId1TotalCostNet || 0
      ).toFixed(2),
    )}`,
    '---',
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId2TotalCost || 0
      ).toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId2TotalCostNet || 0
      ).toFixed(2),
    )}`,
    '---',
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId3TotalCost || 0
      ).toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId3TotalCostNet || 0
      ).toFixed(2),
    )}`,
    '---',
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId4TotalCost || 0
      ).toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId4TotalCostNet || 0
      ).toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      wholeMonthAllItemsTotalAddedStockCost.toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      wholeMonthAllItemsTotalAddedStockCostNet.toFixed(2),
    )}`,
    '', // space between
    '---',
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId6TotalCost || 0
      ).toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId6TotalCostNet || 0
      ).toFixed(2),
    )}`,
    '---',
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId7TotalCost || 0
      ).toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId7TotalCostNet || 0
      ).toFixed(2),
    )}`,
    '---',
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId10TotalCost || 0
      ).toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      (
        itemsGrandTotalData?.wholeMonthAllItemsOperationId10TotalCostNet || 0
      ).toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      wholeMonthAllItemsTotalRemovedStockCost.toFixed(2),
    )}`,
    `${currencySymbol} ${commaNumber(
      wholeMonthAllItemsTotalRemovedStockCostNet.toFixed(2),
    )}`,
    // // Cost
    // `${currencySymbol} ${commaNumber(
    //   selectedMonthAllItemsTotalCost.toFixed(2),
    // )}`,
    // `${currencySymbol} ${commaNumber(
    //   selectedMonthAllItemsTotalCostTax.toFixed(2),
    // )}`,
    // `${currencySymbol} ${commaNumber(
    //   selectedMonthAllItemsTotalCostNet.toFixed(2),
    // )}`,
    // '---',
    // // Revenue
    // '---',
    // '---',
    // '---',
  ]);

  itemsSheetTable1Totals.push(['']);
  itemsSheetTable1Totals.push([
    '',
    `Total Items: ${totalItemsData?.result || 0}`,
  ]);
  itemsSheetTable1Totals.push([
    '',
    `Total Categories: ${totalCategoriesData?.result || 0}`,
  ]);

  let eachItemRow = [];

  let itemNameColWidth = 20;
  let itemCategoryNameColWidth = 20;

  itemsDataToExport.forEach(item => {
    // row with custom height
    eachItemRow.push({hpx: 20});

    if (item.item_name.length > itemNameColWidth) {
      itemNameColWidth = item.item_name.length;
    }

    if (item.item_category_name.length > itemCategoryNameColWidth) {
      itemCategoryNameColWidth = item.item_category_name.length;
    }

    const selectedMonthGrandTotalCost =
      item.selected_month_grand_total_cost || 0;
    const selectedMonthGrandTotalCostNet =
      item.selected_month_grand_total_cost_net || 0;
    const selectedMonthGrandTotalCostTax =
      item.selected_month_grand_total_cost_tax || 0;
    const selectedMonthTotalRemovedStockCost =
      item.selected_month_total_removed_stock_cost || 0;
    const selectedMonthTotalRemovedStockCostNet =
      item.selected_month_total_removed_stock_cost_net || 0;
    const selectedMonthRevenueGroupTotalAmount =
      item.selected_month_revenue_group_total_amount || 0;
    const itemCostPercentage = selectedMonthRevenueGroupTotalAmount
      ? (selectedMonthTotalRemovedStockCostNet /
          selectedMonthRevenueGroupTotalAmount) *
        100
      : 0;
    const avgUnitCost = selectedMonthGrandTotalCostNet
      ? selectedMonthGrandTotalCostNet /
        (item.selected_month_grand_total_qty || 0)
      : 0;
    const itemRevenueGroupName = item.revenue_group_name || '(None)';

    itemsSheetTable1.push([
      item.item_category_name,
      // Item
      item.item_name,
      `${formatUOMAbbrev(item.item_uom_abbrev)}`,
      // pre-fcms stock
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_1_total_qty) || 0).toFixed(2),
      )}`,
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_1_total_cost) || 0).toFixed(
          2,
        ),
      )}`,
      `${commaNumber(
        (
          parseFloat(item.whole_month_operation_id_1_total_cost_net) || 0
        ).toFixed(2),
      )}`,
      // new purchase
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_2_total_qty) || 0).toFixed(2),
      )}`,
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_2_total_cost) || 0).toFixed(
          2,
        ),
      )}`,
      `${commaNumber(
        (
          parseFloat(item.whole_month_operation_id_2_total_cost_net) || 0
        ).toFixed(2),
      )}`,
      // added inventory re-count
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_3_total_qty) || 0).toFixed(2),
      )}`,
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_3_total_cost) || 0).toFixed(
          2,
        ),
      )}`,
      `${commaNumber(
        (
          parseFloat(item.whole_month_operation_id_3_total_cost_net) || 0
        ).toFixed(2),
      )}`,
      // stock transfer in
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_4_total_qty) || 0).toFixed(2),
      )}`,
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_4_total_cost) || 0).toFixed(
          2,
        ),
      )}`,
      `${commaNumber(
        (
          parseFloat(item.whole_month_operation_id_4_total_cost_net) || 0
        ).toFixed(2),
      )}`,
      // ADDED STOCK TOTAL COST
      `${commaNumber(
        (parseFloat(item.whole_month_total_added_stock_cost) || 0).toFixed(2),
      )}`,
      `${commaNumber(
        (parseFloat(item.whole_month_total_added_stock_cost_net) || 0).toFixed(
          2,
        ),
      )}`,
      '', // space between
      // stock usage
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_6_total_qty) || 0).toFixed(2),
      )}`,
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_6_total_cost) || 0).toFixed(
          2,
        ),
      )}`,
      `${commaNumber(
        (
          parseFloat(item.whole_month_operation_id_6_total_cost_net) || 0
        ).toFixed(2),
      )}`,
      // removed inventory re-count
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_7_total_qty) || 0).toFixed(2),
      )}`,
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_7_total_cost) || 0).toFixed(
          2,
        ),
      )}`,
      `${commaNumber(
        (
          parseFloat(item.whole_month_operation_id_7_total_cost_net) || 0
        ).toFixed(2),
      )}`,
      // stock transfer out
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_10_total_qty) || 0).toFixed(
          2,
        ),
      )}`,
      `${commaNumber(
        (parseFloat(item.whole_month_operation_id_10_total_cost) || 0).toFixed(
          2,
        ),
      )}`,
      `${commaNumber(
        (
          parseFloat(item.whole_month_operation_id_10_total_cost_net) || 0
        ).toFixed(2),
      )}`,
      // REMOVED STOCK TOTAL COST
      `${commaNumber(
        (parseFloat(item.whole_month_total_removed_stock_cost) || 0).toFixed(2),
      )}`,
      `${commaNumber(
        (
          parseFloat(item.whole_month_total_removed_stock_cost_net) || 0
        ).toFixed(2),
      )}`,
    ]);
  });

  itemsDataToExport = [
    itemsSheetTitle,
    ...itemsSheetTable1,
    ...itemsSheetTable1Totals,
  ];

  let itemsWorksheet = XLSX.utils.aoa_to_sheet(itemsDataToExport);

  const itemsWsCols = [
    {wch: itemCategoryNameColWidth}, // A
    {wch: itemNameColWidth}, // B
    {wch: 15}, // C
    {wch: 25}, // D
    {wch: 25}, // E
    {wch: 25}, // F
    {wch: 25}, // G
    {wch: 25}, // H
    {wch: 25}, // I
    {wch: 25}, // J
    {wch: 25}, // K
    {wch: 25}, // L
    {wch: 25}, // M
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 20}, // space between
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
    {wch: 25},
  ];
  itemsWorksheet['!cols'] = itemsWsCols;

  const itemsWsRows = [
    {hpx: 26},
    {hpx: 20},
    {hpx: 20},
    {hpx: 20},
    ...eachItemRow,
    // totals:
    {hpx: 20},
    {hpx: 20},
  ];
  itemsWorksheet['!rows'] = itemsWsRows;

  // Merge Cells
  if (!itemsWorksheet['!merges']) itemsWorksheet['!merges'] = [];
  itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A1:B1'));
  itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A2:B2'));
  itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A4:A5'));
  itemsWorksheet['!merges'].push(XLSX.utils.decode_range('B4:B5'));
  itemsWorksheet['!merges'].push(XLSX.utils.decode_range('C4:C5'));
  itemsWorksheet['!merges'].push(XLSX.utils.decode_range('D4:AC4'));

  return itemsWorksheet;
};

export const createPurchasesReportWorksheet = ({
  selectedMonthAndYear,
  currencySymbol,
  inventoryLogsData,
  itemsMonthlyReportGrandTotalData,
  inventoryLogsTotalsData,
  totalItemsData,
  totalCategoriesData,
  dateLabel = 'Purchase Date',
  quantityLabel = 'Purchase Quantity',
  sheetTitle = 'Purchases (By Item)',
}) => {
  let itemsDataToExport = inventoryLogsData?.result;
  let itemsGrandTotalData = inventoryLogsTotalsData?.totals;
  const currentDate = moment(new Date()).format('MMMM DD, YYYY, hh:mma');

  const grandTotalAmount = itemsGrandTotalData?.grandTotalCost || 0;
  const grandTotalAmountNet = itemsGrandTotalData?.grandTotalCostNet || 0;
  const grandTotalAmountTax = itemsGrandTotalData?.grandTotalCostTax || 0;

  const itemsSheetTitle = [`${sheetTitle}: ${selectedMonthAndYear}`];

  let itemsSheetTable1 = [
    [`Report Generation Date: ${currentDate}`],
    [''],
    [
      dateLabel,
      'Category Name',
      'Item Name',
      'UOM',
      quantityLabel,
      'Unit Cost (Net)',
      'Total Cost (Net)',
      'Tax Amount',
      'Total Cost (Gross)',
      'UOM Per Piece (per package)',
      'Qty Per Piece / Item Net. Wt',
      'Tax Name',
      'Tax Rate',
      'Vendor (Supplier)',
      'OR Number',
      'Remarks',
    ],
  ];

  let itemsSheetTable1Totals = [['']];

  itemsSheetTable1Totals.push([
    '',
    '',
    // Below Item name column
    'Grand Total',
    '---',
    '---',
    '---',
    `${currencySymbol} ${commaNumber(grandTotalAmountNet.toFixed(2))}`,
    `${currencySymbol} ${commaNumber(grandTotalAmountTax.toFixed(2))}`,
    `${currencySymbol} ${commaNumber(grandTotalAmount.toFixed(2))}`,
    '---',
    '---',
    '---',
    '---',
  ]);

  // itemsSheetTable1Totals.push(['']);
  // itemsSheetTable1Totals.push([
  //   '',
  //   `Total Items: ${totalItemsData?.result || 0}`,
  // ]);
  // itemsSheetTable1Totals.push([
  //   '',
  //   `Total Categories: ${totalCategoriesData?.result || 0}`,
  // ]);

  let eachItemRow = [];

  let itemNameColWidth = 20;
  let itemCategoryNameColWidth = 20;

  itemsDataToExport.forEach(item => {
    // row with custom height
    eachItemRow.push({hpx: 20});

    if (item.item_name.length > itemNameColWidth) {
      itemNameColWidth = item.item_name.length;
    }

    if (item.item_category_name.length > itemCategoryNameColWidth) {
      itemCategoryNameColWidth = item.item_category_name.length;
    }

    const selectedMonthGrandTotalCost =
      item.selected_month_grand_total_cost || 0;
    const selectedMonthGrandTotalCostNet =
      item.selected_month_grand_total_cost_net || 0;
    const selectedMonthGrandTotalCostTax =
      item.selected_month_grand_total_cost_tax || 0;
    const selectedMonthTotalRemovedStockCost =
      item.selected_month_total_removed_stock_cost || 0;
    const selectedMonthTotalRemovedStockCostNet =
      item.selected_month_total_removed_stock_cost_net || 0;
    const selectedMonthRevenueGroupTotalAmount =
      item.selected_month_revenue_group_total_amount || 0;
    const itemCostPercentage = selectedMonthRevenueGroupTotalAmount
      ? (selectedMonthTotalRemovedStockCostNet /
          selectedMonthRevenueGroupTotalAmount) *
        100
      : 0;
    const avgUnitCost = selectedMonthGrandTotalCostNet
      ? selectedMonthGrandTotalCostNet /
        (item.selected_month_grand_total_qty || 0)
      : 0;
    const itemRevenueGroupName = item.revenue_group_name || '(None)';

    let purchaseDate = moment(
      new Date(item.adjustment_date?.split(' ')?.[0]) || new Date(),
    ).format('MMMM DD, YYYY');

    itemsSheetTable1.push([
      `${purchaseDate}`,
      item.item_category_name,
      item.item_name,
      `${formatUOMAbbrev(item.item_uom_abbrev)}`,
      `${commaNumber((parseFloat(item.adjustment_qty) || 0).toFixed(2))}`,
      `${commaNumber(
        (parseFloat(item.adjustment_unit_cost_net) || 0).toFixed(2),
      )}`,
      `${commaNumber((parseFloat(item.total_cost_net) || 0).toFixed(2))}`,
      `${commaNumber((parseFloat(item.total_cost_tax) || 0).toFixed(2))}`,
      `${commaNumber((parseFloat(item.total_cost) || 0).toFixed(2))}`,
      `${formatUOMAbbrev(item.item_uom_abbrev_per_piece)}`,
      `${commaNumber((parseFloat(item.item_qty_per_piece) || 0).toFixed(2))}`,
      item.adjustment_tax_name ? item.adjustment_tax_name : '',
      `${commaNumber(
        (parseFloat(item.adjustment_tax_rate_percentage) || 0).toFixed(2),
      )}%`,
      item.vendor_display_name ? item.vendor_display_name : '',
      item.official_receipt_number ? item.official_receipt_number : '',
      `${item.remarks ? item.remarks.replace(/\'/g, "''") : ''}`,
    ]);
  });

  itemsDataToExport = [
    itemsSheetTitle,
    ...itemsSheetTable1,
    ...itemsSheetTable1Totals,
  ];

  let itemsWorksheet = XLSX.utils.aoa_to_sheet(itemsDataToExport);

  const itemsWsCols = [
    {wch: 25}, // A
    {wch: itemCategoryNameColWidth}, // B
    {wch: itemNameColWidth}, // C
    {wch: 25}, // D
    {wch: 25}, // E
    {wch: 25}, // F
    {wch: 25}, // G
    {wch: 25}, // H
    {wch: 25}, // I
    {wch: 25}, // J
    {wch: 25}, // K
    {wch: 25}, // L
    {wch: 25}, // M
    {wch: 25},
    {wch: 25},
    {wch: 25},
  ];
  itemsWorksheet['!cols'] = itemsWsCols;

  const itemsWsRows = [
    {hpx: 26},
    {hpx: 20},
    {hpx: 20},
    {hpx: 20},
    ...eachItemRow,
    // totals:
    {hpx: 20},
    {hpx: 20},
  ];
  itemsWorksheet['!rows'] = itemsWsRows;

  // Merge Cells
  // if (!itemsWorksheet['!merges']) itemsWorksheet['!merges'] = [];
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A1:B1'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A2:B2'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A4:A5'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('B4:B5'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('C4:F4'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('G4:J4'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('K4:M4'));

  return itemsWorksheet;
};

export const createStockTFOutReportWorksheet = ({
  selectedMonthAndYear,
  currencySymbol,
  inventoryLogsData,
  itemsMonthlyReportGrandTotalData,
  inventoryLogsTotalsData,
  totalItemsData,
  totalCategoriesData,
  dateLabel = 'Transfer Out Date',
  quantityLabel = 'Transfer Quantity',
  sheetTitle = 'Stock Transfer Out (By Item)',
}) => {
  let itemsDataToExport = inventoryLogsData?.result;
  let itemsGrandTotalData = inventoryLogsTotalsData?.totals;
  const currentDate = moment(new Date()).format('MMMM DD, YYYY, hh:mma');

  const grandTotalAmount = itemsGrandTotalData?.grandTotalCost || 0;
  const grandTotalAmountNet = itemsGrandTotalData?.grandTotalCostNet || 0;
  const grandTotalAmountTax = itemsGrandTotalData?.grandTotalCostTax || 0;

  const itemsSheetTitle = [`${sheetTitle}: ${selectedMonthAndYear}`];

  let itemsSheetTable1 = [
    [`Report Generation Date: ${currentDate}`],
    [''],
    [
      dateLabel,
      'Category Name',
      'Item Name',
      'UOM',
      quantityLabel,
      'Unit Cost (Net)',
      'Total Cost (Net)',
      'Tax Amount',
      'Total Cost (Gross)',
      'UOM Per Piece (per package)',
      'Qty Per Piece / Item Net. Wt',
      'Tax Name',
      'Tax Rate',
      'Remarks',
    ],
  ];

  let itemsSheetTable1Totals = [['']];

  itemsSheetTable1Totals.push([
    '',
    '',
    // Below Item name column
    'Grand Total',
    '---',
    '---',
    '---',
    `${currencySymbol} ${commaNumber(grandTotalAmountNet.toFixed(2))}`,
    `${currencySymbol} ${commaNumber(grandTotalAmountTax.toFixed(2))}`,
    `${currencySymbol} ${commaNumber(grandTotalAmount.toFixed(2))}`,
    '---',
    '---',
  ]);

  // itemsSheetTable1Totals.push(['']);
  // itemsSheetTable1Totals.push([
  //   '',
  //   `Total Items: ${totalItemsData?.result || 0}`,
  // ]);
  // itemsSheetTable1Totals.push([
  //   '',
  //   `Total Categories: ${totalCategoriesData?.result || 0}`,
  // ]);

  let eachItemRow = [];

  let itemNameColWidth = 20;
  let itemCategoryNameColWidth = 20;

  itemsDataToExport.forEach(item => {
    // row with custom height
    eachItemRow.push({hpx: 20});

    if (item.item_name.length > itemNameColWidth) {
      itemNameColWidth = item.item_name.length;
    }

    if (item.item_category_name.length > itemCategoryNameColWidth) {
      itemCategoryNameColWidth = item.item_category_name.length;
    }

    const selectedMonthGrandTotalCost =
      item.selected_month_grand_total_cost || 0;
    const selectedMonthGrandTotalCostNet =
      item.selected_month_grand_total_cost_net || 0;
    const selectedMonthGrandTotalCostTax =
      item.selected_month_grand_total_cost_tax || 0;
    const selectedMonthTotalRemovedStockCost =
      item.selected_month_total_removed_stock_cost || 0;
    const selectedMonthTotalRemovedStockCostNet =
      item.selected_month_total_removed_stock_cost_net || 0;
    const selectedMonthRevenueGroupTotalAmount =
      item.selected_month_revenue_group_total_amount || 0;
    const itemCostPercentage = selectedMonthRevenueGroupTotalAmount
      ? (selectedMonthTotalRemovedStockCostNet /
          selectedMonthRevenueGroupTotalAmount) *
        100
      : 0;
    const avgUnitCost = selectedMonthGrandTotalCostNet
      ? selectedMonthGrandTotalCostNet /
        (item.selected_month_grand_total_qty || 0)
      : 0;
    const itemRevenueGroupName = item.revenue_group_name || '(None)';

    let purchaseDate = moment(
      new Date(item.adjustment_date?.split(' ')?.[0]) || new Date(),
    ).format('MMMM DD, YYYY');

    itemsSheetTable1.push([
      `${purchaseDate}`,
      item.item_category_name,
      item.item_name,
      `${formatUOMAbbrev(item.item_uom_abbrev)}`,
      `${commaNumber((parseFloat(item.adjustment_qty) || 0).toFixed(2))}`,
      `${commaNumber(
        (parseFloat(item.adjustment_unit_cost_net) || 0).toFixed(2),
      )}`,
      `${commaNumber((parseFloat(item.total_cost_net) || 0).toFixed(2))}`,
      `${commaNumber((parseFloat(item.total_cost_tax) || 0).toFixed(2))}`,
      `${commaNumber((parseFloat(item.total_cost) || 0).toFixed(2))}`,
      `${formatUOMAbbrev(item.item_uom_abbrev_per_piece)}`,
      `${commaNumber((parseFloat(item.item_qty_per_piece) || 0).toFixed(2))}`,
      item.adjustment_tax_name ? item.adjustment_tax_name : '',
      `${commaNumber(
        (parseFloat(item.adjustment_tax_rate_percentage) || 0).toFixed(2),
      )}%`,
      `${item.remarks ? item.remarks.replace(/\'/g, "''") : ''}`,
    ]);
  });

  itemsDataToExport = [
    itemsSheetTitle,
    ...itemsSheetTable1,
    ...itemsSheetTable1Totals,
  ];

  let itemsWorksheet = XLSX.utils.aoa_to_sheet(itemsDataToExport);

  const itemsWsCols = [
    {wch: 25}, // A
    {wch: itemCategoryNameColWidth}, // B
    {wch: itemNameColWidth}, // C
    {wch: 25}, // D
    {wch: 25}, // E
    {wch: 25}, // F
    {wch: 25}, // G
    {wch: 25}, // H
    {wch: 25}, // I
    {wch: 25}, // J
    {wch: 25}, // K
    {wch: 25}, // L
    {wch: 25}, // M
    {wch: 25},
    {wch: 25},
    {wch: 25},
  ];
  itemsWorksheet['!cols'] = itemsWsCols;

  const itemsWsRows = [
    {hpx: 26},
    {hpx: 20},
    {hpx: 20},
    {hpx: 20},
    ...eachItemRow,
    // totals:
    {hpx: 20},
    {hpx: 20},
  ];
  itemsWorksheet['!rows'] = itemsWsRows;

  // Merge Cells
  // if (!itemsWorksheet['!merges']) itemsWorksheet['!merges'] = [];
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A1:B1'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A2:B2'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A4:A5'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('B4:B5'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('C4:F4'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('G4:J4'));
  // itemsWorksheet['!merges'].push(XLSX.utils.decode_range('K4:M4'));

  return itemsWorksheet;
};
