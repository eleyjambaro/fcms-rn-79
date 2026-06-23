import AsyncStorage from '@react-native-async-storage/async-storage';
import convert from 'convert-units';
import uuid from 'react-native-uuid';
import {getDBConnection, getCloudSyncParams} from '../localDb';
import {createQueryFilter} from '../utils/localDbQueryHelpers';
import {scheduleSyncSoon} from '../services/syncService';
import {periodTotalsBlock, EARLIEST_LOG_DATE} from './reportsSqlBuilders';

// NOTE: `./inventoryLogs` and `./items` are required lazily inside the functions
// that need them (addSpoilage / updateSpoilage / deleteSpoilage) rather than
// imported at the top. Their transitive deps (operations → appDefaults →
// react-native-fs) are native-only and break Jest's module-eval of this file,
// which the spoilage SQL tests import for the report builders.

/**
 * Settings > Inventory Settings > "Auto-deduct spoilages". When on, recording a
 * spoilage also writes a Stock Usage inventory log (tagged with the spoilage id)
 * that reduces stock; when off, a spoilage stays a standalone loss record.
 */
const isAutoDeductSpoilagesEnabled = async db => {
  const result = await db.executeSql(
    `SELECT value FROM settings WHERE name = 'auto_deduct_spoilages' LIMIT 1`,
  );
  return result[0].rows.item(0)?.value === '1';
};

/** The fixed `stock_usage` (remove_stock) operation id, or null if unseeded. */
const getStockUsageOperationId = async db => {
  const result = await db.executeSql(
    `SELECT id FROM operations WHERE code = 'stock_usage' LIMIT 1`,
  );
  return result[0].rows.item(0)?.id || null;
};

// TODO: Make it deleteSelectedMonthSpoilages
export const deleteRecipeIngredients = async ({id}) => {
  const deleteRecipeIngredientsQuery = `UPDATE ingredients SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE recipe_id = '${id}'`;

  try {
    const db = await getDBConnection();

    const deleteRecipeIngredientsResult = await db.executeSql(
      deleteRecipeIngredientsQuery,
    );

    if (!deleteRecipeIngredientsResult[0].rowsAffected > 0) {
      throw Error(`Failed to delete ingredients of recipe with id ${id}.`);
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete ingredients of recipe.');
  }
};

export const addSpoilage = async ({values}) => {
  const getItemQuery = `SELECT * FROM active_items items WHERE id = '${values.item_id}'`;

  try {
    const db = await getDBConnection();

    const getItemResult = await db.executeSql(getItemQuery);
    const item = getItemResult[0].rows.item(0);

    if (!item) {
      throw Error('Failed to fetch item');
    }

    let inSpoilageQtyBasedOnItemUom;

    if (values.use_measurement_per_piece) {
      const convertedQtyBasedOnItemUOMPerPiece = convert(
        parseFloat(values.in_spoilage_qty),
      )
        .from(values.in_spoilage_uom_abbrev)
        .to(item.uom_abbrev_per_piece);

      const qtyInPiece =
        parseFloat(convertedQtyBasedOnItemUOMPerPiece) / item.qty_per_piece;
      inSpoilageQtyBasedOnItemUom = qtyInPiece;
    } else {
      inSpoilageQtyBasedOnItemUom = convert(parseFloat(values.in_spoilage_qty))
        .from(values.in_spoilage_uom_abbrev)
        .to(item.uom_abbrev);
    }

    // Auto-deduct: resolve the Stock Usage operation and guard stock BEFORE
    // recording anything, so an insufficient-stock case records neither the
    // spoilage nor the deduction (mirrors the web's transactional behaviour).
    const autoDeduct = await isAutoDeductSpoilagesEnabled(db);
    let stockUsageOperationId = null;

    if (autoDeduct) {
      const {getItem} = require('./items');

      stockUsageOperationId = await getStockUsageOperationId(db);
      if (!stockUsageOperationId) {
        throw Error('Stock Usage operation not found.');
      }

      const itemData = await getItem({queryKey: ['item', {id: values.item_id}]});
      const currentStockQty = parseFloat(
        itemData?.result?.current_stock_qty || 0,
      );
      if (currentStockQty < parseFloat(inSpoilageQtyBasedOnItemUom)) {
        throw Error('Not enough stock to auto-deduct this spoilage.');
      }
    }

    const spoilageDate = values.in_spoilage_date
      ? `datetime('${values.in_spoilage_date}')`
      : `datetime('now', 'localtime')`;

    const {deviceId, branchId} = await getCloudSyncParams();
    const newSpoilageId = uuid.v4();
    const createSpoilageQuery = `INSERT INTO spoilages (
      id,
      item_id,
      in_spoilage_qty,
      in_spoilage_uom_abbrev,
      in_spoilage_qty_based_on_item_uom,
      use_measurement_per_piece,
      in_spoilage_date,
      remarks,
      device_id,
      branch_id,
      sync_id,
      updated_at
    )

    VALUES(
      '${newSpoilageId}',
      '${values.item_id}',
      ${parseFloat(values.in_spoilage_qty)},
      '${values.in_spoilage_uom_abbrev}',
      ${parseFloat(inSpoilageQtyBasedOnItemUom)},
      ${values.use_measurement_per_piece === true ? 1 : 0},
      ${spoilageDate},
      '${values.remarks ? values.remarks.replace(/\'/g, "''") : ''}',
      ${deviceId ? `'${deviceId}'` : 'NULL'},
      ${branchId ? `'${branchId}'` : 'NULL'},
      '${newSpoilageId}',
      CURRENT_TIMESTAMP
    );`;

    // add new spoilage
    const createSpoilageResult = await db.executeSql(createSpoilageQuery);

    // Auto-deduct: write the linked Stock Usage log. addInventoryLog re-checks
    // stock and values the removal at the item's moving-avg net cost.
    if (autoDeduct) {
      const {addInventoryLog} = require('./inventoryLogs');
      await addInventoryLog({
        log: {
          operation_id: stockUsageOperationId,
          item_id: values.item_id,
          adjustment_qty: parseFloat(inSpoilageQtyBasedOnItemUom),
          adjustment_date: values.in_spoilage_date,
          remarks: values.remarks,
          spoilage_id: newSpoilageId,
        },
      });
    }

    scheduleSyncSoon();
    const spoilage = createSpoilageResult[0].rows.item(0);

    return spoilage;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to add spoilage.');
  }
};

export const getSpoilages = async ({queryKey, pageParam = 1}) => {
  const [
    _key,
    {
      filter,
      monthYearDateFilter,
      selectedMonthYearDateFilter,
      exactDateFilter,
      monthToDateFilter,
      dateRangeFilter,
      limit = 1000000000,
      listOrder = 'DESC',
    },
  ] = queryKey;
  const orderBy = 'spoilages.in_spoilage_date';

  let selectedEndDate = ``;

  let additionalFilter = {};

  if (monthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${monthYearDateFilter}', 'start of month')`,
      end: `DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };

    selectedEndDate = `DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (selectedMonthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${selectedMonthYearDateFilter}', 'start of month')`,
      end: `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };

    selectedEndDate = `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (exactDateFilter) {
    additionalFilter[
      'DATE(spoilages.in_spoilage_date)'
    ] = `DATE('${exactDateFilter}')`;

    selectedEndDate = `DATE('${exactDateFilter}')`;
  } else if (monthToDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${monthToDateFilter.start}', 'start of month')`,
      end: `DATE('${monthToDateFilter.end}')`,
    };

    selectedEndDate = `DATE('${monthToDateFilter.end}')`;
  } else if (dateRangeFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${dateRangeFilter.start}')`,
      end: `DATE('${dateRangeFilter.end}')`,
    };

    selectedEndDate = `DATE('${dateRangeFilter.end}')`;
  }

  let queryFilter = createQueryFilter(filter, additionalFilter);

  try {
    const db = await getDBConnection();
    const spoilages = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ${listOrder}` : '';
    const selectQuery = `
      SELECT *,
      spoilages.id AS id,
      spoilages.item_id AS item_id,
      spoilages.remarks AS remarks,
      items.unit_cost AS inventory_unit_cost,
      items.name AS name,

      categories.name AS item_category_name,

      selected_month_totals.selected_month_total_added_stock_cost AS selected_month_total_added_stock_cost,
      selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_total_removed_stock_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net AS selected_month_total_added_stock_cost_net,
      selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_total_removed_stock_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax AS selected_month_total_added_stock_cost_tax,
      selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_total_removed_stock_cost_tax,
      selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty AS selected_month_grand_total_qty,
      selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_grand_total_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_grand_total_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_grand_total_cost_tax,

      ((selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost,
      ((selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost_net,
      ((selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost_tax,

      (selected_month_totals.selected_month_total_added_stock_cost / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost,
      (selected_month_totals.selected_month_total_added_stock_cost_net / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost_net,
      (selected_month_totals.selected_month_total_added_stock_cost_tax / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost_tax,

      ((selected_month_totals.selected_month_total_added_stock_cost / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom) AS total_cost,
      ((selected_month_totals.selected_month_total_added_stock_cost_net / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom) AS total_cost_net,
      ((selected_month_totals.selected_month_total_added_stock_cost_tax / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom) AS total_cost_tax,

      previous_month_totals.previous_month_total_added_stock_qty AS previous_month_total_added_stock_qty,
      previous_month_totals.previous_month_total_removed_stock_qty AS previous_month_total_removed_stock_qty,
      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_cost,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net AS previous_month_total_added_stock_cost_net,
      previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_total_removed_stock_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax AS previous_month_total_added_stock_cost_tax,
      previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_total_removed_stock_cost_tax,
      previous_month_totals.previous_month_total_added_stock_qty - previous_month_totals.previous_month_total_removed_stock_qty AS previous_month_grand_total_qty,
      previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_grand_total_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_grand_total_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_grand_total_cost_tax
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM active_spoilages spoilages

      ${periodTotalsBlock({
        entity: 'item',
        outer: 'selected_month_totals',
        inner: 'selected_month_total_added_and_removed',
        logs: 'from_earliest_to_selected_month_logs',
        prefix: 'selected_month_total',
        start: EARLIEST_LOG_DATE,
        end: selectedEndDate,
        joinTo: 'spoilages.item_id',
      })}

      ${periodTotalsBlock({
        entity: 'item',
        outer: 'previous_month_totals',
        inner: 'previous_month_total_added_and_removed',
        logs: 'from_earliest_to_previous_month_logs',
        prefix: 'previous_month_total',
        start: EARLIEST_LOG_DATE,
        end: selectedEndDate,
        joinTo: 'spoilages.item_id',
      })}

      INNER JOIN active_items items
      ON items.id = spoilages.item_id
      INNER JOIN active_categories categories
      ON categories.id = items.category_id

      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        spoilages.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: spoilages,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get spoilages.');
  }
};

export const getSpoilagesTotal = async ({queryKey, pageParam = 1}) => {
  const [
    _key,
    {
      filter,
      monthYearDateFilter,
      selectedMonthYearDateFilter,
      exactDateFilter,
      monthToDateFilter,
      dateRangeFilter,
    },
  ] = queryKey;

  let selectedEndDate = ``;

  let additionalFilter = {};

  if (monthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${monthYearDateFilter}', 'start of month')`,
      end: `DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };

    selectedEndDate = `DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (selectedMonthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${selectedMonthYearDateFilter}', 'start of month')`,
      end: `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };

    selectedEndDate = `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (exactDateFilter) {
    additionalFilter[
      'DATE(spoilages.in_spoilage_date)'
    ] = `DATE('${exactDateFilter}')`;

    selectedEndDate = `DATE('${exactDateFilter}')`;
  } else if (monthToDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${monthToDateFilter.start}', 'start of month')`,
      end: `DATE('${monthToDateFilter.end}')`,
    };

    selectedEndDate = `DATE('${monthToDateFilter.end}')`;
  } else if (dateRangeFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${dateRangeFilter.start}')`,
      end: `DATE('${dateRangeFilter.end}')`,
    };

    selectedEndDate = `DATE('${dateRangeFilter.end}')`;
  }

  let queryFilter = createQueryFilter(filter, additionalFilter);

  try {
    const db = await getDBConnection();
    const query = `
      SELECT *,

      selected_month_totals.selected_month_total_added_stock_cost AS selected_month_total_added_stock_cost,
      selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_total_removed_stock_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net AS selected_month_total_added_stock_cost_net,
      selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_total_removed_stock_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax AS selected_month_total_added_stock_cost_tax,
      selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_total_removed_stock_cost_tax,
      selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty AS selected_month_grand_total_qty,
      selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_grand_total_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_grand_total_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_grand_total_cost_tax,

      ((selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost,
      ((selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost_net,
      ((selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost_tax,

      (selected_month_totals.selected_month_total_added_stock_cost / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost,
      (selected_month_totals.selected_month_total_added_stock_cost_net / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost_net,
      (selected_month_totals.selected_month_total_added_stock_cost_tax / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost_tax,

      SUM(((selected_month_totals.selected_month_total_added_stock_cost / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom)) AS total_cost,
      SUM(((selected_month_totals.selected_month_total_added_stock_cost_net / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom)) AS total_cost_net,
      SUM(((selected_month_totals.selected_month_total_added_stock_cost_tax / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom)) AS total_cost_tax,

      previous_month_totals.previous_month_total_added_stock_qty AS previous_month_total_added_stock_qty,
      previous_month_totals.previous_month_total_removed_stock_qty AS previous_month_total_removed_stock_qty,
      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_cost,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net AS previous_month_total_added_stock_cost_net,
      previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_total_removed_stock_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax AS previous_month_total_added_stock_cost_tax,
      previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_total_removed_stock_cost_tax,
      previous_month_totals.previous_month_total_added_stock_qty - previous_month_totals.previous_month_total_removed_stock_qty AS previous_month_grand_total_qty,
      previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_grand_total_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_grand_total_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_grand_total_cost_tax
  
      FROM active_spoilages spoilages

      ${periodTotalsBlock({
        entity: 'item',
        outer: 'selected_month_totals',
        inner: 'selected_month_total_added_and_removed',
        logs: 'from_earliest_to_selected_month_logs',
        prefix: 'selected_month_total',
        start: EARLIEST_LOG_DATE,
        end: selectedEndDate,
        joinTo: 'spoilages.item_id',
      })}

      ${periodTotalsBlock({
        entity: 'item',
        outer: 'previous_month_totals',
        inner: 'previous_month_total_added_and_removed',
        logs: 'from_earliest_to_previous_month_logs',
        prefix: 'previous_month_total',
        start: EARLIEST_LOG_DATE,
        end: selectedEndDate,
        joinTo: 'spoilages.item_id',
      })}

      INNER JOIN active_items items
      ON items.id = spoilages.item_id

      ${queryFilter}
    ;`;

    const result = await db.executeSql(query);
    const totalCost = result[0].rows.raw()[0]['total_cost'] || 0;
    const totalCostNet = result[0].rows.raw()[0]['total_cost_net'] || 0;
    const totalCostTax = result[0].rows.raw()[0]['total_cost_tax'] || 0;

    return {
      totalCost,
      totalCostNet,
      totalCostTax,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get spoilages.');
  }
};

export const getSpoilage = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `
    SELECT
      spoilages.*,
      items.name AS item_name,
      items.uom_abbrev AS item_uom_abbrev,
      items.uom_abbrev_per_piece AS item_uom_abbrev_per_piece,
      items.qty_per_piece AS item_qty_per_piece,
      categories.name AS item_category_name
    FROM active_spoilages spoilages
    INNER JOIN active_items items ON items.id = spoilages.item_id
    LEFT JOIN active_categories categories ON categories.id = items.category_id
    WHERE spoilages.id = '${id}'
    LIMIT 1;
  `;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);
    const spoilage = result[0].rows.item(0);

    if (!spoilage) {
      return {result: null};
    }

    // Value the loss at the item's current moving-average net cost (same basis
    // as an auto-deducted Stock Usage log). `./items` and `./inventoryLogs` are
    // required lazily — see the note at the top of this file.
    const {getItem} = require('./items');
    const {getInventoryLogBySpoilageId} = require('./inventoryLogs');

    const itemData = await getItem({queryKey: ['item', {id: spoilage.item_id}]});
    const avgUnitCostNet = parseFloat(itemData?.result?.avg_unit_cost_net || 0);
    const totalCostNet =
      avgUnitCostNet * parseFloat(spoilage.in_spoilage_qty_based_on_item_uom || 0);

    // Linked Stock Usage log — present only when the spoilage was auto-deducted.
    const linkedLog = await getInventoryLogBySpoilageId(id);

    return {
      result: {
        ...spoilage,
        avg_unit_cost_net: avgUnitCostNet,
        total_cost_net: totalCostNet,
        inventory_log_id: linkedLog?.id || null,
        deducted: !!linkedLog,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch spoilage.');
  }
};

export const updateSpoilage = async ({id, updatedValues}) => {
  try {
    const db = await getDBConnection();

    const getSpoilageQuery = `SELECT * FROM active_spoilages spoilages WHERE id = '${id}'`;
    const getSpoilageResult = await db.executeSql(getSpoilageQuery);
    const spoilage = getSpoilageResult[0].rows.item(0);

    if (!spoilage) {
      throw Error('Failed to fetch spoilage');
    }

    const getItemQuery = `SELECT * FROM active_items items WHERE id = '${spoilage.item_id}'`;
    const getItemResult = await db.executeSql(getItemQuery);
    const item = getItemResult[0].rows.item(0);

    if (!item) {
      throw Error('Failed to fetch item');
    }

    let inSpoilageQtyBasedOnItemUom;

    if (updatedValues.use_measurement_per_piece) {
      const convertedQtyBasedOnItemUOMPerPiece = convert(
        parseFloat(updatedValues.in_spoilage_qty),
      )
        .from(updatedValues.in_spoilage_uom_abbrev)
        .to(item.uom_abbrev_per_piece);

      const qtyInPiece =
        parseFloat(convertedQtyBasedOnItemUOMPerPiece) / item.qty_per_piece;
      inSpoilageQtyBasedOnItemUom = qtyInPiece;
    } else {
      inSpoilageQtyBasedOnItemUom = convert(
        parseFloat(updatedValues.in_spoilage_qty),
      )
        .from(updatedValues.in_spoilage_uom_abbrev)
        .to(item.uom_abbrev);
    }

    const spoilageDate = updatedValues.in_spoilage_date
      ? `datetime('${updatedValues.in_spoilage_date}')`
      : `datetime('now', 'localtime')`;

    const updateSpoilageQuery = `
      UPDATE spoilages
      SET in_spoilage_qty = ${parseFloat(updatedValues.in_spoilage_qty)},
      in_spoilage_uom_abbrev = '${updatedValues.in_spoilage_uom_abbrev}',
      in_spoilage_qty_based_on_item_uom = ${parseFloat(
        inSpoilageQtyBasedOnItemUom,
      )},
      use_measurement_per_piece = ${
        updatedValues.use_measurement_per_piece === true ? 1 : 0
      },
      in_spoilage_date = ${spoilageDate},
      remarks = '${
        updatedValues.remarks ? updatedValues.remarks.replace(/\'/g, "''") : ''
      }',
      updated_at = CURRENT_TIMESTAMP
      WHERE id = '${id}'
    `;

    const result = await db.executeSql(updateSpoilageQuery);

    // Keep an auto-deducted spoilage's Stock Usage log in step: the deducted qty
    // follows in_spoilage_qty_based_on_item_uom and the log date follows the
    // spoilage date. Re-values at the item's current moving-avg net cost. No-op
    // when the spoilage wasn't auto-deducted (no linked log exists).
    const {getInventoryLogBySpoilageId} = require('./inventoryLogs');
    const {getItem} = require('./items');
    const linkedLog = await getInventoryLogBySpoilageId(id);
    if (linkedLog) {
      const itemData = await getItem({queryKey: ['item', {id: spoilage.item_id}]});
      const avgUnitCostNet = parseFloat(
        itemData?.result?.avg_unit_cost_net || 0,
      );

      const updateLinkedLogQuery = `
        UPDATE inventory_logs
        SET adjustment_qty = ${parseFloat(inSpoilageQtyBasedOnItemUom)},
        adjustment_unit_cost = ${avgUnitCostNet},
        adjustment_unit_cost_net = ${avgUnitCostNet},
        adjustment_unit_cost_tax = 0,
        adjustment_date = ${spoilageDate},
        remarks = '${
          updatedValues.remarks
            ? updatedValues.remarks.replace(/\'/g, "''")
            : ''
        }',
        updated_at = CURRENT_TIMESTAMP
        WHERE id = '${linkedLog.id}'
      `;
      await db.executeSql(updateLinkedLogQuery);
    }

    scheduleSyncSoon();
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update spoilage.');
  }
};

export const deleteSpoilage = async ({id}) => {
  const query = `UPDATE spoilages SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();

    // Void the linked Stock Usage log first (restores the deducted stock) so a
    // removed spoilage no longer affects inventory.
    const {
      getInventoryLogBySpoilageId,
      voidInventoryLog,
    } = require('./inventoryLogs');
    const linkedLog = await getInventoryLogBySpoilageId(id);
    if (linkedLog) {
      await voidInventoryLog({id: linkedLog.id});
    }

    await db.executeSql(query);
    scheduleSyncSoon();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete spoilage.');
  }
};
