import uuid from 'react-native-uuid';
import {getDBConnection, getCloudSyncParams} from '../localDb';
import {OPERATION_CODES} from './operations';
import {
  createQueryFilter,
  isMutationDisabled,
} from '../utils/localDbQueryHelpers';
import {getItem} from './items';
import {buildRevenueGroupMonthTotalSql} from './revenues';
import {scheduleSyncSoon} from '../services/syncService';

export const getInventoryLogs = async ({queryKey, pageParam = 1}) => {
  const [
    _key,
    {
      filter,
      monthYearDateFilter,
      selectedMonthYearDateFilter,
      monthToDateFilter,
      dateRangeFilter,
      limit = 1000000000,
    },
  ] = queryKey;
  const orderBy = 'inventory_logs.adjustment_date';

  let additionalFilter = {};

  if (monthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(inventory_logs.adjustment_date)',
      start:
        '(SELECT DATE(adjustment_date) FROM inventory_logs ORDER BY adjustment_date ASC LIMIT 1)',
      end: `DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };
  } else if (selectedMonthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(inventory_logs.adjustment_date)',
      start: `DATE('${selectedMonthYearDateFilter}', 'start of month')`,
      end: `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };
  } else if (monthToDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(inventory_logs.adjustment_date)',
      start: `DATE('${monthToDateFilter.start}', 'start of month')`,
      end: `DATE('${monthToDateFilter.end}')`,
    };
  } else if (dateRangeFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(inventory_logs.adjustment_date)',
      start: `DATE('${dateRangeFilter.start}')`,
      end: `DATE('${dateRangeFilter.end}')`,
    };
  }

  let queryFilter = createQueryFilter(filter, additionalFilter);

  try {
    const db = await getDBConnection();
    const inventoryLogs = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      inventory_logs.id AS id,
      operation_id,
      operations.type AS operation_type,
      operations.name AS operation_name,
      operations.code AS operation_code,
      
      items.category_id AS item_category_id,
      items.name AS item_name,
      items.uom_abbrev AS item_uom_abbrev,
      items.unit_cost AS item_unit_cost,
      items.uom_abbrev_per_piece AS item_uom_abbrev_per_piece,
      items.qty_per_piece AS item_qty_per_piece,
      items.initial_stock_qty AS item_initial_stock_qty,
      items.current_stock_qty AS item_current_stock_qty,

      categories.name AS item_category_name,

      voided,
      item_id,
      ref_tax_id,
      ref_vendor_id,
      vendor_display_name,
      official_receipt_number,
      adjustment_unit_cost,
      adjustment_unit_cost_net,
      adjustment_unit_cost_tax,
      adjustment_tax_rate_percentage,
      adjustment_tax_name,
      adjustment_qty,
      adjustment_date,
      beginning_inventory_date,
      remarks,
      items.date AS date,

      adjustment_unit_cost * adjustment_qty AS total_cost,
      adjustment_unit_cost_net * adjustment_qty AS total_cost_net,
      adjustment_unit_cost_tax * adjustment_qty AS total_cost_tax
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM active_inventory_logs inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN active_items items ON items.id = inventory_logs.item_id
      LEFT JOIN active_categories categories ON categories.id = items.category_id

      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        inventoryLogs.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: inventoryLogs,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get inventory logs.');
  }
};

export const getInventoryLog = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `
    SELECT
    inventory_logs.id AS id,
    inventory_logs.operation_id AS operation_id,
    inventory_logs.recipe_id,
    inventory_logs.yield_ref_id,
    inventory_logs.idt_import_id,
    operations.type AS operation_type,
    operations.name AS operation_name,
    operations.code AS operation_code,

    items.category_id AS item_category_id,
    categories.name AS item_category_name,
    items.name AS item_name,
    items.uom_abbrev AS item_uom_abbrev,
    items.unit_cost AS item_unit_cost,
    items.uom_abbrev_per_piece AS item_uom_abbrev_per_piece,
    items.qty_per_piece AS item_qty_per_piece,
    items.initial_stock_qty AS item_initial_stock_qty,
    items.current_stock_qty AS item_current_stock_qty,

    voided,
    item_id,
    ref_tax_id,
    ref_vendor_id,
    vendor_display_name,
    official_receipt_number,
    adjustment_unit_cost,
    adjustment_unit_cost_net,
    adjustment_unit_cost_tax,
    adjustment_tax_rate_percentage,
    adjustment_tax_name,
    adjustment_qty,
    adjustment_date,
    beginning_inventory_date,
    remarks,
    items.date AS date,

    adjustment_unit_cost * adjustment_qty AS total_cost,
    adjustment_unit_cost_net * adjustment_qty AS total_cost_net

    FROM inventory_logs
    INNER JOIN operations ON operations.id = inventory_logs.operation_id
    INNER JOIN items ON items.id = inventory_logs.item_id
    LEFT JOIN categories ON categories.id = items.category_id
    WHERE inventory_logs.id = '${id}'
  `;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);
    const log = result[0].rows.item(0);

    let idtImport = null;
    if (log?.idt_import_id) {
      const idtImportResult = await db.executeSql(
        `SELECT id, sync_id, imported_by_account_id, imported_at
         FROM active_inventory_data_template_imports
         WHERE id = '${log.idt_import_id}'
         LIMIT 1;`,
      );
      idtImport = idtImportResult?.[0]?.rows?.item(0) ?? null;
    }

    return {
      result: log,
      idtImport,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch inventory log.');
  }
};

export const getYieldStockInventoryLogByYieldRefId = async ({queryKey}) => {
  const [_key, {yieldRefId}] = queryKey;
  const query = `
    SELECT
    inventory_logs.id AS id,
    inventory_logs.operation_id AS operation_id,
    inventory_logs.recipe_id,
    inventory_logs.yield_ref_id,
    operations.type AS operation_type,
    operations.name AS operation_name,
    operations.code AS operation_code,
    
    items.category_id AS item_category_id,
    categories.name AS item_category_name,
    items.name AS item_name,
    items.uom_abbrev AS item_uom_abbrev,
    items.unit_cost AS item_unit_cost,
    items.uom_abbrev_per_piece AS item_uom_abbrev_per_piece,
    items.qty_per_piece AS item_qty_per_piece,
    items.initial_stock_qty AS item_initial_stock_qty,
    items.current_stock_qty AS item_current_stock_qty,
    
    voided,
    item_id,
    ref_tax_id,
    ref_vendor_id,
    vendor_display_name,
    official_receipt_number,
    adjustment_unit_cost,
    adjustment_unit_cost_net,
    adjustment_unit_cost_tax,
    adjustment_tax_rate_percentage,
    adjustment_tax_name,
    adjustment_qty,
    adjustment_date,
    beginning_inventory_date,
    remarks,
    items.date AS date,

    adjustment_unit_cost * adjustment_qty AS total_cost,
    adjustment_unit_cost_net * adjustment_qty AS total_cost_net

    FROM inventory_logs
    INNER JOIN operations ON operations.id = inventory_logs.operation_id
    INNER JOIN items ON items.id = inventory_logs.item_id
    LEFT JOIN categories ON categories.id = items.category_id
    WHERE inventory_logs.yield_ref_id = '${yieldRefId}'
    AND operations.code = '${OPERATION_CODES.NEW_YIELD_STOCK}'
  `;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch yield stock inventory log.');
  }
};

/**
 * Get the ingredient stock usage logs (remove_stock) that were deducted for a
 * New Yield Stock, identified by the shared yield_ref_id. Returns one row per
 * ingredient item used, with the qty used and its unit of measurement.
 */
export const getYieldIngredientLogsByYieldRefId = async ({queryKey}) => {
  const [_key, {yieldRefId}] = queryKey;
  const query = `
    SELECT
    inventory_logs.id AS id,
    inventory_logs.operation_id AS operation_id,
    inventory_logs.recipe_id,
    inventory_logs.yield_ref_id,
    operations.type AS operation_type,
    operations.name AS operation_name,
    operations.code AS operation_code,

    items.name AS item_name,
    items.uom_abbrev AS item_uom_abbrev,

    voided,
    item_id,
    adjustment_qty,
    adjustment_date

    FROM active_inventory_logs inventory_logs
    INNER JOIN operations ON operations.id = inventory_logs.operation_id
    INNER JOIN active_items items ON items.id = inventory_logs.item_id
    WHERE inventory_logs.yield_ref_id = '${yieldRefId}'
    AND operations.type = 'remove_stock'
    ORDER BY items.name ASC
  `;

  try {
    const db = await getDBConnection();
    const results = await db.executeSql(query);
    const logs = [];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        logs.push(result.rows.item(index));
      }
    });

    return {
      result: logs,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch yield ingredient inventory logs.');
  }
};

export const updateInventoryLog = async ({id, updatedValues}) => {
  try {
    const db = await getDBConnection();

    /**
     * Get inventory log (with operation code for code-based comparisons)
     */
    const getInventoryLogQuery = `
      SELECT inventory_logs.*, operations.code AS operation_code
      FROM inventory_logs
      LEFT JOIN operations ON operations.id = inventory_logs.operation_id
      WHERE inventory_logs.id = '${id}'
    `;

    const getInventoryLogResult = await db.executeSql(getInventoryLogQuery);
    const log = getInventoryLogResult[0].rows.item(0);

    if (!log) {
      throw new Error('Failed to fetch log.');
    }

    /**
     * Get item
     */
    const getItemQuery = `SELECT * FROM items WHERE id = '${log.item_id}'`;

    const getItemQueryResult = await db.executeSql(getItemQuery);
    const item = getItemQueryResult[0].rows.item(0);

    if (!item) {
      throw new Error('Failed to fetch item.');
    }

    /**
     * Update inventory log
     */

    const defaultTaxEmptyValue = {
      id: null,
      name: '',
      rate_percentage: 0,
    };
    let tax = defaultTaxEmptyValue;

    // validate tax id
    if (updatedValues.tax_id) {
      // '0' means user intentionally set the tax to null
      if (updatedValues.tax_id === '0') {
        tax = defaultTaxEmptyValue;
      } else {
        const getTaxQuery = `
          SELECT * FROM taxes WHERE id = '${updatedValues.tax_id}'
        `;

        const getTaxResult = await db.executeSql(getTaxQuery);
        const fetchedTax = getTaxResult[0].rows.item(0);

        if (!fetchedTax) {
          // tax maybe deleted
        } else {
          tax = fetchedTax;
        }
      }
    }

    const defaultVendorEmptyValue = {
      id: null,
      vendor_display_name: '',
    };
    let vendor = defaultVendorEmptyValue;

    // validate vendor id
    if (updatedValues.vendor_id) {
      // '0' means user intentionally set the value to null
      if (updatedValues.vendor_id === '0') {
        vendor = defaultVendorEmptyValue;
      } else {
        const getVendorQuery = `
          SELECT * FROM vendors WHERE id = '${updatedValues.vendor_id}'
        `;

        const getVendorResult = await db.executeSql(getVendorQuery);
        const fetchedVendor = getVendorResult[0].rows.item(0);

        if (!fetchedVendor) {
          // vendor maybe deleted
        } else {
          vendor = fetchedVendor;
        }
      }
    }

    const unitCost = parseFloat(updatedValues.adjustment_unit_cost || 0);
    const qty = parseFloat(updatedValues.adjustment_qty || 0);
    const taxRatePercentage = parseFloat(tax?.rate_percentage || 0);

    const unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
    const unitCostTax = unitCost - unitCostNet;

    const taxId = tax.id ? `'${tax.id}'` : 'null';
    const taxName = tax.name ? `'${tax.name.replace(/\'/g, "''")}'` : 'null';

    const vendorId = vendor.id ? `'${vendor.id}'` : 'null';
    const vendorDisplayName = vendor.vendor_display_name
      ? `'${vendor.vendor_display_name.replace(/\'/g, "''")}'`
      : 'null';

    const officialReceiptNumber = updatedValues.official_receipt_number
      ? `'${updatedValues.official_receipt_number}'`
      : 'null';

    let adjustmentDate = updatedValues.adjustment_date
      ? `datetime('${updatedValues.adjustment_date}')`
      : `datetime('now', 'localtime')`;
    let beginningInventoryDate = 'null';

    if (log.operation_code === OPERATION_CODES.PRE_APP_STOCK) {
      beginningInventoryDate = updatedValues.beginning_inventory_date;

      const beginningInventoryDateFixedValue = beginningInventoryDate
        ? `datetime('${beginningInventoryDate}', 'start of month')`
        : `datetime('now', 'localtime', 'start of month')`;
      const adjustmentDateFixedValue = beginningInventoryDate
        ? `datetime('${beginningInventoryDate}', 'start of month', '-1 day')`
        : `datetime('now', 'localtime', 'start of month', '-1 day')`;

      beginningInventoryDate = beginningInventoryDateFixedValue;
      adjustmentDate = adjustmentDateFixedValue;
    }

    const updateInventoryLogQuery = `UPDATE inventory_logs
      SET operation_id = '${updatedValues.operation_id}',
      item_id = '${item.id}',
      ref_tax_id = ${taxId},
      ref_vendor_id = ${vendorId},
      vendor_display_name = ${vendorDisplayName},
      adjustment_unit_cost = ${unitCost},
      adjustment_unit_cost_net = ${unitCostNet},
      adjustment_unit_cost_tax = ${unitCostTax},
      adjustment_tax_rate_percentage = ${taxRatePercentage},
      adjustment_tax_name = ${taxName},
      adjustment_qty = ${qty},
      adjustment_date = ${adjustmentDate},
      beginning_inventory_date = ${beginningInventoryDate},
      official_receipt_number = ${officialReceiptNumber},
      remarks = '${
        updatedValues.remarks ? updatedValues.remarks.replace(/\'/g, "''") : ''
      }',
      updated_at = CURRENT_TIMESTAMP
      WHERE id = '${id}'
    `;

    const result = await db.executeSql(updateInventoryLogQuery);
    scheduleSyncSoon();
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update inventory log.');
  }
};

export const voidInventoryLog = async ({id}) => {
  try {
    const db = await getDBConnection();

    /**
     * Get inventory log
     */
    const getInventoryLogQueryData = await getInventoryLog({
      queryKey: ['inventoryLog', {id}],
    });
    const inventoryLog = getInventoryLogQueryData?.result;

    if (!inventoryLog) {
      throw new Error('Failed to fetch inventory log.');
    }

    /**
     * TODO: Do inventory log validations, i.e. check
     * if inventory log is already voided or not, etc.
     */
    const voidInventoryLogQuery = `
      UPDATE inventory_logs
      SET voided = 1,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = '${inventoryLog.id}'
    `;

    const voidInventoryLogResult = await db.executeSql(voidInventoryLogQuery);

    if (!voidInventoryLogResult[0]?.rowsAffected > 0) {
      throw Error('Failed to void inventory log.');
    }

    /**
     * If inventory log is New Yield Stock
     * Void all inventory log with the same yield_ref_id.
     */
    if (
      inventoryLog.operation_code === OPERATION_CODES.NEW_YIELD_STOCK &&
      inventoryLog.yield_ref_id
    ) {
      const voidAllDeductedYieldIngredientsInInventoryLogsQuery = `
        UPDATE inventory_logs
        SET voided = 1,
        updated_at = CURRENT_TIMESTAMP
        WHERE yield_ref_id = '${inventoryLog.yield_ref_id}' AND id != '${inventoryLog.id}'
      `;
      await db.executeSql(voidAllDeductedYieldIngredientsInInventoryLogsQuery);
    }
    scheduleSyncSoon();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to void inventory log.');
  }
};

export const updateInventoryLogRemarks = async ({id, updatedValues}) => {
  const updateInventoryLogRemarksQuery = `UPDATE inventory_logs
  SET remarks = '${
    updatedValues.remarks ? updatedValues.remarks.replace(/\'/g, "''") : ''
  }',
  updated_at = CURRENT_TIMESTAMP
  WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(updateInventoryLogRemarksQuery);
    scheduleSyncSoon();
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update inventory log remarks.');
  }
};

export const getInventoryLogsTotals = async ({queryKey, pageParam = 1}) => {
  const [
    _key,
    {
      filter,
      monthYearDateFilter,
      selectedMonthYearDateFilter,
      monthToDateFilter,
      dateRangeFilter,
      limit = 1000000000,
    },
  ] = queryKey;

  let additionalFilter = {};

  if (monthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(inventory_logs.adjustment_date)',
      start:
        '(SELECT DATE(adjustment_date) FROM inventory_logs ORDER BY adjustment_date ASC LIMIT 1)',
      end: `DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };
  } else if (selectedMonthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(inventory_logs.adjustment_date)',
      start: `DATE('${selectedMonthYearDateFilter}', 'start of month')`,
      end: `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };
  } else if (monthToDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(inventory_logs.adjustment_date)',
      start: `DATE('${monthToDateFilter.start}', 'start of month')`,
      end: `DATE('${monthToDateFilter.end}')`,
    };
  } else if (dateRangeFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(inventory_logs.adjustment_date)',
      start: `DATE('${dateRangeFilter.start}')`,
      end: `DATE('${dateRangeFilter.end}')`,
    };
  }

  additionalFilter['inventory_logs.voided'] = 0;

  let queryFilter = createQueryFilter(filter, additionalFilter);

  try {
    const db = await getDBConnection();
    const offset = (pageParam - 1) * limit;
    const sumQuery = `
      SELECT SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty) AS grand_total_cost,
      SUM(inventory_logs.adjustment_unit_cost_net * inventory_logs.adjustment_qty) AS grand_total_cost_net,
      SUM(inventory_logs.adjustment_unit_cost_tax * inventory_logs.adjustment_qty) AS grand_total_cost_tax
    `;
    const query = `
      FROM active_inventory_logs inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN active_items items ON items.id = inventory_logs.item_id
      LEFT JOIN active_categories categories ON categories.id = items.category_id

      ${queryFilter}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const result = await db.executeSql(sumQuery + query);
    const grandTotalCost = result[0].rows.raw()[0]['grand_total_cost'];
    const grandTotalCostNet = result[0].rows.raw()[0]['grand_total_cost_net'];
    const grandTotalCostTax = result[0].rows.raw()[0]['grand_total_cost_tax'];

    return {
      totals: {
        grandTotalCost,
        grandTotalCostNet,
        grandTotalCostTax,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get inventory logs totals.');
  }
};

export const getInventoryLogsTotal = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = 'inventory_logs.adjustment_date';

  let additionalFilter = {
    'inventory_logs.voided': 0,
  };

  let queryFilter = createQueryFilter(filter, additionalFilter);

  try {
    const db = await getDBConnection();
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const sumQuery = `
      SELECT SUM(adjustment_unit_cost_net * adjustment_qty) AS logs_total
    `;
    const query = `
      FROM active_inventory_logs inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN active_items items ON items.id = inventory_logs.item_id

      ${queryFilter}

      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const result = await db.executeSql(sumQuery + query);
    const grandTotal = result[0].rows.raw()[0]['logs_total'];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get logs total.');
  }
};

export const getItemInventoryLogsGrandTotal = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = 'inventory_logs.adjustment_date';
  let addedStockSumQueryFilterObj = {...filter};
  let addedStockSumQueryFilter = '';
  let removedStockSumQueryFilterObj = {...filter};
  let removedStockSumQueryFilter = '';

  addedStockSumQueryFilterObj['operations.type'] = 'add_stock';
  addedStockSumQueryFilterObj['inventory_logs.voided'] = 0;

  if (
    addedStockSumQueryFilterObj &&
    Object.keys(addedStockSumQueryFilterObj).length > 0
  ) {
    for (let key in addedStockSumQueryFilterObj) {
      if (addedStockSumQueryFilterObj[key] === '') {
        delete addedStockSumQueryFilterObj[key];
      } else {
        let value =
          typeof addedStockSumQueryFilterObj[key] === 'string'
            ? `'${addedStockSumQueryFilterObj[key]}'`
            : addedStockSumQueryFilterObj[key];
        addedStockSumQueryFilter = addedStockSumQueryFilter
          ? (addedStockSumQueryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  removedStockSumQueryFilterObj['operations.type'] = 'remove_stock';
  removedStockSumQueryFilterObj['inventory_logs.voided'] = 0;

  if (
    removedStockSumQueryFilterObj &&
    Object.keys(removedStockSumQueryFilterObj).length > 0
  ) {
    for (let key in removedStockSumQueryFilterObj) {
      if (removedStockSumQueryFilterObj[key] === '') {
        delete removedStockSumQueryFilterObj[key];
      } else {
        let value =
          typeof removedStockSumQueryFilterObj[key] === 'string'
            ? `'${removedStockSumQueryFilterObj[key]}'`
            : removedStockSumQueryFilterObj[key];
        removedStockSumQueryFilter = removedStockSumQueryFilter
          ? (removedStockSumQueryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const sumQuery = `
      SELECT SUM(adjustment_unit_cost_net * adjustment_qty) AS logs_total
    `;
    const addedStockSumQuery = `
      FROM active_inventory_logs inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN active_items items ON items.id = inventory_logs.item_id

      ${addedStockSumQueryFilter}
    ;`;

    const removedStockSumQuery = `
      FROM active_inventory_logs inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN active_items items ON items.id = inventory_logs.item_id

      ${removedStockSumQueryFilter}
    ;`;

    const addedStockSumResult = await db.executeSql(
      sumQuery + addedStockSumQuery,
    );
    const removedStockSumResult = await db.executeSql(
      sumQuery + removedStockSumQuery,
    );
    const addedStockSum =
      addedStockSumResult[0].rows.raw()[0]['logs_total'] || 0;
    const removedStockSum =
      removedStockSumResult[0].rows.raw()[0]['logs_total'] || 0;

    const grandTotal = addedStockSum - removedStockSum;

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get item grand total.');
  }
};

export const getItemCostPercentage = async ({queryKey}) => {
  const [_key, {filter, itemId}] = queryKey;

  let addedStockSumQueryFilterObj = {...filter};
  let addedStockSumQueryFilter = '';
  let removedStockSumQueryFilterObj = {...filter};
  let removedStockSumQueryFilter = '';

  addedStockSumQueryFilterObj['operations.type'] = 'add_stock';
  addedStockSumQueryFilterObj['inventory_logs.voided'] = 0;
  addedStockSumQueryFilterObj['items.id'] = itemId;

  if (
    addedStockSumQueryFilterObj &&
    Object.keys(addedStockSumQueryFilterObj).length > 0
  ) {
    for (let key in addedStockSumQueryFilterObj) {
      if (addedStockSumQueryFilterObj[key] === '') {
        delete addedStockSumQueryFilterObj[key];
      } else {
        let value =
          typeof addedStockSumQueryFilterObj[key] === 'string'
            ? `'${addedStockSumQueryFilterObj[key]}'`
            : addedStockSumQueryFilterObj[key];
        addedStockSumQueryFilter = addedStockSumQueryFilter
          ? (addedStockSumQueryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  removedStockSumQueryFilterObj['operations.type'] = 'remove_stock';
  removedStockSumQueryFilterObj['inventory_logs.voided'] = 0;
  removedStockSumQueryFilterObj['items.id'] = itemId;

  if (
    removedStockSumQueryFilterObj &&
    Object.keys(removedStockSumQueryFilterObj).length > 0
  ) {
    for (let key in removedStockSumQueryFilterObj) {
      if (removedStockSumQueryFilterObj[key] === '') {
        delete removedStockSumQueryFilterObj[key];
      } else {
        let value =
          typeof removedStockSumQueryFilterObj[key] === 'string'
            ? `'${removedStockSumQueryFilterObj[key]}'`
            : removedStockSumQueryFilterObj[key];
        removedStockSumQueryFilter = removedStockSumQueryFilter
          ? (removedStockSumQueryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();

    const sumQuery = `
      SELECT SUM(adjustment_unit_cost * adjustment_qty) AS logs_total
    `;
    const addedStockSumQuery = `
      FROM active_inventory_logs inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN active_items items ON items.id = inventory_logs.item_id

      ${addedStockSumQueryFilter}
    ;`;

    const removedStockSumQuery = `
      FROM active_inventory_logs inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN active_items items ON items.id = inventory_logs.item_id

      ${removedStockSumQueryFilter}
    ;`;

    const addedStockSumResult = await db.executeSql(
      sumQuery + addedStockSumQuery,
    );
    const removedStockSumResult = await db.executeSql(
      sumQuery + removedStockSumQuery,
    );
    const addedStockSum =
      addedStockSumResult[0].rows.raw()[0]['logs_total'] || 0;
    const removedStockSum =
      removedStockSumResult[0].rows.raw()[0]['logs_total'] || 0;

    const itemGrandTotal = addedStockSum - removedStockSum;

    // get item
    const getItemQuery = `SELECT * FROM items WHERE id = '${itemId}'`;
    const getItemResult = await db.executeSql(getItemQuery);
    const item = getItemResult[0].rows.item(0);

    // get item revenue category
    const getItemRevenueCategoryQuery = `
      SELECT *,
      revenue_categories.id AS id,
      revenue_categories.revenue_group_id AS revenue_group_id,
      revenue_groups.name AS revenue_group_name
      FROM revenue_categories
      JOIN revenue_groups ON revenue_groups.id = revenue_categories.revenue_group_id
      WHERE category_id = '${item.category_id}'
    `;

    const getItemRevenueCategoryResult = await db.executeSql(
      getItemRevenueCategoryQuery,
    );

    const itemRevenueCategory = getItemRevenueCategoryResult[0].rows.item(0);
    let currentMonthRevenueGroupAmount = 0;
    let isCategoryHasRevenueGroup = false;
    let revenueGroup = null;

    if (itemRevenueCategory) {
      isCategoryHasRevenueGroup = true;
      revenueGroup = {
        id: itemRevenueCategory.revenue_group_id,
        name: itemRevenueCategory.revenue_group_name,
      };

      // get item revenue group id from its category
      const revenueGroupId = itemRevenueCategory.revenue_group_id;

      // Revenue group total for the current month = internal POS sales for the
      // group's categories + manual/external per-source amounts.
      const getCurrentMonthRevenueGroupAmountQuery = `
      SELECT ${buildRevenueGroupMonthTotalSql({
        groupIdSql: `'${revenueGroupId}'`,
        dateSql: `datetime('now', 'localtime')`,
      })} AS total_amount
    `;
      const getCurrentMonthRevenueGroupAmountResult = await db.executeSql(
        getCurrentMonthRevenueGroupAmountQuery,
      );
      currentMonthRevenueGroupAmount =
        getCurrentMonthRevenueGroupAmountResult[0].rows.raw()[0][
          'total_amount'
        ] || 0;
    }

    const costPercentage = currentMonthRevenueGroupAmount
      ? (removedStockSum / currentMonthRevenueGroupAmount) * 100
      : 0;

    return {
      revenueGroup,
      isCategoryHasRevenueGroup,
      hasCurrentMonthRevenueGroupAmount: currentMonthRevenueGroupAmount
        ? true
        : false,
      result: costPercentage,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get item cost percentage.');
  }
};

export const getCategoryCostPercentage = async ({queryKey}) => {
  const [_key, {filter, categoryId}] = queryKey;

  let addedStockSumQueryFilterObj = {...filter};
  let addedStockSumQueryFilter = '';
  let removedStockSumQueryFilterObj = {...filter};
  let removedStockSumQueryFilter = '';

  addedStockSumQueryFilterObj['operations.type'] = 'add_stock';
  addedStockSumQueryFilterObj['inventory_logs.voided'] = 0;
  addedStockSumQueryFilterObj['items.category_id'] = categoryId;

  if (
    addedStockSumQueryFilterObj &&
    Object.keys(addedStockSumQueryFilterObj).length > 0
  ) {
    for (let key in addedStockSumQueryFilterObj) {
      if (addedStockSumQueryFilterObj[key] === '') {
        delete addedStockSumQueryFilterObj[key];
      } else {
        let value =
          typeof addedStockSumQueryFilterObj[key] === 'string'
            ? `'${addedStockSumQueryFilterObj[key]}'`
            : addedStockSumQueryFilterObj[key];
        addedStockSumQueryFilter = addedStockSumQueryFilter
          ? (addedStockSumQueryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  removedStockSumQueryFilterObj['operations.type'] = 'remove_stock';
  removedStockSumQueryFilterObj['inventory_logs.voided'] = 0;
  removedStockSumQueryFilterObj['items.category_id'] = categoryId;

  if (
    removedStockSumQueryFilterObj &&
    Object.keys(removedStockSumQueryFilterObj).length > 0
  ) {
    for (let key in removedStockSumQueryFilterObj) {
      if (removedStockSumQueryFilterObj[key] === '') {
        delete removedStockSumQueryFilterObj[key];
      } else {
        let value =
          typeof removedStockSumQueryFilterObj[key] === 'string'
            ? `'${removedStockSumQueryFilterObj[key]}'`
            : removedStockSumQueryFilterObj[key];
        removedStockSumQueryFilter = removedStockSumQueryFilter
          ? (removedStockSumQueryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();

    const sumQuery = `
      SELECT SUM(adjustment_unit_cost * adjustment_qty) AS logs_total
    `;
    const addedStockSumQuery = `
      FROM active_inventory_logs inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN active_items items ON items.id = inventory_logs.item_id

      ${addedStockSumQueryFilter}
    ;`;

    const removedStockSumQuery = `
      FROM active_inventory_logs inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN active_items items ON items.id = inventory_logs.item_id

      ${removedStockSumQueryFilter}
    ;`;

    const addedStockSumResult = await db.executeSql(
      sumQuery + addedStockSumQuery,
    );
    const removedStockSumResult = await db.executeSql(
      sumQuery + removedStockSumQuery,
    );
    const addedStockSum =
      addedStockSumResult[0].rows.raw()[0]['logs_total'] || 0;
    const removedStockSum =
      removedStockSumResult[0].rows.raw()[0]['logs_total'] || 0;

    const categoryGrandTotal = addedStockSum - removedStockSum;

    // get category
    const getCategoryQuery = `SELECT * FROM categories WHERE id = '${categoryId}'`;
    const getCategoryResult = await db.executeSql(getCategoryQuery);
    const category = getCategoryResult[0].rows.item(0);

    // get category revenue group
    const getCategoryRevenueGroupQuery = `
      SELECT *,
      revenue_categories.id AS id,
      revenue_categories.revenue_group_id AS revenue_group_id,
      revenue_groups.name AS revenue_group_name
      FROM revenue_categories
      JOIN revenue_groups ON revenue_groups.id = revenue_categories.revenue_group_id
      WHERE category_id = '${categoryId}'
    `;

    const getCategoryRevenueGroupResult = await db.executeSql(
      getCategoryRevenueGroupQuery,
    );

    const categoryRevenueGroup = getCategoryRevenueGroupResult[0].rows.item(0);
    let currentMonthRevenueGroupAmount = 0;
    let isCategoryHasRevenueGroup = false;
    let revenueGroup = null;

    if (categoryRevenueGroup) {
      isCategoryHasRevenueGroup = true;
      revenueGroup = {
        id: categoryRevenueGroup.revenue_group_id,
        name: categoryRevenueGroup.revenue_group_name,
      };

      // get category revenue group id
      const revenueGroupId = categoryRevenueGroup.revenue_group_id;

      // Revenue group total for the current month = internal POS sales for the
      // group's categories + manual/external per-source amounts.
      const getCurrentMonthRevenueGroupAmountQuery = `
      SELECT ${buildRevenueGroupMonthTotalSql({
        groupIdSql: `'${revenueGroupId}'`,
        dateSql: `datetime('now', 'localtime')`,
      })} AS total_amount
    `;
      const getCurrentMonthRevenueGroupAmountResult = await db.executeSql(
        getCurrentMonthRevenueGroupAmountQuery,
      );
      currentMonthRevenueGroupAmount =
        getCurrentMonthRevenueGroupAmountResult[0].rows.raw()[0][
          'total_amount'
        ] || 0;
    }

    const costPercentage =
      (categoryGrandTotal / currentMonthRevenueGroupAmount) * 100;

    return {
      revenueGroup,
      isCategoryHasRevenueGroup,
      hasCurrentMonthRevenueGroupAmount: currentMonthRevenueGroupAmount
        ? true
        : false,
      result: costPercentage,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get category cost percentage.');
  }
};

export const addInventoryLog = async ({
  log,
  onLimitReached,
  onError,
  onSuccess,
}) => {
  try {
    const db = await getDBConnection();

    if (await isMutationDisabled()) {
      onLimitReached &&
        onLimitReached({
          message: `Your items are now in Read-Only Mode and you are now`,
        });
      console.debug('Failed to add/remove stock, mutation is disabled.');

      return;
    }

    /**
     * Get inventory operation
     */
    const getInventoryOperationQuery = `SELECT * FROM operations WHERE id = '${log.operation_id}'`;
    const getInventoryOperationQueryResult = await db.executeSql(
      getInventoryOperationQuery,
    );
    const inventoryOperation = getInventoryOperationQueryResult[0].rows.item(0);

    if (!inventoryOperation) {
      throw new Error(
        `Inventory operation not found for id: ${log.operation_id}`,
      );
    }

    /**
     * Get item
     */
    const getItemQueryData = await getItem({
      queryKey: ['item', {id: log.item_id}],
    });
    const item = getItemQueryData?.result;

    if (!item) {
      throw new Error('Failed to fetch item.');
    }

    /**
     * Get item with current stock quantity field
     */
    let currentStockQty = item.current_stock_qty;
    let adjustmentQty = parseFloat(log.adjustment_qty);

    let latestUnitCost = parseFloat(log.adjustment_unit_cost || 0);

    /**
     * Validate current stock qty if less than the adjustment qty
     */
    if (inventoryOperation.type === 'remove_stock') {
      if (currentStockQty < adjustmentQty) {
        onError &&
          onError({
            errorMessage:
              'Current stock cannot be updated. Item has low stock than the given adjustment quantity',
          });
        throw new Error(
          'Current stock cannot be updated. Item has low stock than the given adjustment quantity',
        );
      }
    }

    /**
     * Update item
     */
    const updateItemQuery = `UPDATE items
      SET unit_cost = ${latestUnitCost},
      updated_at = CURRENT_TIMESTAMP
      WHERE id = '${log.item_id}'
    `;

    if (inventoryOperation.type === 'add_stock') {
      await db.executeSql(updateItemQuery);
    }

    /**
     * Insert inventory log
     */

    let tax = {
      id: null,
      name: '',
      rate_percentage: 0,
    };

    // validate tax id
    if (log.tax_id) {
      const getTaxQuery = `
      SELECT * FROM taxes WHERE id = '${log.tax_id}'
    `;

      const getTaxResult = await db.executeSql(getTaxQuery);
      const fetchedTax = getTaxResult[0].rows.item(0);

      if (!fetchedTax) {
        // tax maybe deleted
      } else {
        tax = fetchedTax;
      }
    }

    let vendor = {
      id: null,
      vendor_display_name: '',
    };

    // validate vendor id
    if (log.vendor_id) {
      const getVendorQuery = `
      SELECT * FROM vendors WHERE id = '${log.vendor_id}'
    `;

      const getVendorResult = await db.executeSql(getVendorQuery);
      const fetchedVendor = getVendorResult[0].rows.item(0);

      if (!fetchedVendor) {
        // vendor maybe deleted
      } else {
        vendor = fetchedVendor;
      }
    }

    let unitCost = latestUnitCost;
    let qty = parseFloat(log.adjustment_qty || 0);

    if (log.use_measurement_per_piece) {
      qty = qty / item.qty_per_piece;
    }

    let taxRatePercentage = parseFloat(tax?.rate_percentage || 0);
    let unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
    let unitCostTax = unitCost - unitCostNet;
    let taxId = tax.id ? `'${tax.id}'` : 'null';
    let taxName = tax.name ? `'${tax.name.replace(/\'/g, "''")}'` : 'null';
    let vendorId = vendor.id ? `'${vendor.id}'` : 'null';
    let vendorDisplayName = vendor.vendor_display_name
      ? `'${vendor.vendor_display_name.replace(/\'/g, "''")}'`
      : 'null';

    if (inventoryOperation.type === 'remove_stock') {
      unitCost = parseFloat(item.avg_unit_cost_net || 0); // when removing stock, we always use avg net cost
      unitCostNet = parseFloat(item.avg_unit_cost_net || 0);
      unitCostTax = parseFloat(0);
      taxId = 'null';
      taxName = 'null';
      taxRatePercentage = 0;
      vendorId = 'null';
      vendorDisplayName = 'null';
    }

    const officialReceiptNumber = log.official_receipt_number
      ? `'${log.official_receipt_number}'`
      : 'null';

    const adjustmentDate = log.adjustment_date
      ? `datetime('${log.adjustment_date}')`
      : `datetime('now', 'localtime')`;

    const {deviceId, branchId} = await getCloudSyncParams();
    const newLogId = uuid.v4();
    const addInventoryLogQuery = `INSERT INTO inventory_logs (
      id,
      operation_id,
      item_id,
      ref_tax_id,
      ref_vendor_id,
      vendor_display_name,
      adjustment_unit_cost,
      adjustment_unit_cost_net,
      adjustment_unit_cost_tax,
      adjustment_tax_rate_percentage,
      adjustment_tax_name,
      adjustment_qty,
      adjustment_date,
      official_receipt_number,
      remarks,
      device_id,
      branch_id,
      sync_id,
      updated_at
    )

    VALUES(
      '${newLogId}',
      '${log.operation_id}',
      '${item.id}',
      ${taxId},
      ${vendorId},
      ${vendorDisplayName},
      ${unitCost},
      ${unitCostNet},
      ${unitCostTax},
      ${taxRatePercentage},
      ${taxName},
      ${qty},
      ${adjustmentDate},
      ${officialReceiptNumber},
      '${log.remarks ? log.remarks.replace(/\'/g, "''") : ''}',
      ${deviceId ? `'${deviceId}'` : 'NULL'},
      ${branchId ? `'${branchId}'` : 'NULL'},
      '${newLogId}',
      CURRENT_TIMESTAMP
    );`;

    await db.executeSql(addInventoryLogQuery);
    scheduleSyncSoon();
    onSuccess && onSuccess();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to add inventory log.');
  }
};

export const getItemAvgUnitCost = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const getAvgUnitCostQuery = `SELECT avg(adjustment_unit_cost)
    FROM inventory_logs
    INNER JOIN operations ON operations.id = inventory_logs.operation_id
    INNER JOIN items ON items.id = inventory_logs.item_id
    WHERE inventory_logs.item_id = '${id}'
    AND inventory_logs.voided != 1
    AND operations.code = 'new_purchase'
  ;`;

  const getItemQuery = `SELECT * FROM items WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(getAvgUnitCostQuery);
    let itemAvgUnitCost = result[0].rows.item(0)['avg(adjustment_unit_cost)'];

    if (!itemAvgUnitCost) {
      const getItemResult = await db.executeSql(getItemQuery);
      itemAvgUnitCost = getItemResult[0].rows.item(0)?.unit_cost;
    }

    return {
      result: itemAvgUnitCost,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get item average unit cost.');
  }
};

export const getItemCurrentStockQuantity = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const getItemQuery = `SELECT * FROM items WHERE id = '${id}'`;

  const totalAddedStocksQuery = `SELECT sum(adjustment_qty)
    FROM inventory_logs
    INNER JOIN operations ON operations.id = inventory_logs.operation_id
    INNER JOIN items ON items.id = inventory_logs.item_id
    WHERE inventory_logs.item_id = '${id}'
    AND inventory_logs.voided != 1
    AND operations.type = 'add_stock'
  ;`;

  const totalRemovedStocksQuery = `SELECT sum(adjustment_qty)
    FROM inventory_logs
    INNER JOIN operations ON operations.id = inventory_logs.operation_id
    INNER JOIN items ON items.id = inventory_logs.item_id
    WHERE inventory_logs.item_id = '${id}'
    AND inventory_logs.voided != 1
    AND operations.type = 'remove_stock'
  ;`;

  try {
    const db = await getDBConnection();
    const itemQueryResult = await db.executeSql(getItemQuery);
    const addedStocksQueryResult = await db.executeSql(totalAddedStocksQuery);
    const removedStocksQueryResult = await db.executeSql(
      totalRemovedStocksQuery,
    );
    const totalAddedStocks =
      addedStocksQueryResult[0].rows.item(0)['sum(adjustment_qty)'] || 0;
    const totalRemovedStocks =
      removedStocksQueryResult[0].rows.item(0)['sum(adjustment_qty)'] || 0;

    const beginningInventory =
      itemQueryResult[0].rows.item(0)?.initial_stock_qty || 0;

    return {
      result: {
        beginning_inventory: beginningInventory,
        total_added_stocks: totalAddedStocks,
        total_removed_stocks: totalRemovedStocks,
        current_stock_qty:
          parseFloat(beginningInventory) +
          parseFloat(totalAddedStocks) -
          parseFloat(totalRemovedStocks),
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get item average unit cost.');
  }
};

export const getItemInitialStockLog = async ({queryKey}) => {
  const [_key, {itemId}] = queryKey;

  try {
    const db = await getDBConnection();

    /**
     * Get item initial stock inventory log (operation code = 'pre_app_stock')
     * Returns null if no initial stock log exists (e.g., item created via IDT with purchase date)
     */
    const getItemInitStockLogQuery = `SELECT * FROM inventory_logs WHERE voided != 1 AND item_id = '${itemId}' AND operation_id = (SELECT id FROM operations WHERE code = 'pre_app_stock')`;

    const getItemInitStockLogResult = await db.executeSql(
      getItemInitStockLogQuery,
    );
    const log = getItemInitStockLogResult[0].rows.item(0);

    // Return null if no initial stock log found (not an error)
    // This is normal for items imported via IDT with a purchase date
    return {
      result: log || null,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get item init stock inventory log.');
  }
};
