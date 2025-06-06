import AsyncStorage from '@react-native-async-storage/async-storage';
import {getDBConnection} from '../localDb';
import {createQueryFilter} from '../utils/localDbQueryHelpers';

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

      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_qty,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_qty,
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
      
      (
        SELECT name
        FROM revenue_groups
        WHERE revenue_groups.id = (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE category_id = items.category_id
          ORDER BY date_created DESC
        )
      ) AS revenue_group_name,
      (
        SELECT SUM(amount) AS selected_month_revenue_group_total_amount
        FROM revenues
        WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${monthYearDateFilter}'))
        AND revenue_group_id = (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE category_id = items.category_id
          ORDER BY date_created DESC
        )
      ) AS selected_month_revenue_group_total_amount

      FROM items

      LEFT JOIN (
        SELECT selected_month_total_added_and_removed.item_id AS item_id,
        selected_month_total_added_and_removed.item_name AS item_name,
        selected_month_total_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_qty END), 0) AS selected_month_total_added_stock_qty,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_qty END), 0) AS selected_month_total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_qty,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_net * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_tax * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM (
            SELECT * FROM inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS from_earliest_to_selected_month_logs
          LEFT JOIN items ON items.id = from_earliest_to_selected_month_logs.item_id
          LEFT JOIN operations ON operations.id = from_earliest_to_selected_month_logs.operation_id
          GROUP BY from_earliest_to_selected_month_logs.item_id, operations.type
        ) AS selected_month_total_added_and_removed
        LEFT JOIN items ON items.id = selected_month_total_added_and_removed.item_id
        GROUP BY selected_month_total_added_and_removed.item_id
      ) AS selected_month_totals
      ON selected_month_totals.item_id = items.id

      LEFT JOIN (
        SELECT previous_month_total_added_and_removed.item_id AS item_id,
        previous_month_total_added_and_removed.item_name AS item_name,
        previous_month_total_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_qty END), 0) AS previous_month_total_added_stock_qty,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_qty END), 0) AS previous_month_total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_qty,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_net * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_tax * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM (
            SELECT * FROM inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${monthYearDateFilter}', 'start of month', '-1 day')
          ) AS from_earliest_to_previous_month_logs
          LEFT JOIN items ON items.id = from_earliest_to_previous_month_logs.item_id
          LEFT JOIN operations ON operations.id = from_earliest_to_previous_month_logs.operation_id
          GROUP BY from_earliest_to_previous_month_logs.item_id, operations.type
        ) AS previous_month_total_added_and_removed
        LEFT JOIN items ON items.id = previous_month_total_added_and_removed.item_id
        GROUP BY previous_month_total_added_and_removed.item_id
      ) AS previous_month_totals
      ON previous_month_totals.item_id = items.id

      LEFT JOIN (
        SELECT selected_month_display_added_and_removed.item_id AS item_id,
        selected_month_display_added_and_removed.item_name AS item_name,
        selected_month_display_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN selected_month_display_added_and_removed.operation_type = 'add_stock' THEN selected_month_display_added_and_removed.total_stock_qty END), 0) AS total_added_stock_qty,
        IFNULL(SUM(CASE WHEN selected_month_display_added_and_removed.operation_type = 'remove_stock' THEN selected_month_display_added_and_removed.total_stock_qty END), 0) AS total_removed_stock_qty
        FROM (
          SELECT SUM(selected_month_logs.adjustment_qty) AS total_stock_qty,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM (
            SELECT * FROM inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${monthYearDateFilter}', 'start of month')
            AND DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS selected_month_logs
          LEFT JOIN items ON items.id = selected_month_logs.item_id
          LEFT JOIN operations ON operations.id = selected_month_logs.operation_id
          GROUP BY selected_month_logs.item_id, operations.type
        ) AS selected_month_display_added_and_removed
        LEFT JOIN items ON items.id = selected_month_display_added_and_removed.item_id
        GROUP BY selected_month_display_added_and_removed.item_id
      ) AS selected_month_added_and_removed
      ON selected_month_added_and_removed.item_id = items.id

      JOIN categories ON categories.id = items.category_id
      WHERE items.id = ${itemId}
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

    const avgUnitCost = parseFloat(item.avg_unit_cost || 0);
    const avgUnitCostNet = parseFloat(item.avg_unit_cost_net || 0);
    const avgUnitCostTax = parseFloat(item.avg_unit_cost_tax || 0);

    let qty = 0;

    if (numberOfStocksToAdd > 0) {
      qty = parseFloat(numberOfStocksToAdd);
    } else if (numberOfStocksToRemove > 0) {
      qty = parseFloat(numberOfStocksToRemove);
    }

    const adjustmentDate = monthYearDateFilter
      ? `datetime('${monthYearDateFilter}')`
      : `datetime('now')`;

    // operation_id 6 is equal to Stock Usage Entry
    // operation_id 3 is equal to add_stock Inventory Re-count
    let operationId = 6;

    if (numberOfStocksToAdd > 0) {
      operationId = 3;
    } else if (numberOfStocksToRemove > 0) {
      operationId = 6;
    }

    const addInventoryLogQuery = `INSERT INTO inventory_logs (
      operation_id,
      item_id,
      adjustment_unit_cost,
      adjustment_unit_cost_net,
      adjustment_unit_cost_tax,
      adjustment_qty,
      adjustment_date
    )

    VALUES(
      ${parseInt(operationId)},
      ${parseInt(item.id)},
      ${avgUnitCost},
      ${avgUnitCostNet},
      ${avgUnitCostTax},
      ${qty},
      ${adjustmentDate}
    );`;

    return db.executeSql(addInventoryLogQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create ending inventory entry.');
  }
};
