import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import {
  getDBConnection,
  getCloudSyncParams,
  OPERATION_DEFAULT_UUIDS,
} from '../localDb';
import {createQueryFilter} from '../utils/localDbQueryHelpers';
import {
  selectedMonthTotalsBlock,
  previousMonthTotalsBlock,
  selectedMonthAddedAndRemovedBlock,
  revenueGroupNameSubquery,
  revenueGroupTotalForCategorySql,
} from './reportsSqlBuilders';
import {scheduleSyncSoon} from '../services/syncService';

export const createItemEndingInventoryEntry = async ({
  itemId,
  monthYearDateFilter,
  values,
  onError,
}) => {
  try {
    let item = null;

    const query = `
      SELECT items.id AS id,
      items.id AS item_id,
      items.name AS item_name,
      items.current_stock_qty AS item_current_stock_qty,
      items.uom_abbrev AS item_uom_abbrev,

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
      previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_grand_total_cost_tax,

      selected_month_added_and_removed.total_added_stock_qty AS selected_month_total_added_stock_qty,
      selected_month_added_and_removed.total_removed_stock_qty AS selected_month_total_removed_stock_qty,
      
      ${revenueGroupNameSubquery('items.category_id')},
      ${revenueGroupTotalForCategorySql(
        'items.category_id',
        monthYearDateFilter,
      )} AS selected_month_revenue_group_total_amount

      FROM active_items items
      ${selectedMonthTotalsBlock('item', monthYearDateFilter)}
      ${previousMonthTotalsBlock('item', monthYearDateFilter)}
      ${selectedMonthAddedAndRemovedBlock(monthYearDateFilter)}

      JOIN active_categories categories ON categories.id = items.category_id
      WHERE items.id = '${itemId}'
    `;

    const db = await getDBConnection();
    const result = await db.executeSql(query);

    item = result[0].rows.item(0);

    if (!item) {
      throw Error('Failed to fetch item.');
    }

    const previousMonthGrandTotalQty = item.previous_month_grand_total_qty || 0;
    const selectedMonthTotalAddedStockQty =
      item.selected_month_total_added_stock_qty || 0;
    const selectedMonthTotalRemovedStockQty =
      item.selected_month_total_removed_stock_qty || 0;

    let updateValuesAddedStock = selectedMonthTotalAddedStockQty;
    let updateValuesRemovedStock = selectedMonthTotalRemovedStockQty;

    let defaultCurrentStockQty =
      previousMonthGrandTotalQty +
      selectedMonthTotalAddedStockQty -
      selectedMonthTotalRemovedStockQty;

    let remainingStockQty = parseFloat(values.remaining_stock_qty || 0);

    let numberOfStocksToAdd = 0;
    let numberOfStocksToRemove = 0;

    if (remainingStockQty > defaultCurrentStockQty) {
      // add stock
      updateValuesAddedStock =
        updateValuesAddedStock + (remainingStockQty - defaultCurrentStockQty);

      numberOfStocksToAdd = remainingStockQty - defaultCurrentStockQty;
    } else if (remainingStockQty < defaultCurrentStockQty) {
      // remove stock
      updateValuesRemovedStock =
        updateValuesRemovedStock + (defaultCurrentStockQty - remainingStockQty);

      numberOfStocksToRemove = defaultCurrentStockQty - remainingStockQty;
    }

    /**
     * Validate Ending Inventory:
     * Prevent user to input Ending Inventory (Remaining stock quantity) that is greater
     * than the sum of beginning inventory and added stocks. Instead, force user to go
     * to that specific item's "Manage Stock" screen and let the user input that additional
     * quantity as New Purchase or Inventory Re-count.
     */
    if (numberOfStocksToAdd > 0) {
      onError &&
        onError({
          fieldName: 'remaining_stock_qty',
          errorMessage: 'Unable to add item stock using Ending Inventory.',
        });
      throw Error('Unable to add item stock using Ending Inventory.');
    }

    if (numberOfStocksToRemove === 0) return;

    /**
     * Insert inventory log (Stock Usage)
     */

    const avgUnitCost = parseFloat(item.avg_unit_cost_net || 0); // we always use avg unit cost net when removing stock as Stock Usage
    const avgUnitCostNet = parseFloat(item.avg_unit_cost_net || 0);
    const avgUnitCostTax = parseFloat(0);

    let qty = 0;

    if (numberOfStocksToAdd > 0) {
      qty = parseFloat(numberOfStocksToAdd);
    } else if (numberOfStocksToRemove > 0) {
      qty = parseFloat(numberOfStocksToRemove);
    }

    const adjustmentDate = monthYearDateFilter
      ? `datetime('${monthYearDateFilter}')`
      : `datetime('now', 'localtime')`;

    // Use operation codes: stock_usage for remove, inventory_recount_in for add
    let operationUUID = OPERATION_DEFAULT_UUIDS.stock_usage;

    if (numberOfStocksToAdd > 0) {
      operationUUID = OPERATION_DEFAULT_UUIDS.inventory_recount_in;
    }

    const {deviceId, branchId} = await getCloudSyncParams();
    const newInventoryLogId = uuid.v4();
    const addInventoryLogQuery = `INSERT INTO inventory_logs (
      id,
      operation_id,
      item_id,
      adjustment_unit_cost,
      adjustment_unit_cost_net,
      adjustment_unit_cost_tax,
      adjustment_qty,
      adjustment_date,
      device_id,
      branch_id,
      sync_id,
      updated_at
    )

    VALUES(
      '${newInventoryLogId}',
      '${operationUUID}',
      '${item.id}',
      ${avgUnitCost},
      ${avgUnitCostNet},
      ${avgUnitCostTax},
      ${qty},
      ${adjustmentDate},
      ${deviceId ? `'${deviceId}'` : 'NULL'},
      ${branchId ? `'${branchId}'` : 'NULL'},
      '${newInventoryLogId}',
      CURRENT_TIMESTAMP
    );`;

    scheduleSyncSoon();
    return db.executeSql(addInventoryLogQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create ending inventory entry.');
  }
};
