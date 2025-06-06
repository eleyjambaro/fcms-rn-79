import {getDBConnection} from '../localDb';
import {createQueryFilter} from '../utils/localDbQueryHelpers';

export const getItemsMonthlyReport = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, dateFilter, limit = 15}] = queryKey;
  const orderBy = 'categories.name, items.name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectAllQuery = `
      SELECT items.id AS id,
      items.id AS item_id,
      items.name AS item_name,
      items.current_stock_qty AS item_current_stock_qty,
      items.uom_abbrev AS item_uom_abbrev,
      items.revenue_group_id AS revenue_group_id,
      items.revenue_group_name AS revenue_group_name,
      items.selected_month_revenue_group_total_amount,

      categories.name AS item_category_name,

      IFNULL((whole_month_totals.whole_month_total_removed_stock_cost / items.selected_month_revenue_group_total_amount) * 100, 0) AS whole_month_total_removed_stock_cost_percentage,
      IFNULL((whole_month_totals.whole_month_total_removed_stock_cost_net / items.selected_month_revenue_group_total_amount) * 100, 0) AS whole_month_total_removed_stock_cost_net_percentage,

      IFNULL((whole_month_totals.whole_month_total_added_stock_cost / items.selected_month_revenue_group_total_amount) * 100, 0) AS whole_month_total_added_stock_cost_percentage,
      IFNULL((whole_month_totals.whole_month_total_added_stock_cost_net / items.selected_month_revenue_group_total_amount) * 100, 0) AS whole_month_total_added_stock_cost_net_percentage,

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

      whole_month_totals.whole_month_total_added_stock_cost AS whole_month_total_added_stock_cost,
      whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_total_removed_stock_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net AS whole_month_total_added_stock_cost_net,
      whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_total_removed_stock_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax AS whole_month_total_added_stock_cost_tax,
      whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_total_removed_stock_cost_tax,
      whole_month_totals.whole_month_total_added_stock_cost - whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_grand_total_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net - whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_grand_total_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax - whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_grand_total_cost_tax,

      whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost AS whole_month_operation_id_1_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost_net AS whole_month_operation_id_1_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost_tax AS whole_month_operation_id_1_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost AS whole_month_operation_id_2_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_net AS whole_month_operation_id_2_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_tax AS whole_month_operation_id_2_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost AS whole_month_operation_id_3_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost_net AS whole_month_operation_id_3_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost_tax AS whole_month_operation_id_3_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost AS whole_month_operation_id_4_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost_net AS whole_month_operation_id_4_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost_tax AS whole_month_operation_id_4_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost AS whole_month_operation_id_5_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost_net AS whole_month_operation_id_5_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost_tax AS whole_month_operation_id_5_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost AS whole_month_operation_id_6_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost_net AS whole_month_operation_id_6_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost_tax AS whole_month_operation_id_6_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost AS whole_month_operation_id_7_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost_net AS whole_month_operation_id_7_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost_tax AS whole_month_operation_id_7_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost AS whole_month_operation_id_8_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost_net AS whole_month_operation_id_8_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost_tax AS whole_month_operation_id_8_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost AS whole_month_operation_id_9_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost_net AS whole_month_operation_id_9_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost_tax AS whole_month_operation_id_9_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost AS whole_month_operation_id_10_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost_net AS whole_month_operation_id_10_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost_tax AS whole_month_operation_id_10_total_cost_tax,

      whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_qty AS whole_month_operation_id_1_total_qty,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_qty AS whole_month_operation_id_2_total_qty,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_qty AS whole_month_operation_id_3_total_qty,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_qty AS whole_month_operation_id_4_total_qty,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_qty AS whole_month_operation_id_5_total_qty,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_qty AS whole_month_operation_id_6_total_qty,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_qty AS whole_month_operation_id_7_total_qty,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_qty AS whole_month_operation_id_8_total_qty,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_qty AS whole_month_operation_id_9_total_qty,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_qty AS whole_month_operation_id_10_total_qty
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM (
        SELECT *,
        (
          SELECT name FROM revenue_groups
          WHERE revenue_groups.id = (
            SELECT revenue_group_id
            FROM revenue_categories
            WHERE revenue_categories.category_id = i.id
            ORDER BY date_created DESC
          )
        ) AS revenue_group_name,
        (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE revenue_categories.category_id = i.id
          ORDER BY date_created DESC
        ) AS revenue_group_id,
        (
          SELECT IFNULL(SUM(amount), 0)
          FROM revenues
          WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${dateFilter}'))
          AND revenue_group_id = (
            SELECT revenue_group_id
            FROM revenue_categories
            WHERE category_id = i.id
            ORDER BY date_created DESC
          )
        ) AS selected_month_revenue_group_total_amount
        FROM items i
      ) AS items

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
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
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
            AND DATE('${dateFilter}', 'start of month', '-1 day')
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
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS selected_month_logs
          LEFT JOIN items ON items.id = selected_month_logs.item_id
          LEFT JOIN operations ON operations.id = selected_month_logs.operation_id
          GROUP BY selected_month_logs.item_id, operations.type
        ) AS selected_month_display_added_and_removed
        LEFT JOIN items ON items.id = selected_month_display_added_and_removed.item_id
        GROUP BY selected_month_display_added_and_removed.item_id
      ) AS selected_month_added_and_removed
      ON selected_month_added_and_removed.item_id = items.id

      LEFT JOIN (
        SELECT whole_month_total_added_and_removed.item_id AS item_id,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost END), 0) AS whole_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost END), 0) AS whole_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost_net END), 0) AS whole_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost_net END), 0) AS whole_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost_tax END), 0) AS whole_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost_tax END), 0) AS whole_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_stock_cost_tax,
          whole_month_logs.type AS operation_type,
          whole_month_logs.item_id AS item_id
          FROM (
            SELECT *,
            inventory_logs.id AS id
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            LEFT JOIN operations ON operations.id = inventory_logs.operation_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS whole_month_logs
          LEFT JOIN items ON items.id = whole_month_logs.item_id
          GROUP BY whole_month_logs.item_id, whole_month_logs.type
        ) AS whole_month_total_added_and_removed
        LEFT JOIN items ON items.id = whole_month_total_added_and_removed.item_id
        GROUP BY whole_month_total_added_and_removed.item_id
      ) AS whole_month_totals
      ON whole_month_totals.item_id = items.id

      LEFT JOIN (
        SELECT whole_month_operations_and_totals.item_id AS item_id,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_1_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_1_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_1_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_2_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_2_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_2_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_3_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_3_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_3_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_4_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_4_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_4_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_5_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_5_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_5_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_6_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_6_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_6_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_7_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_7_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_7_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_8_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_8_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_8_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_9_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_9_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_9_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_10_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_10_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_10_total_cost_tax,

        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_qty END), 0) AS whole_month_operation_id_1_total_qty,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_qty END), 0) AS whole_month_operation_id_2_total_qty,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_qty END), 0) AS whole_month_operation_id_3_total_qty,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_qty END), 0) AS whole_month_operation_id_4_total_qty,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_qty END), 0) AS whole_month_operation_id_5_total_qty,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_qty END), 0) AS whole_month_operation_id_6_total_qty,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_qty END), 0) AS whole_month_operation_id_7_total_qty,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_qty END), 0) AS whole_month_operation_id_8_total_qty,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_qty END), 0) AS whole_month_operation_id_9_total_qty,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_qty END), 0) AS whole_month_operation_id_10_total_qty
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_cost_tax,
          SUM(whole_month_logs.adjustment_qty) AS total_qty,
          whole_month_logs.item_id AS item_id,
          whole_month_logs.operation_id AS operation_id
          FROM (
            SELECT *
            FROM inventory_logs
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS whole_month_logs
          GROUP BY whole_month_logs.item_id, whole_month_logs.operation_id
        ) AS whole_month_operations_and_totals
        GROUP BY whole_month_operations_and_totals.item_id
      ) AS whole_month_operations_and_totals_in_columns
      ON whole_month_operations_and_totals_in_columns.item_id = items.id

      JOIN categories ON categories.id = items.category_id
      
      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        items.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: items,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get items monthly report.');
  }
};

export const getItemsMonthlyReportTotals = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key, {filter, dateFilter, limit = 0}] = queryKey;
  const orderBy = 'categories.name, items.name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectAllQuery = `
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

      SUM(selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost) AS selected_month_all_items_total_cost,
      SUM(selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net) AS selected_month_all_items_total_cost_net,
      SUM(selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax) AS selected_month_all_items_total_cost_tax,

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

      whole_month_totals.whole_month_total_added_stock_cost AS whole_month_total_added_stock_cost,
      whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_total_removed_stock_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net AS whole_month_total_added_stock_cost_net,
      whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_total_removed_stock_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax AS whole_month_total_added_stock_cost_tax,
      whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_total_removed_stock_cost_tax,
      whole_month_totals.whole_month_total_added_stock_cost - whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_grand_total_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net - whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_grand_total_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax - whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_grand_total_cost_tax,

      SUM(whole_month_totals.whole_month_total_added_stock_cost - whole_month_totals.whole_month_total_removed_stock_cost) AS whole_month_all_items_total_cost,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_net - whole_month_totals.whole_month_total_removed_stock_cost_net) AS whole_month_all_items_total_cost_net,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_tax - whole_month_totals.whole_month_total_removed_stock_cost_tax) AS whole_month_all_items_total_cost_tax,

      SUM(whole_month_totals.whole_month_total_added_stock_cost) AS whole_month_all_items_total_added_stock_cost,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_net) AS whole_month_all_items_total_added_stock_cost_net,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_tax) AS whole_month_all_items_total_added_stock_cost_tax,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost) AS whole_month_all_items_total_removed_stock_cost,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost_net) AS whole_month_all_items_total_removed_stock_cost_net,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost_tax) AS whole_month_all_items_total_removed_stock_cost_tax,

      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost) AS whole_month_all_items_operation_id_1_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost_net) AS whole_month_all_items_operation_id_1_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost_tax) AS whole_month_all_items_operation_id_1_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost) AS whole_month_all_items_operation_id_2_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_net) AS whole_month_all_items_operation_id_2_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_tax) AS whole_month_all_items_operation_id_2_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost) AS whole_month_all_items_operation_id_3_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost_net) AS whole_month_all_items_operation_id_3_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost_tax) AS whole_month_all_items_operation_id_3_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost) AS whole_month_all_items_operation_id_4_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost_net) AS whole_month_all_items_operation_id_4_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost_tax) AS whole_month_all_items_operation_id_4_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost) AS whole_month_all_items_operation_id_5_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost_net) AS whole_month_all_items_operation_id_5_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost_tax) AS whole_month_all_items_operation_id_5_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost) AS whole_month_all_items_operation_id_6_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost_net) AS whole_month_all_items_operation_id_6_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost_tax) AS whole_month_all_items_operation_id_6_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost) AS whole_month_all_items_operation_id_7_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost_net) AS whole_month_all_items_operation_id_7_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost_tax) AS whole_month_all_items_operation_id_7_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost) AS whole_month_all_items_operation_id_8_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost_net) AS whole_month_all_items_operation_id_8_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost_tax) AS whole_month_all_items_operation_id_8_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost) AS whole_month_all_items_operation_id_9_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost_net) AS whole_month_all_items_operation_id_9_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost_tax) AS whole_month_all_items_operation_id_9_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost) AS whole_month_all_items_operation_id_10_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost_net) AS whole_month_all_items_operation_id_10_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost_tax) AS whole_month_all_items_operation_id_10_total_cost_tax,

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
        WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${dateFilter}'))
        AND revenue_group_id = (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE category_id = items.category_id
          ORDER BY date_created DESC
        )
      ) AS selected_month_revenue_group_total_amount
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
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
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
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
            AND DATE('${dateFilter}', 'start of month', '-1 day')
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
        SELECT whole_month_total_added_and_removed.item_id AS item_id,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost END), 0) AS whole_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost END), 0) AS whole_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost_net END), 0) AS whole_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost_net END), 0) AS whole_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost_tax END), 0) AS whole_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost_tax END), 0) AS whole_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.item_id AS item_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS whole_month_logs
          LEFT JOIN items ON items.id = whole_month_logs.item_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.item_id, operations.type
        ) AS whole_month_total_added_and_removed
        LEFT JOIN items ON items.id = whole_month_total_added_and_removed.item_id
        GROUP BY whole_month_total_added_and_removed.item_id
      ) AS whole_month_totals
      ON whole_month_totals.item_id = items.id

      LEFT JOIN (
        SELECT whole_month_operations_and_totals.item_id AS item_id,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_1_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_1_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_1_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_2_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_2_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_2_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_3_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_3_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_3_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_4_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_4_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_4_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_5_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_5_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_5_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_6_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_6_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_6_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_7_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_7_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_7_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_8_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_8_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_8_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_9_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_9_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_9_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_10_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_10_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_10_total_cost_tax
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.item_id AS item_id,
          whole_month_logs.operation_id AS operation_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS whole_month_logs
          LEFT JOIN items ON items.id = whole_month_logs.item_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.item_id, whole_month_logs.operation_id
        ) AS whole_month_operations_and_totals
        LEFT JOIN items ON items.id = whole_month_operations_and_totals.item_id
        GROUP BY whole_month_operations_and_totals.item_id
      ) AS whole_month_operations_and_totals_in_columns
      ON whole_month_operations_and_totals_in_columns.item_id = items.id

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
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
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
      
      ${queryFilter}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    const selectedMonthAllItemsTotalCost =
      results?.[0]?.rows?.raw()?.[0]?.['selected_month_all_items_total_cost'];
    const selectedMonthAllItemsTotalCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'selected_month_all_items_total_cost_net'
      ];
    const selectedMonthAllItemsTotalCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'selected_month_all_items_total_cost_tax'
      ];

    const wholeMonthAllItemsTotalAddedStockCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_items_total_added_stock_cost'
      ];
    const wholeMonthAllItemsTotalAddedStockCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_items_total_added_stock_cost_net'
      ];
    const wholeMonthAllItemsTotalAddedStockCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_items_total_added_stock_cost_tax'
      ];

    const wholeMonthAllItemsTotalRemovedStockCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_items_total_removed_stock_cost'
      ];
    const wholeMonthAllItemsTotalRemovedStockCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_items_total_removed_stock_cost_net'
      ];
    const wholeMonthAllItemsTotalRemovedStockCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_items_total_removed_stock_cost_tax'
      ];

    /**
     * All items per operation id total cost
     */
    let wholeMonthAllItemsPerOperationIdTotalCosts = {};
    let allOperationsLength = 10; // There are 10 inventory operations as of this version

    for (let index = 1; index < allOperationsLength + 1; index++) {
      wholeMonthAllItemsPerOperationIdTotalCosts[
        `wholeMonthAllItemsOperationId${index}TotalCost`
      ] =
        results?.[0]?.rows?.raw()?.[0]?.[
          `whole_month_all_items_operation_id_${index}_total_cost`
        ];
      wholeMonthAllItemsPerOperationIdTotalCosts[
        `wholeMonthAllItemsOperationId${index}TotalCostNet`
      ] =
        results?.[0]?.rows?.raw()?.[0]?.[
          `whole_month_all_items_operation_id_${index}_total_cost_net`
        ];
      wholeMonthAllItemsPerOperationIdTotalCosts[
        `wholeMonthAllItemsOperationId${index}TotalCostTax`
      ] =
        results?.[0]?.rows?.raw()?.[0]?.[
          `whole_month_all_items_operation_id_${index}_total_cost_tax`
        ];
    }

    return {
      page: pageParam,
      totals: {
        selectedMonthAllItemsTotalCost,
        selectedMonthAllItemsTotalCostNet,
        selectedMonthAllItemsTotalCostTax,
        wholeMonthAllItemsTotalAddedStockCost,
        wholeMonthAllItemsTotalAddedStockCostNet,
        wholeMonthAllItemsTotalAddedStockCostTax,
        wholeMonthAllItemsTotalRemovedStockCost,
        wholeMonthAllItemsTotalRemovedStockCostNet,
        wholeMonthAllItemsTotalRemovedStockCostTax,

        ...wholeMonthAllItemsPerOperationIdTotalCosts,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get items monthly report totals.');
  }
};

export const getItemReport = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const dateFilter = 'now';

  try {
    const db = await getDBConnection();
    const selectAllQuery = `
      SELECT items.id AS id,
      items.id AS item_id,
      items.name AS item_name,
      items.current_stock_qty AS item_current_stock_qty,
      items.uom_abbrev AS item_uom_abbrev,
      items.category_id AS category_id,
      items.preferred_vendor_id AS preferred_vendor_id,
      categories.name AS category_name,

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
        WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${dateFilter}'))
        AND revenue_group_id = (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE category_id = items.category_id
          ORDER BY date_created DESC
        )
      ) AS selected_month_revenue_group_total_amount
    `;
    const query = `
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
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
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
            AND DATE('${dateFilter}', 'start of month', '-1 day')
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
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS selected_month_logs
          LEFT JOIN items ON items.id = selected_month_logs.item_id
          LEFT JOIN operations ON operations.id = selected_month_logs.operation_id
          GROUP BY selected_month_logs.item_id, operations.type
        ) AS selected_month_display_added_and_removed
        LEFT JOIN items ON items.id = selected_month_display_added_and_removed.item_id
        GROUP BY selected_month_display_added_and_removed.item_id
      ) AS selected_month_added_and_removed
      ON selected_month_added_and_removed.item_id = items.id

      LEFT JOIN categories ON categories.id = items.category_id
      
      WHERE items.id = ${id}
    `;

    const result = await db.executeSql(selectAllQuery + query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get item report.');
  }
};

export const getCategoriesMonthlyReport = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, dateFilter, limit = 30}] = queryKey;
  const orderBy = 'categories.revenue_group_name, categories.name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectAllQuery = `
      SELECT categories.id AS id,
      categories.id AS category_id,
      categories.name AS category_name,
      categories.revenue_group_id AS revenue_group_id,
      categories.revenue_group_name AS revenue_group_name,
      categories.selected_month_revenue_group_total_amount,

      IFNULL((whole_month_totals.whole_month_total_removed_stock_cost / categories.selected_month_revenue_group_total_amount) * 100, 0) AS whole_month_total_removed_stock_cost_percentage,
      IFNULL((whole_month_totals.whole_month_total_removed_stock_cost_net / categories.selected_month_revenue_group_total_amount) * 100, 0) AS whole_month_total_removed_stock_cost_net_percentage,

      IFNULL((whole_month_totals.whole_month_total_added_stock_cost / categories.selected_month_revenue_group_total_amount) * 100, 0) AS whole_month_total_added_stock_cost_percentage,
      IFNULL((whole_month_totals.whole_month_total_added_stock_cost_net / categories.selected_month_revenue_group_total_amount) * 100, 0) AS whole_month_total_added_stock_cost_net_percentage,

      selected_month_totals.selected_month_total_added_stock_cost AS selected_month_total_added_stock_cost,
      selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_total_removed_stock_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net AS selected_month_total_added_stock_cost_net,
      selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_total_removed_stock_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax AS selected_month_total_added_stock_cost_tax,
      selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_total_removed_stock_cost_tax,
      selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_grand_total_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_grand_total_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_grand_total_cost_tax,

      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_cost,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net AS previous_month_total_added_stock_cost_net,
      previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_total_removed_stock_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax AS previous_month_total_added_stock_cost_tax,
      previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_total_removed_stock_cost_tax,
      previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_grand_total_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_grand_total_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_grand_total_cost_tax,

      whole_month_totals.whole_month_total_added_stock_cost AS whole_month_total_added_stock_cost,
      whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_total_removed_stock_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net AS whole_month_total_added_stock_cost_net,
      whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_total_removed_stock_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax AS whole_month_total_added_stock_cost_tax,
      whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_total_removed_stock_cost_tax,
      whole_month_totals.whole_month_total_added_stock_cost - whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_grand_total_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net - whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_grand_total_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax - whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_grand_total_cost_tax,

      whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost AS whole_month_operation_id_1_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost_net AS whole_month_operation_id_1_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost_tax AS whole_month_operation_id_1_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost AS whole_month_operation_id_2_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_net AS whole_month_operation_id_2_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_tax AS whole_month_operation_id_2_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost AS whole_month_operation_id_3_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost_net AS whole_month_operation_id_3_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost_tax AS whole_month_operation_id_3_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost AS whole_month_operation_id_4_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost_net AS whole_month_operation_id_4_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost_tax AS whole_month_operation_id_4_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost AS whole_month_operation_id_5_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost_net AS whole_month_operation_id_5_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost_tax AS whole_month_operation_id_5_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost AS whole_month_operation_id_6_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost_net AS whole_month_operation_id_6_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost_tax AS whole_month_operation_id_6_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost AS whole_month_operation_id_7_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost_net AS whole_month_operation_id_7_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost_tax AS whole_month_operation_id_7_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost AS whole_month_operation_id_8_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost_net AS whole_month_operation_id_8_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost_tax AS whole_month_operation_id_8_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost AS whole_month_operation_id_9_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost_net AS whole_month_operation_id_9_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost_tax AS whole_month_operation_id_9_total_cost_tax,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost AS whole_month_operation_id_10_total_cost,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost_net AS whole_month_operation_id_10_total_cost_net,
      whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost_tax AS whole_month_operation_id_10_total_cost_tax
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM (
        SELECT *,
        (
          SELECT name FROM revenue_groups
          WHERE revenue_groups.id = (
            SELECT revenue_group_id
            FROM revenue_categories
            WHERE revenue_categories.category_id = c.id
            ORDER BY date_created DESC
          )
        ) AS revenue_group_name,
        (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE revenue_categories.category_id = c.id
          ORDER BY date_created DESC
        ) AS revenue_group_id,
        (
          SELECT IFNULL(SUM(amount), 0)
          FROM revenues
          WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${dateFilter}'))
          AND revenue_group_id = (
            SELECT revenue_group_id
            FROM revenue_categories
            WHERE category_id = c.id
            ORDER BY date_created DESC
          )
        ) AS selected_month_revenue_group_total_amount
        FROM categories c
      ) AS categories
     
      LEFT JOIN (
        SELECT selected_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_net * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_tax * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_selected_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS from_earliest_to_selected_month_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_selected_month_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_selected_month_logs.operation_id
          GROUP BY from_earliest_to_selected_month_logs.category_id, operations.type
        ) AS selected_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = selected_month_total_added_and_removed.category_id
        GROUP BY selected_month_total_added_and_removed.category_id
      ) AS selected_month_totals
      ON selected_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT previous_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_net * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_tax * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_previous_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${dateFilter}', 'start of month', '-1 day')
          ) AS from_earliest_to_previous_month_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_previous_month_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_previous_month_logs.operation_id
          GROUP BY from_earliest_to_previous_month_logs.category_id, operations.type
        ) AS previous_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = previous_month_total_added_and_removed.category_id
        GROUP BY previous_month_total_added_and_removed.category_id
      ) AS previous_month_totals
      ON previous_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT whole_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost END), 0) AS whole_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost END), 0) AS whole_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost_net END), 0) AS whole_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost_net END), 0) AS whole_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost_tax END), 0) AS whole_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost_tax END), 0) AS whole_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS whole_month_logs
          LEFT JOIN categories ON categories.id = whole_month_logs.category_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.category_id, operations.type
        ) AS whole_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = whole_month_total_added_and_removed.category_id
        GROUP BY whole_month_total_added_and_removed.category_id
      ) AS whole_month_totals
      ON whole_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT whole_month_operations_and_totals.category_id AS category_id,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_1_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_1_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_1_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_2_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_2_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_2_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_3_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_3_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_3_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_4_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_4_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_4_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_5_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_5_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_5_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_6_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_6_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_6_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_7_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_7_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_7_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_8_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_8_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_8_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_9_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_9_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_9_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_10_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_10_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_10_total_cost_tax
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.category_id AS category_id,
          whole_month_logs.operation_id AS operation_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS whole_month_logs
          LEFT JOIN categories ON categories.id = whole_month_logs.category_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.category_id, whole_month_logs.operation_id
        ) AS whole_month_operations_and_totals
        LEFT JOIN categories ON categories.id = whole_month_operations_and_totals.category_id
        GROUP BY whole_month_operations_and_totals.category_id
      ) AS whole_month_operations_and_totals_in_columns
      ON whole_month_operations_and_totals_in_columns.category_id = categories.id
      
      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        items.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: items,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get categories monthly report.');
  }
};

export const getCategoriesMonthlyReportTotals = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key, {filter, dateFilter, limit = 0}] = queryKey;
  const orderBy = 'categories.name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectAllQuery = `
      SELECT categories.id AS id,
      categories.id AS category_id,
      categories.name AS category_name,

      SUM(whole_month_totals.whole_month_total_removed_stock_cost) / (SELECT SUM(revenues.amount) AS revenue_groups_grand_total FROM revenues WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${dateFilter}')) * 100 AS whole_month_all_categories_total_removed_stock_cost_percentage,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost_net) / (SELECT SUM(revenues.amount) AS revenue_groups_grand_total FROM revenues WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${dateFilter}')) * 100 AS whole_month_all_categories_total_removed_stock_cost_net_percentage,

      SUM(whole_month_totals.whole_month_total_added_stock_cost) / (SELECT SUM(revenues.amount) AS revenue_groups_grand_total FROM revenues WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${dateFilter}')) * 100 AS whole_month_all_categories_total_added_stock_cost_percentage,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_net) / (SELECT SUM(revenues.amount) AS revenue_groups_grand_total FROM revenues WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${dateFilter}')) * 100 AS whole_month_all_categories_total_added_stock_cost_net_percentage,

      selected_month_totals.selected_month_total_added_stock_cost AS selected_month_total_added_stock_cost,
      selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_total_removed_stock_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net AS selected_month_total_added_stock_cost_net,
      selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_total_removed_stock_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax AS selected_month_total_added_stock_cost_tax,
      selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_total_removed_stock_cost_tax,
      selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_grand_total_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_grand_total_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_grand_total_cost_tax,

      SUM(selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost) AS selected_month_all_categories_total_cost,
      SUM(selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net) AS selected_month_all_categories_total_cost_net,
      SUM(selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax) AS selected_month_all_categories_total_cost_tax,

      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_cost,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net AS previous_month_total_added_stock_cost_net,
      previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_total_removed_stock_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax AS previous_month_total_added_stock_cost_tax,
      previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_total_removed_stock_cost_tax,
      previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_grand_total_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_grand_total_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_grand_total_cost_tax,

      SUM(previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost) AS previous_month_all_categories_total_cost,
      SUM(previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net) AS previous_month_all_categories_total_cost_net,
      SUM(previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax) AS previous_month_all_categories_total_cost_tax,

      whole_month_totals.whole_month_total_added_stock_cost AS whole_month_total_added_stock_cost,
      whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_total_removed_stock_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net AS whole_month_total_added_stock_cost_net,
      whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_total_removed_stock_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax AS whole_month_total_added_stock_cost_tax,
      whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_total_removed_stock_cost_tax,
      whole_month_totals.whole_month_total_added_stock_cost - whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_grand_total_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net - whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_grand_total_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax - whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_grand_total_cost_tax,

      SUM(whole_month_totals.whole_month_total_added_stock_cost - whole_month_totals.whole_month_total_removed_stock_cost) AS whole_month_all_categories_total_cost,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_net - whole_month_totals.whole_month_total_removed_stock_cost_net) AS whole_month_all_categories_total_cost_net,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_tax - whole_month_totals.whole_month_total_removed_stock_cost_tax) AS whole_month_all_categories_total_cost_tax,

      SUM(whole_month_totals.whole_month_total_added_stock_cost) AS whole_month_all_categories_total_added_stock_cost,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_net) AS whole_month_all_categories_total_added_stock_cost_net,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_tax) AS whole_month_all_categories_total_added_stock_cost_tax,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost) AS whole_month_all_categories_total_removed_stock_cost,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost_net) AS whole_month_all_categories_total_removed_stock_cost_net,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost_tax) AS whole_month_all_categories_total_removed_stock_cost_tax,


      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost) AS whole_month_all_categories_operation_id_1_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost_net) AS whole_month_all_categories_operation_id_1_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost_tax) AS whole_month_all_categories_operation_id_1_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost) AS whole_month_all_categories_operation_id_2_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_net) AS whole_month_all_categories_operation_id_2_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_tax) AS whole_month_all_categories_operation_id_2_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost) AS whole_month_all_categories_operation_id_3_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost_net) AS whole_month_all_categories_operation_id_3_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost_tax) AS whole_month_all_categories_operation_id_3_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost) AS whole_month_all_categories_operation_id_4_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost_net) AS whole_month_all_categories_operation_id_4_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost_tax) AS whole_month_all_categories_operation_id_4_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost) AS whole_month_all_categories_operation_id_5_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost_net) AS whole_month_all_categories_operation_id_5_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost_tax) AS whole_month_all_categories_operation_id_5_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost) AS whole_month_all_categories_operation_id_6_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost_net) AS whole_month_all_categories_operation_id_6_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost_tax) AS whole_month_all_categories_operation_id_6_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost) AS whole_month_all_categories_operation_id_7_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost_net) AS whole_month_all_categories_operation_id_7_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost_tax) AS whole_month_all_categories_operation_id_7_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost) AS whole_month_all_categories_operation_id_8_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost_net) AS whole_month_all_categories_operation_id_8_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost_tax) AS whole_month_all_categories_operation_id_8_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost) AS whole_month_all_categories_operation_id_9_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost_net) AS whole_month_all_categories_operation_id_9_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost_tax) AS whole_month_all_categories_operation_id_9_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost) AS whole_month_all_categories_operation_id_10_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost_net) AS whole_month_all_categories_operation_id_10_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost_tax) AS whole_month_all_categories_operation_id_10_total_cost_tax
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM (
        SELECT *,
        (
          SELECT name FROM revenue_groups
          WHERE revenue_groups.id = (
            SELECT revenue_group_id
            FROM revenue_categories
            WHERE revenue_categories.category_id = c.id
            ORDER BY date_created DESC
          )
        ) AS revenue_group_name,
        (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE revenue_categories.category_id = c.id
          ORDER BY date_created DESC
        ) AS revenue_group_id,
        (
          SELECT IFNULL(SUM(amount), 0)
          FROM revenues
          WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${dateFilter}'))
          AND revenue_group_id = (
            SELECT revenue_group_id
            FROM revenue_categories
            WHERE category_id = c.id
            ORDER BY date_created DESC
          )
        ) AS selected_month_revenue_group_total_amount
        FROM categories c
      ) AS categories

      LEFT JOIN (
        SELECT selected_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_net * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_tax * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_selected_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS from_earliest_to_selected_month_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_selected_month_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_selected_month_logs.operation_id
          GROUP BY from_earliest_to_selected_month_logs.category_id, operations.type
        ) AS selected_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = selected_month_total_added_and_removed.category_id
        GROUP BY selected_month_total_added_and_removed.category_id
      ) AS selected_month_totals
      ON selected_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT previous_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_net * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_tax * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_previous_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${dateFilter}', 'start of month', '-1 day')
          ) AS from_earliest_to_previous_month_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_previous_month_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_previous_month_logs.operation_id
          GROUP BY from_earliest_to_previous_month_logs.category_id, operations.type
        ) AS previous_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = previous_month_total_added_and_removed.category_id
        GROUP BY previous_month_total_added_and_removed.category_id
      ) AS previous_month_totals
      ON previous_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT whole_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost END), 0) AS whole_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost END), 0) AS whole_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost_net END), 0) AS whole_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost_net END), 0) AS whole_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost_tax END), 0) AS whole_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost_tax END), 0) AS whole_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS whole_month_logs
          LEFT JOIN categories ON categories.id = whole_month_logs.category_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.category_id, operations.type
        ) AS whole_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = whole_month_total_added_and_removed.category_id
        GROUP BY whole_month_total_added_and_removed.category_id
      ) AS whole_month_totals
      ON whole_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT whole_month_operations_and_totals.category_id AS category_id,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_1_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_1_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_1_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_2_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_2_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_2_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_3_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_3_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_3_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_4_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_4_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_4_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_5_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_5_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_5_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_6_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_6_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_6_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_7_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_7_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_7_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_8_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_8_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_8_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_9_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_9_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_9_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_10_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_10_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_10_total_cost_tax
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.category_id AS category_id,
          whole_month_logs.operation_id AS operation_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS whole_month_logs
          LEFT JOIN categories ON categories.id = whole_month_logs.category_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.category_id, whole_month_logs.operation_id
        ) AS whole_month_operations_and_totals
        LEFT JOIN categories ON categories.id = whole_month_operations_and_totals.category_id
        GROUP BY whole_month_operations_and_totals.category_id
      ) AS whole_month_operations_and_totals_in_columns
      ON whole_month_operations_and_totals_in_columns.category_id = categories.id
      
      ${queryFilter}
    `;

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    /**
     * Selected Month
     */
    const selectedMonthAllCategoriesTotalCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'selected_month_all_categories_total_cost'
      ];
    const selectedMonthAllCategoriesTotalCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'selected_month_all_categories_total_cost_net'
      ];
    const selectedMonthAllCategoriesTotalCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'selected_month_all_categories_total_cost_tax'
      ];

    /**
     * Previous Month
     */
    const previousMonthAllCategoriesTotalCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'previous_month_all_categories_total_cost'
      ];
    const previousMonthAllCategoriesTotalCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'previous_month_all_categories_total_cost_net'
      ];
    const previousMonthAllCategoriesTotalCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'previous_month_all_categories_total_cost_tax'
      ];

    /**
     * Whole Month
     */
    const wholeMonthAllCategoriesTotalCost =
      results?.[0]?.rows?.raw()?.[0]?.['whole_month_all_categories_total_cost'];
    const wholeMonthAllCategoriesTotalCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_cost_net'
      ];
    const wholeMonthAllCategoriesTotalCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_cost_tax'
      ];

    const wholeMonthAllCategoriesTotalAddedStockCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_added_stock_cost'
      ];
    const wholeMonthAllCategoriesTotalAddedStockCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_added_stock_cost_net'
      ];
    const wholeMonthAllCategoriesTotalAddedStockCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_added_stock_cost_tax'
      ];

    const wholeMonthAllCategoriesTotalRemovedStockCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_removed_stock_cost'
      ];
    const wholeMonthAllCategoriesTotalRemovedStockCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_removed_stock_cost_net'
      ];
    const wholeMonthAllCategoriesTotalRemovedStockCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_removed_stock_cost_tax'
      ];

    /**
     * Whole Month - Percentage
     */
    const wholeMonthAllCategoriesTotalAddedStockCostPercentage =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_added_stock_cost_percentage'
      ];
    const wholeMonthAllCategoriesTotalAddedStockCostNetPercentage =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_added_stock_cost_net_percentage'
      ];
    const wholeMonthAllCategoriesTotalRemovedStockCostPercentage =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_removed_stock_cost_percentage'
      ];
    const wholeMonthAllCategoriesTotalRemovedStockCostNetPercentage =
      results?.[0]?.rows?.raw()?.[0]?.[
        'whole_month_all_categories_total_removed_stock_cost_net_percentage'
      ];

    /**
     * All categories per operation id total cost
     */
    let wholeMonthAllCategoriesPerOperationIdTotalCosts = {};
    let allOperationsLength = 10; // There are 10 inventory operations as of this version

    for (let index = 1; index < allOperationsLength + 1; index++) {
      wholeMonthAllCategoriesPerOperationIdTotalCosts[
        `wholeMonthAllCategoriesOperationId${index}TotalCost`
      ] =
        results?.[0]?.rows?.raw()?.[0]?.[
          `whole_month_all_categories_operation_id_${index}_total_cost`
        ];
      wholeMonthAllCategoriesPerOperationIdTotalCosts[
        `wholeMonthAllCategoriesOperationId${index}TotalCostNet`
      ] =
        results?.[0]?.rows?.raw()?.[0]?.[
          `whole_month_all_categories_operation_id_${index}_total_cost_net`
        ];
      wholeMonthAllCategoriesPerOperationIdTotalCosts[
        `wholeMonthAllCategoriesOperationId${index}TotalCostTax`
      ] =
        results?.[0]?.rows?.raw()?.[0]?.[
          `whole_month_all_categories_operation_id_${index}_total_cost_tax`
        ];
    }

    return {
      page: pageParam,
      totals: {
        selectedMonthAllCategoriesTotalCost,
        selectedMonthAllCategoriesTotalCostNet,
        selectedMonthAllCategoriesTotalCostTax,
        previousMonthAllCategoriesTotalCost,
        previousMonthAllCategoriesTotalCostNet,
        previousMonthAllCategoriesTotalCostTax,
        wholeMonthAllCategoriesTotalCost,
        wholeMonthAllCategoriesTotalCostNet,
        wholeMonthAllCategoriesTotalCostTax,

        // whole month percentage:
        wholeMonthAllCategoriesTotalAddedStockCostPercentage,
        wholeMonthAllCategoriesTotalAddedStockCostNetPercentage,
        wholeMonthAllCategoriesTotalRemovedStockCostPercentage,
        wholeMonthAllCategoriesTotalRemovedStockCostNetPercentage,

        wholeMonthAllCategoriesTotalAddedStockCost,
        wholeMonthAllCategoriesTotalAddedStockCostNet,
        wholeMonthAllCategoriesTotalAddedStockCostTax,
        wholeMonthAllCategoriesTotalRemovedStockCost,
        wholeMonthAllCategoriesTotalRemovedStockCostNet,
        wholeMonthAllCategoriesTotalRemovedStockCostTax,
        ...wholeMonthAllCategoriesPerOperationIdTotalCosts,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get categories monthly report totals.');
  }
};

export const getItemsCustomReport = async ({queryKey, pageParam = 1}) => {
  const [
    _key,
    {
      filter,
      dateFilter,
      limit = 1000000000,
      monthYearDateFilter,
      selectedMonthYearDateFilter,
      monthToDateFilter,
      dateRangeFilter,
    },
  ] = queryKey;
  const orderBy = 'categories.name, items.name';
  let queryFilter = createQueryFilter(filter);

  let start = '';
  let end = '';

  if (selectedMonthYearDateFilter) {
    start = `DATE('${selectedMonthYearDateFilter}', 'start of month')`;
    end = `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (monthToDateFilter) {
    start = `DATE('${monthToDateFilter.start}', 'start of month')`;
    end = `DATE('${monthToDateFilter.end}')`;
  } else if (dateRangeFilter) {
    start = `DATE('${dateRangeFilter.start}')`;
    end = `DATE('${dateRangeFilter.end}')`;
  }

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectAllQuery = `
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

      date_filtered_totals.date_filtered_total_added_stock_qty AS date_filtered_total_added_stock_qty,
      date_filtered_totals.date_filtered_total_removed_stock_qty AS date_filtered_total_removed_stock_qty,
      
      date_filtered_totals.date_filtered_total_added_stock_cost AS date_filtered_total_added_stock_cost,
      date_filtered_totals.date_filtered_total_removed_stock_cost AS date_filtered_total_removed_stock_cost,
      date_filtered_totals.date_filtered_total_added_stock_cost_net AS date_filtered_total_added_stock_cost_net,
      date_filtered_totals.date_filtered_total_removed_stock_cost_net AS date_filtered_total_removed_stock_cost_net,
      date_filtered_totals.date_filtered_total_added_stock_cost_tax AS date_filtered_total_added_stock_cost_tax,
      date_filtered_totals.date_filtered_total_removed_stock_cost_tax AS date_filtered_total_removed_stock_cost_tax,
      date_filtered_totals.date_filtered_total_added_stock_qty - date_filtered_totals.date_filtered_total_removed_stock_qty AS date_filtered_grand_total_qty,
      date_filtered_totals.date_filtered_total_added_stock_cost - date_filtered_totals.date_filtered_total_removed_stock_cost AS date_filtered_grand_total_cost,
      date_filtered_totals.date_filtered_total_added_stock_cost_net - date_filtered_totals.date_filtered_total_removed_stock_cost_net AS date_filtered_grand_total_cost_net,
      date_filtered_totals.date_filtered_total_added_stock_cost_tax - date_filtered_totals.date_filtered_total_removed_stock_cost_tax AS date_filtered_grand_total_cost_tax,

      ((date_filtered_totals.date_filtered_total_added_stock_cost - date_filtered_totals.date_filtered_total_removed_stock_cost) / (date_filtered_totals.date_filtered_total_added_stock_qty - date_filtered_totals.date_filtered_total_removed_stock_qty)) AS avg_unit_cost,
      ((date_filtered_totals.date_filtered_total_added_stock_cost_net - date_filtered_totals.date_filtered_total_removed_stock_cost_net) / (date_filtered_totals.date_filtered_total_added_stock_qty - date_filtered_totals.date_filtered_total_removed_stock_qty)) AS avg_unit_cost_net,
      ((date_filtered_totals.date_filtered_total_added_stock_cost_tax - date_filtered_totals.date_filtered_total_removed_stock_cost_tax) / (date_filtered_totals.date_filtered_total_added_stock_qty - date_filtered_totals.date_filtered_total_removed_stock_qty)) AS avg_unit_cost_tax,

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
        WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${dateFilter}'))
        AND revenue_group_id = (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE category_id = items.category_id
          ORDER BY date_created DESC
        )
      ) AS selected_month_revenue_group_total_amount
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
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
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
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
            AND DATE('${dateFilter}', 'start of month', '-1 day')
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
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS selected_month_logs
          LEFT JOIN items ON items.id = selected_month_logs.item_id
          LEFT JOIN operations ON operations.id = selected_month_logs.operation_id
          GROUP BY selected_month_logs.item_id, operations.type
        ) AS selected_month_display_added_and_removed
        LEFT JOIN items ON items.id = selected_month_display_added_and_removed.item_id
        GROUP BY selected_month_display_added_and_removed.item_id
      ) AS selected_month_added_and_removed
      ON selected_month_added_and_removed.item_id = items.id

      LEFT JOIN (
        SELECT date_filtered_total_added_and_removed.item_id AS item_id,
        date_filtered_total_added_and_removed.item_name AS item_name,
        date_filtered_total_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_qty END), 0) AS date_filtered_total_added_stock_qty,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_qty END), 0) AS date_filtered_total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost END), 0) AS date_filtered_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost END), 0) AS date_filtered_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_net END), 0) AS date_filtered_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_net END), 0) AS date_filtered_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_tax END), 0) AS date_filtered_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_tax END), 0) AS date_filtered_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(date_filtered_logs.adjustment_qty) AS total_stock_qty,
          SUM(date_filtered_logs.adjustment_unit_cost * date_filtered_logs.adjustment_qty) AS total_stock_cost,
          SUM(date_filtered_logs.adjustment_unit_cost_net * date_filtered_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(date_filtered_logs.adjustment_unit_cost_tax * date_filtered_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM (
            SELECT * FROM inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS date_filtered_logs
          LEFT JOIN items ON items.id = date_filtered_logs.item_id
          LEFT JOIN operations ON operations.id = date_filtered_logs.operation_id
          GROUP BY date_filtered_logs.item_id, operations.type
        ) AS date_filtered_total_added_and_removed
        LEFT JOIN items ON items.id = date_filtered_total_added_and_removed.item_id
        GROUP BY date_filtered_total_added_and_removed.item_id
      ) AS date_filtered_totals
      ON date_filtered_totals.item_id = items.id

      JOIN categories ON categories.id = items.category_id
      
      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        items.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: items,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get items custom report.');
  }
};

export const getItemsCustomReportTotals = async ({queryKey, pageParam = 1}) => {
  const [
    _key,
    {
      filter,
      dateFilter,
      limit = 0,
      monthYearDateFilter,
      selectedMonthYearDateFilter,
      monthToDateFilter,
      dateRangeFilter,
    },
  ] = queryKey;
  const orderBy = 'categories.name, items.name';
  let queryFilter = createQueryFilter(filter);

  let start = '';
  let end = '';

  if (selectedMonthYearDateFilter) {
    start = `DATE('${selectedMonthYearDateFilter}', 'start of month')`;
    end = `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (monthToDateFilter) {
    start = `DATE('${monthToDateFilter.start}', 'start of month')`;
    end = `DATE('${monthToDateFilter.end}')`;
  } else if (dateRangeFilter) {
    start = `DATE('${dateRangeFilter.start}')`;
    end = `DATE('${dateRangeFilter.end}')`;
  }

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectAllQuery = `
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

      SUM(selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost) AS selected_month_all_items_total_cost,
      SUM(selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net) AS selected_month_all_items_total_cost_net,
      SUM(selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax) AS selected_month_all_items_total_cost_tax,

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


      date_filtered_totals.date_filtered_total_added_stock_qty AS date_filtered_total_added_stock_qty,
      date_filtered_totals.date_filtered_total_removed_stock_qty AS date_filtered_total_removed_stock_qty,
      
      date_filtered_totals.date_filtered_total_added_stock_cost AS date_filtered_total_added_stock_cost,
      date_filtered_totals.date_filtered_total_removed_stock_cost AS date_filtered_total_removed_stock_cost,
      date_filtered_totals.date_filtered_total_added_stock_cost_net AS date_filtered_total_added_stock_cost_net,
      date_filtered_totals.date_filtered_total_removed_stock_cost_net AS date_filtered_total_removed_stock_cost_net,
      date_filtered_totals.date_filtered_total_added_stock_cost_tax AS date_filtered_total_added_stock_cost_tax,
      date_filtered_totals.date_filtered_total_removed_stock_cost_tax AS date_filtered_total_removed_stock_cost_tax,
      date_filtered_totals.date_filtered_total_added_stock_qty - date_filtered_totals.date_filtered_total_removed_stock_qty AS date_filtered_grand_total_qty,
      date_filtered_totals.date_filtered_total_added_stock_cost - date_filtered_totals.date_filtered_total_removed_stock_cost AS date_filtered_grand_total_cost,
      date_filtered_totals.date_filtered_total_added_stock_cost_net - date_filtered_totals.date_filtered_total_removed_stock_cost_net AS date_filtered_grand_total_cost_net,
      date_filtered_totals.date_filtered_total_added_stock_cost_tax - date_filtered_totals.date_filtered_total_removed_stock_cost_tax AS date_filtered_grand_total_cost_tax,

      (date_filtered_totals.date_filtered_total_added_stock_cost / date_filtered_totals.date_filtered_total_added_stock_qty) AS date_filtered_avg_unit_cost,
      (date_filtered_totals.date_filtered_total_added_stock_cost_net / date_filtered_totals.date_filtered_total_added_stock_qty) AS date_filtered_avg_unit_cost_net,
      (date_filtered_totals.date_filtered_total_added_stock_cost_tax / date_filtered_totals.date_filtered_total_added_stock_qty) AS date_filtered_avg_unit_cost_tax,

      SUM(date_filtered_totals.date_filtered_total_added_stock_cost) AS date_filtered_all_items_total_added_stock_cost,
      SUM(date_filtered_totals.date_filtered_total_removed_stock_cost) AS date_filtered_all_items_total_removed_stock_cost,
      SUM(date_filtered_totals.date_filtered_total_added_stock_cost_net) AS date_filtered_all_items_total_added_stock_cost_net,
      SUM(date_filtered_totals.date_filtered_total_removed_stock_cost_net) AS date_filtered_all_items_total_removed_stock_cost_net,
      SUM(date_filtered_totals.date_filtered_total_added_stock_cost_tax) AS date_filtered_all_items_total_added_stock_cost_tax,
      SUM(date_filtered_totals.date_filtered_total_removed_stock_cost_tax) AS date_filtered_all_items_total_removed_stock_cost_tax,


      SUM(date_filtered_totals.date_filtered_total_added_stock_cost - date_filtered_totals.date_filtered_total_removed_stock_cost) AS date_filtered_all_items_total_cost,
      SUM(date_filtered_totals.date_filtered_total_added_stock_cost_net - date_filtered_totals.date_filtered_total_removed_stock_cost_net) AS date_filtered_all_items_total_cost_net,
      SUM(date_filtered_totals.date_filtered_total_added_stock_cost_tax - date_filtered_totals.date_filtered_total_removed_stock_cost_tax) AS date_filtered_all_items_total_cost_tax,


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
        WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${dateFilter}'))
        AND revenue_group_id = (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE category_id = items.category_id
          ORDER BY date_created DESC
        )
      ) AS selected_month_revenue_group_total_amount
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
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
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
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
            AND DATE('${dateFilter}', 'start of month', '-1 day')
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
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS selected_month_logs
          LEFT JOIN items ON items.id = selected_month_logs.item_id
          LEFT JOIN operations ON operations.id = selected_month_logs.operation_id
          GROUP BY selected_month_logs.item_id, operations.type
        ) AS selected_month_display_added_and_removed
        LEFT JOIN items ON items.id = selected_month_display_added_and_removed.item_id
        GROUP BY selected_month_display_added_and_removed.item_id
      ) AS selected_month_added_and_removed
      ON selected_month_added_and_removed.item_id = items.id

      LEFT JOIN (
        SELECT date_filtered_total_added_and_removed.item_id AS item_id,
        date_filtered_total_added_and_removed.item_name AS item_name,
        date_filtered_total_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_qty END), 0) AS date_filtered_total_added_stock_qty,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_qty END), 0) AS date_filtered_total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost END), 0) AS date_filtered_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost END), 0) AS date_filtered_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_net END), 0) AS date_filtered_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_net END), 0) AS date_filtered_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_tax END), 0) AS date_filtered_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_tax END), 0) AS date_filtered_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(date_filtered_logs.adjustment_qty) AS total_stock_qty,
          SUM(date_filtered_logs.adjustment_unit_cost * date_filtered_logs.adjustment_qty) AS total_stock_cost,
          SUM(date_filtered_logs.adjustment_unit_cost_net * date_filtered_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(date_filtered_logs.adjustment_unit_cost_tax * date_filtered_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM (
            SELECT * FROM inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS date_filtered_logs
          LEFT JOIN items ON items.id = date_filtered_logs.item_id
          LEFT JOIN operations ON operations.id = date_filtered_logs.operation_id
          GROUP BY date_filtered_logs.item_id, operations.type
        ) AS date_filtered_total_added_and_removed
        LEFT JOIN items ON items.id = date_filtered_total_added_and_removed.item_id
        GROUP BY date_filtered_total_added_and_removed.item_id
      ) AS date_filtered_totals
      ON date_filtered_totals.item_id = items.id

      JOIN categories ON categories.id = items.category_id
      
      ${queryFilter}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    const dateFilteredAllItemsTotalAddedStockCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_items_total_added_stock_cost'
      ];
    const dateFilteredAllItemsTotalRemovedStockCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_items_total_removed_stock_cost'
      ];

    const dateFilteredAllItemsTotalAddedStockCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_items_total_added_stock_cost_net'
      ];
    const dateFilteredAllItemsTotalRemovedStockCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_items_total_removed_stock_cost_net'
      ];

    const dateFilteredAllItemsTotalAddedStockCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_items_total_added_stock_cost_tax'
      ];
    const dateFilteredAllItemsTotalRemovedStockCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_items_total_removed_stock_cost_tax'
      ];

    const dateFilteredAllItemsTotalCost =
      results?.[0]?.rows?.raw()?.[0]?.['date_filtered_all_items_total_cost'];
    const dateFilteredAllItemsTotalCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_items_total_cost_net'
      ];
    const dateFilteredAllItemsTotalCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_items_total_cost_tax'
      ];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        items.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      totals: {
        dateFilteredAllItemsTotalAddedStockCost,
        dateFilteredAllItemsTotalAddedStockCostNet,
        dateFilteredAllItemsTotalAddedStockCostTax,
        dateFilteredAllItemsTotalRemovedStockCost,
        dateFilteredAllItemsTotalRemovedStockCostNet,
        dateFilteredAllItemsTotalRemovedStockCostTax,
        dateFilteredAllItemsTotalCost,
        dateFilteredAllItemsTotalCostNet,
        dateFilteredAllItemsTotalCostTax,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get items custom report totals.');
  }
};

export const getCategoriesCustomReport = async ({queryKey, pageParam = 1}) => {
  const [
    _key,
    {
      filter,
      dateFilter,
      limit = 1000000000,
      monthYearDateFilter,
      selectedMonthYearDateFilter,
      monthToDateFilter,
      dateRangeFilter,
    },
  ] = queryKey;
  const orderBy = 'categories.name';
  let queryFilter = createQueryFilter(filter);

  let start = '';
  let end = '';

  if (selectedMonthYearDateFilter) {
    start = `DATE('${selectedMonthYearDateFilter}', 'start of month')`;
    end = `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (monthToDateFilter) {
    start = `DATE('${monthToDateFilter.start}', 'start of month')`;
    end = `DATE('${monthToDateFilter.end}')`;
  } else if (dateRangeFilter) {
    start = `DATE('${dateRangeFilter.start}')`;
    end = `DATE('${dateRangeFilter.end}')`;
  }

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectAllQuery = `
      SELECT categories.id AS id,
      categories.id AS category_id,
      categories.name AS category_name,

      selected_month_totals.selected_month_total_added_stock_cost AS selected_month_total_added_stock_cost,
      selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_total_removed_stock_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net AS selected_month_total_added_stock_cost_net,
      selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_total_removed_stock_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax AS selected_month_total_added_stock_cost_tax,
      selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_total_removed_stock_cost_tax,
      selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_grand_total_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_grand_total_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_grand_total_cost_tax,

      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_cost,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net AS previous_month_total_added_stock_cost_net,
      previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_total_removed_stock_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax AS previous_month_total_added_stock_cost_tax,
      previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_total_removed_stock_cost_tax,
      previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_grand_total_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_grand_total_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_grand_total_cost_tax,
      
      date_filtered_totals.date_filtered_total_added_stock_cost AS date_filtered_total_added_stock_cost,
      date_filtered_totals.date_filtered_total_removed_stock_cost AS date_filtered_total_removed_stock_cost,
      date_filtered_totals.date_filtered_total_added_stock_cost_net AS date_filtered_total_added_stock_cost_net,
      date_filtered_totals.date_filtered_total_removed_stock_cost_net AS date_filtered_total_removed_stock_cost_net,
      date_filtered_totals.date_filtered_total_added_stock_cost_tax AS date_filtered_total_added_stock_cost_tax,
      date_filtered_totals.date_filtered_total_removed_stock_cost_tax AS date_filtered_total_removed_stock_cost_tax,
      date_filtered_totals.date_filtered_total_added_stock_cost - date_filtered_totals.date_filtered_total_removed_stock_cost AS date_filtered_grand_total_cost,
      date_filtered_totals.date_filtered_total_added_stock_cost_net - date_filtered_totals.date_filtered_total_removed_stock_cost_net AS date_filtered_grand_total_cost_net,
      date_filtered_totals.date_filtered_total_added_stock_cost_tax - date_filtered_totals.date_filtered_total_removed_stock_cost_tax AS date_filtered_grand_total_cost_tax,
      (
        SELECT name
        FROM revenue_groups
        WHERE revenue_groups.id = (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE category_id = categories.id
          ORDER BY date_created DESC
        )
      ) AS revenue_group_name,
      (
        SELECT SUM(amount) AS selected_month_revenue_group_total_amount
        FROM revenues
        WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${dateFilter}'))
        AND revenue_group_id = (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE category_id = categories.id
          ORDER BY date_created DESC
        )
      ) AS selected_month_revenue_group_total_amount
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM categories

      LEFT JOIN (
        SELECT selected_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_net * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_tax * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_selected_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS from_earliest_to_selected_month_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_selected_month_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_selected_month_logs.operation_id
          GROUP BY from_earliest_to_selected_month_logs.category_id, operations.type
        ) AS selected_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = selected_month_total_added_and_removed.category_id
        GROUP BY selected_month_total_added_and_removed.category_id
      ) AS selected_month_totals
      ON selected_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT previous_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_net * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_tax * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_previous_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${dateFilter}', 'start of month', '-1 day')
          ) AS from_earliest_to_previous_month_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_previous_month_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_previous_month_logs.operation_id
          GROUP BY from_earliest_to_previous_month_logs.category_id, operations.type
        ) AS previous_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = previous_month_total_added_and_removed.category_id
        GROUP BY previous_month_total_added_and_removed.category_id
      ) AS previous_month_totals
      ON previous_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT date_filtered_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost END), 0) AS date_filtered_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost END), 0) AS date_filtered_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_net END), 0) AS date_filtered_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_net END), 0) AS date_filtered_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_tax END), 0) AS date_filtered_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_tax END), 0) AS date_filtered_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_date_filtered_logs.adjustment_unit_cost * from_earliest_to_date_filtered_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_date_filtered_logs.adjustment_unit_cost_net * from_earliest_to_date_filtered_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_date_filtered_logs.adjustment_unit_cost_tax * from_earliest_to_date_filtered_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_date_filtered_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS from_earliest_to_date_filtered_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_date_filtered_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_date_filtered_logs.operation_id
          GROUP BY from_earliest_to_date_filtered_logs.category_id, operations.type
        ) AS date_filtered_total_added_and_removed
        LEFT JOIN categories ON categories.id = date_filtered_total_added_and_removed.category_id
        GROUP BY date_filtered_total_added_and_removed.category_id
      ) AS date_filtered_totals
      ON date_filtered_totals.category_id = categories.id
      
      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        items.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: items,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get categories custom report.');
  }
};

export const getCategoriesCustomReportTotals = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [
    _key,
    {
      filter,
      dateFilter,
      limit = 0,
      monthYearDateFilter,
      selectedMonthYearDateFilter,
      monthToDateFilter,
      dateRangeFilter,
    },
  ] = queryKey;
  const orderBy = 'categories.name';
  let queryFilter = createQueryFilter(filter);

  let start = '';
  let end = '';

  if (selectedMonthYearDateFilter) {
    start = `DATE('${selectedMonthYearDateFilter}', 'start of month')`;
    end = `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (monthToDateFilter) {
    start = `DATE('${monthToDateFilter.start}', 'start of month')`;
    end = `DATE('${monthToDateFilter.end}')`;
  } else if (dateRangeFilter) {
    start = `DATE('${dateRangeFilter.start}')`;
    end = `DATE('${dateRangeFilter.end}')`;
  }

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectAllQuery = `
      SELECT categories.id AS id,
      categories.id AS category_id,
      categories.name AS category_name,

      selected_month_totals.selected_month_total_added_stock_cost AS selected_month_total_added_stock_cost,
      selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_total_removed_stock_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net AS selected_month_total_added_stock_cost_net,
      selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_total_removed_stock_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax AS selected_month_total_added_stock_cost_tax,
      selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_total_removed_stock_cost_tax,
      selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_grand_total_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_grand_total_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_grand_total_cost_tax,

      SUM(selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost) AS selected_month_all_categories_total_cost,
      SUM(selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net) AS selected_month_all_categories_total_cost_net,
      SUM(selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax) AS selected_month_all_categories_total_cost_tax,

      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_cost,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net AS previous_month_total_added_stock_cost_net,
      previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_total_removed_stock_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax AS previous_month_total_added_stock_cost_tax,
      previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_total_removed_stock_cost_tax,
      previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_grand_total_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_grand_total_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_grand_total_cost_tax,

      SUM(previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost) AS previous_month_all_categories_total_cost,
      SUM(previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net) AS previous_month_all_categories_total_cost_net,
      SUM(previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax) AS previous_month_all_categories_total_cost_tax,

      date_filtered_totals.date_filtered_total_added_stock_cost AS date_filtered_total_added_stock_cost,
      date_filtered_totals.date_filtered_total_removed_stock_cost AS date_filtered_total_removed_stock_cost,
      date_filtered_totals.date_filtered_total_added_stock_cost_net AS date_filtered_total_added_stock_cost_net,
      date_filtered_totals.date_filtered_total_removed_stock_cost_net AS date_filtered_total_removed_stock_cost_net,
      date_filtered_totals.date_filtered_total_added_stock_cost_tax AS date_filtered_total_added_stock_cost_tax,
      date_filtered_totals.date_filtered_total_removed_stock_cost_tax AS date_filtered_total_removed_stock_cost_tax,
      date_filtered_totals.date_filtered_total_added_stock_cost - date_filtered_totals.date_filtered_total_removed_stock_cost AS date_filtered_grand_total_cost,
      date_filtered_totals.date_filtered_total_added_stock_cost_net - date_filtered_totals.date_filtered_total_removed_stock_cost_net AS date_filtered_grand_total_cost_net,
      date_filtered_totals.date_filtered_total_added_stock_cost_tax - date_filtered_totals.date_filtered_total_removed_stock_cost_tax AS date_filtered_grand_total_cost_tax,

      SUM(date_filtered_totals.date_filtered_total_added_stock_cost - date_filtered_totals.date_filtered_total_removed_stock_cost) AS date_filtered_all_categories_total_cost,
      SUM(date_filtered_totals.date_filtered_total_added_stock_cost_net - date_filtered_totals.date_filtered_total_removed_stock_cost_net) AS date_filtered_all_categories_total_cost_net,
      SUM(date_filtered_totals.date_filtered_total_added_stock_cost_tax - date_filtered_totals.date_filtered_total_removed_stock_cost_tax) AS date_filtered_all_categories_total_cost_tax,

      (
        SELECT name
        FROM revenue_groups
        WHERE revenue_groups.id = (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE category_id = categories.id
          ORDER BY date_created DESC
        )
      ) AS revenue_group_name,
      (
        SELECT SUM(amount) AS selected_month_revenue_group_total_amount
        FROM revenues
        WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${dateFilter}'))
        AND revenue_group_id = (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE category_id = categories.id
          ORDER BY date_created DESC
        )
      ) AS selected_month_revenue_group_total_amount
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM categories

      LEFT JOIN (
        SELECT selected_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_net * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_tax * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_selected_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS from_earliest_to_selected_month_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_selected_month_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_selected_month_logs.operation_id
          GROUP BY from_earliest_to_selected_month_logs.category_id, operations.type
        ) AS selected_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = selected_month_total_added_and_removed.category_id
        GROUP BY selected_month_total_added_and_removed.category_id
      ) AS selected_month_totals
      ON selected_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT previous_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_net * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_tax * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_previous_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${dateFilter}', 'start of month', '-1 day')
          ) AS from_earliest_to_previous_month_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_previous_month_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_previous_month_logs.operation_id
          GROUP BY from_earliest_to_previous_month_logs.category_id, operations.type
        ) AS previous_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = previous_month_total_added_and_removed.category_id
        GROUP BY previous_month_total_added_and_removed.category_id
      ) AS previous_month_totals
      ON previous_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT date_filtered_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost END), 0) AS date_filtered_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost END), 0) AS date_filtered_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_net END), 0) AS date_filtered_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_net END), 0) AS date_filtered_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'add_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_tax END), 0) AS date_filtered_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN date_filtered_total_added_and_removed.operation_type = 'remove_stock' THEN date_filtered_total_added_and_removed.total_stock_cost_tax END), 0) AS date_filtered_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_date_filtered_logs.adjustment_unit_cost * from_earliest_to_date_filtered_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_date_filtered_logs.adjustment_unit_cost_net * from_earliest_to_date_filtered_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_date_filtered_logs.adjustment_unit_cost_tax * from_earliest_to_date_filtered_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_date_filtered_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS from_earliest_to_date_filtered_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_date_filtered_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_date_filtered_logs.operation_id
          GROUP BY from_earliest_to_date_filtered_logs.category_id, operations.type
        ) AS date_filtered_total_added_and_removed
        LEFT JOIN categories ON categories.id = date_filtered_total_added_and_removed.category_id
        GROUP BY date_filtered_total_added_and_removed.category_id
      ) AS date_filtered_totals
      ON date_filtered_totals.category_id = categories.id
      
      ${queryFilter}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    const selectedMonthAllCategoriesTotalCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'selected_month_all_categories_total_cost'
      ];
    const selectedMonthAllCategoriesTotalCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'selected_month_all_categories_total_cost_net'
      ];
    const selectedMonthAllCategoriesTotalCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'selected_month_all_categories_total_cost_tax'
      ];

    const previousMonthAllCategoriesTotalCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'previous_month_all_categories_total_cost'
      ];
    const previousMonthAllCategoriesTotalCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'previous_month_all_categories_total_cost_net'
      ];
    const previousMonthAllCategoriesTotalCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'previous_month_all_categories_total_cost_tax'
      ];

    const dateFilteredAllCategoriesTotalCost =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_categories_total_cost'
      ];
    const dateFilteredAllCategoriesTotalCostNet =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_categories_total_cost_net'
      ];
    const dateFilteredAllCategoriesTotalCostTax =
      results?.[0]?.rows?.raw()?.[0]?.[
        'date_filtered_all_categories_total_cost_tax'
      ];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        items.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      totals: {
        selectedMonthAllCategoriesTotalCost,
        selectedMonthAllCategoriesTotalCostNet,
        selectedMonthAllCategoriesTotalCostTax,
        previousMonthAllCategoriesTotalCost,
        previousMonthAllCategoriesTotalCostNet,
        previousMonthAllCategoriesTotalCostTax,
        dateFilteredAllCategoriesTotalCost,
        dateFilteredAllCategoriesTotalCostNet,
        dateFilteredAllCategoriesTotalCostTax,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get categories custom report totals.');
  }
};

export const getRevenueGroupsMonthlyReportTotals = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key, {filter, dateFilter, limit = 1000000000}] = queryKey;
  const orderBy = 'categories.revenue_group_name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectAllQuery = `
      SELECT categories.id AS id,
      categories.id AS category_id,
      categories.name AS category_name,
      categories.revenue_group_id AS revenue_group_id,
      categories.revenue_group_name AS revenue_group_name,

      SUM(IFNULL((selected_month_totals.selected_month_total_removed_stock_cost / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS selected_month_revenue_group_categories_cost_percentage,
      SUM(IFNULL((selected_month_totals.selected_month_total_removed_stock_cost_net / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS selected_month_revenue_group_categories_net_cost_percentage,

      SUM(IFNULL((whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS selected_month_revenue_group_categories_purchase_cost_percentage,
      SUM(IFNULL((whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_net / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS selected_month_revenue_group_categories_purchase_net_cost_percentage,

      SUM(IFNULL((whole_month_totals.whole_month_total_removed_stock_cost / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS whole_month_revenue_group_categories_total_removed_stock_cost_percentage,
      SUM(IFNULL((whole_month_totals.whole_month_total_removed_stock_cost_net / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS whole_month_revenue_group_categories_total_removed_stock_cost_net_percentage,

      SUM(IFNULL((whole_month_totals.whole_month_total_added_stock_cost / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS whole_month_revenue_group_categories_total_added_stock_cost_percentage,
      SUM(IFNULL((whole_month_totals.whole_month_total_added_stock_cost_net / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS whole_month_revenue_group_categories_total_added_stock_cost_net_percentage,

      selected_month_totals.selected_month_total_added_stock_cost AS selected_month_total_added_stock_cost,
      selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_total_removed_stock_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net AS selected_month_total_added_stock_cost_net,
      selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_total_removed_stock_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax AS selected_month_total_added_stock_cost_tax,
      selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_total_removed_stock_cost_tax,
      selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_grand_total_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_grand_total_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_grand_total_cost_tax,

      SUM(selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost) AS selected_month_revenue_group_categories_total_cost,
      SUM(selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net) AS selected_month_revenue_group_categories_total_cost_net,
      SUM(selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax) AS selected_month_revenue_group_categories_total_cost_tax,

      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_cost,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net AS previous_month_total_added_stock_cost_net,
      previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_total_removed_stock_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax AS previous_month_total_added_stock_cost_tax,
      previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_total_removed_stock_cost_tax,
      previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_grand_total_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_grand_total_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_grand_total_cost_tax,

      SUM(previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost) AS previous_month_revenue_group_categories_total_cost,
      SUM(previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net) AS previous_month_revenue_group_categories_total_cost_net,
      SUM(previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax) AS previous_month_revenue_group_categories_total_cost_tax,

      whole_month_totals.whole_month_total_added_stock_cost AS whole_month_total_added_stock_cost,
      whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_total_removed_stock_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net AS whole_month_total_added_stock_cost_net,
      whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_total_removed_stock_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax AS whole_month_total_added_stock_cost_tax,
      whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_total_removed_stock_cost_tax,
      whole_month_totals.whole_month_total_added_stock_cost - whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_grand_total_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net - whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_grand_total_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax - whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_grand_total_cost_tax,

      SUM(whole_month_totals.whole_month_total_added_stock_cost) AS whole_month_revenue_group_categories_total_added_stock_cost,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_net) AS whole_month_revenue_group_categories_total_added_stock_cost_net,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_tax) AS whole_month_revenue_group_categories_total_added_stock_cost_tax,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost) AS whole_month_revenue_group_categories_total_removed_stock_cost,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost_net) AS whole_month_revenue_group_categories_total_removed_stock_cost_net,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost_tax) AS whole_month_revenue_group_categories_total_removed_stock_cost_tax,

      SUM(whole_month_totals.whole_month_total_added_stock_cost - whole_month_totals.whole_month_total_removed_stock_cost) AS whole_month_revenue_group_categories_total_cost,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_net - whole_month_totals.whole_month_total_removed_stock_cost_net) AS whole_month_revenue_group_categories_total_cost_net,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_tax - whole_month_totals.whole_month_total_removed_stock_cost_tax) AS whole_month_revenue_group_categories_total_cost_tax,

      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost) AS whole_month_revenue_group_categories_operation_id_1_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost_net) AS whole_month_revenue_group_categories_operation_id_1_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_1_total_cost_tax) AS whole_month_revenue_group_categories_operation_id_1_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost) AS whole_month_revenue_group_categories_operation_id_2_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_net) AS whole_month_revenue_group_categories_operation_id_2_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_2_total_cost_tax) AS whole_month_revenue_group_categories_operation_id_2_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost) AS whole_month_revenue_group_categories_operation_id_3_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost_net) AS whole_month_revenue_group_categories_operation_id_3_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_3_total_cost_tax) AS whole_month_revenue_group_categories_operation_id_3_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost) AS whole_month_revenue_group_categories_operation_id_4_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost_net) AS whole_month_revenue_group_categories_operation_id_4_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_4_total_cost_tax) AS whole_month_revenue_group_categories_operation_id_4_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost) AS whole_month_revenue_group_categories_operation_id_5_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost_net) AS whole_month_revenue_group_categories_operation_id_5_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_5_total_cost_tax) AS whole_month_revenue_group_categories_operation_id_5_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost) AS whole_month_revenue_group_categories_operation_id_6_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost_net) AS whole_month_revenue_group_categories_operation_id_6_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_6_total_cost_tax) AS whole_month_revenue_group_categories_operation_id_6_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost) AS whole_month_revenue_group_categories_operation_id_7_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost_net) AS whole_month_revenue_group_categories_operation_id_7_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_7_total_cost_tax) AS whole_month_revenue_group_categories_operation_id_7_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost) AS whole_month_revenue_group_categories_operation_id_8_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost_net) AS whole_month_revenue_group_categories_operation_id_8_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_8_total_cost_tax) AS whole_month_revenue_group_categories_operation_id_8_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost) AS whole_month_revenue_group_categories_operation_id_9_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost_net) AS whole_month_revenue_group_categories_operation_id_9_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_9_total_cost_tax) AS whole_month_revenue_group_categories_operation_id_9_total_cost_tax,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost) AS whole_month_revenue_group_categories_operation_id_10_total_cost,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost_net) AS whole_month_revenue_group_categories_operation_id_10_total_cost_net,
      SUM(whole_month_operations_and_totals_in_columns.whole_month_operation_id_10_total_cost_tax) AS whole_month_revenue_group_categories_operation_id_10_total_cost_tax
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM (
        SELECT *,
        (
          SELECT name FROM revenue_groups
          WHERE revenue_groups.id = (
            SELECT revenue_group_id
            FROM revenue_categories
            WHERE revenue_categories.category_id = c.id
            ORDER BY date_created DESC
          )
        ) AS revenue_group_name,
        (
          SELECT revenue_group_id
          FROM revenue_categories
          WHERE revenue_categories.category_id = c.id
          ORDER BY date_created DESC
        ) AS revenue_group_id,
        (
          SELECT IFNULL(SUM(amount), 0)
          FROM revenues
          WHERE strftime('%m %Y', revenue_group_date) = strftime('%m %Y', datetime('${dateFilter}'))
          AND revenue_group_id = (
            SELECT revenue_group_id
            FROM revenue_categories
            WHERE category_id = c.id
            ORDER BY date_created DESC
          )
        ) AS selected_month_revenue_group_total_amount
        FROM categories c
      ) AS categories
     
      LEFT JOIN (
        SELECT selected_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_net * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_tax * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_selected_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS from_earliest_to_selected_month_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_selected_month_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_selected_month_logs.operation_id
          GROUP BY from_earliest_to_selected_month_logs.category_id, operations.type
        ) AS selected_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = selected_month_total_added_and_removed.category_id
        GROUP BY selected_month_total_added_and_removed.category_id
      ) AS selected_month_totals
      ON selected_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT previous_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_net * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_tax * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          from_earliest_to_previous_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND DATE('${dateFilter}', 'start of month', '-1 day')
          ) AS from_earliest_to_previous_month_logs
          LEFT JOIN categories ON categories.id = from_earliest_to_previous_month_logs.category_id
          LEFT JOIN operations ON operations.id = from_earliest_to_previous_month_logs.operation_id
          GROUP BY from_earliest_to_previous_month_logs.category_id, operations.type
        ) AS previous_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = previous_month_total_added_and_removed.category_id
        GROUP BY previous_month_total_added_and_removed.category_id
      ) AS previous_month_totals
      ON previous_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT whole_month_total_added_and_removed.category_id AS category_id,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost END), 0) AS whole_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost END), 0) AS whole_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost_net END), 0) AS whole_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost_net END), 0) AS whole_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'add_stock' THEN whole_month_total_added_and_removed.total_stock_cost_tax END), 0) AS whole_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_total_added_and_removed.operation_type = 'remove_stock' THEN whole_month_total_added_and_removed.total_stock_cost_tax END), 0) AS whole_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS whole_month_logs
          LEFT JOIN categories ON categories.id = whole_month_logs.category_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.category_id, operations.type
        ) AS whole_month_total_added_and_removed
        LEFT JOIN categories ON categories.id = whole_month_total_added_and_removed.category_id
        GROUP BY whole_month_total_added_and_removed.category_id
      ) AS whole_month_totals
      ON whole_month_totals.category_id = categories.id

      LEFT JOIN (
        SELECT whole_month_operations_and_totals.category_id AS category_id,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_1_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_1_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 1 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_1_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_2_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_2_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 2 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_2_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_3_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_3_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 3 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_3_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_4_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_4_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 4 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_4_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_5_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_5_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 5 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_5_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_6_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_6_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 6 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_6_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_7_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_7_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 7 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_7_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_8_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_8_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 8 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_8_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_9_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_9_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 9 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_9_total_cost_tax,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost END), 0) AS whole_month_operation_id_10_total_cost,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost_net END), 0) AS whole_month_operation_id_10_total_cost_net,
        IFNULL(SUM(CASE WHEN whole_month_operations_and_totals.operation_id = 10 THEN whole_month_operations_and_totals.total_cost_tax END), 0) AS whole_month_operation_id_10_total_cost_tax
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.category_id AS category_id,
          whole_month_logs.operation_id AS operation_id
          FROM (
            SELECT *
            FROM inventory_logs
            LEFT JOIN items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN DATE('${dateFilter}', 'start of month')
            AND DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')
          ) AS whole_month_logs
          LEFT JOIN categories ON categories.id = whole_month_logs.category_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.category_id, whole_month_logs.operation_id
        ) AS whole_month_operations_and_totals
        LEFT JOIN categories ON categories.id = whole_month_operations_and_totals.category_id
        GROUP BY whole_month_operations_and_totals.category_id
      ) AS whole_month_operations_and_totals_in_columns
      ON whole_month_operations_and_totals_in_columns.category_id = categories.id

      GROUP BY categories.revenue_group_name
    `;

    const results = await db.executeSql(selectAllQuery + query);

    let revenueGroupCategoriesTotals = [];
    let revenueGroups = {};

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        revenueGroupCategoriesTotals.push(result.rows.item(index));
        const item = result.rows.item(index);
        revenueGroups[`${item.revenue_group_name}`] = item;
      }
    });

    return {
      totals: {
        revenueGroups,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get revenue group monthly report totals.');
  }
};

export const getTotalItems = async ({queryKey, pageParam = 1}) => {
  try {
    const db = await getDBConnection();

    const query = `
      SELECT COUNT(*)
      FROM items
    `;

    const result = await db.executeSql(query);
    const totalCount = result?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    return {
      result: totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get total items.');
  }
};

export const getTotalCategories = async ({queryKey, pageParam = 1}) => {
  try {
    const db = await getDBConnection();

    const query = `
      SELECT COUNT(*)
      FROM categories
    `;

    const result = await db.executeSql(query);
    const totalCount = result?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    return {
      result: totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get total categories.');
  }
};
