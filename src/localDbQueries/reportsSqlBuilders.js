import {buildRevenueGroupMonthTotalSql} from './revenues';

/**
 * SQL builders for the inventory/cost reports in `reports.js`.
 *
 * Every report query is assembled from a small set of repeating SQL building
 * blocks (per-period running totals, whole-month totals, an operation-code
 * pivot, etc.). Historically each report inlined its own multi-hundred-line copy
 * of these blocks, so the file was ~3200 lines of near-duplicate SQL. This module
 * holds those blocks once, as named, documented builders, so each report reads as
 * a short composition and the formulas can never drift between reports.
 *
 * IMPORTANT: these builders intentionally reproduce the EXACT SQL the original
 * inlined queries produced (column names, ordering, and per-report quirks are
 * load-bearing — 14 components read the results by exact column name). The
 * golden-master test in `__tests__/reportsSqlBuilders.test.js` locks this.
 */

// --------------------------------------------------------------------------
// Operation codes — single source of truth
// --------------------------------------------------------------------------
//
// `id` is the historical operation_id used in output column names
// (`..._operation_id_<id>_...`). `code` matches `operations.code` in the DB.
// `slug` is the column-name fragment (note: '_deprecated_8' -> 'deprecated8').
// Order matters: it is the order the columns appear in the generated SQL.
export const OPERATION_CODES = [
  {id: 1, code: 'pre_app_stock', slug: 'pre_app_stock'},
  {id: 2, code: 'new_purchase', slug: 'new_purchase'},
  {id: 3, code: 'inventory_recount_in', slug: 'inventory_recount_in'},
  {id: 4, code: 'stock_transfer_in', slug: 'stock_transfer_in'},
  {id: 5, code: 'initial_stock', slug: 'initial_stock'},
  {id: 6, code: 'stock_usage', slug: 'stock_usage'},
  {id: 7, code: 'inventory_recount_out', slug: 'inventory_recount_out'},
  {id: 8, code: '_deprecated_8', slug: 'deprecated8'},
  {id: 9, code: '_deprecated_9', slug: 'deprecated9'},
  {id: 10, code: 'stock_transfer_out', slug: 'stock_transfer_out'},
];

// Cost variants every cost-bearing column comes in.
//  ''      -> gross (`total_cost`),  '_net' -> VAT-exclusive,  '_tax' -> VAT only.
const COST_VARIANTS = ['', '_net', '_tax'];

// --------------------------------------------------------------------------
// Date-range fragments (the BETWEEN bounds for each window)
// --------------------------------------------------------------------------

// Earliest non-voided inventory log date in the DB — the lower bound for the
// "running total from the beginning of time up to <period end>" windows.
export const EARLIEST_LOG_DATE = `(SELECT DATE(adjustment_date) FROM active_inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)`;

const selectedMonthEnd = dateFilter =>
  `DATE('${dateFilter}', 'start of month', '+1 month', '-1 day')`;
const selectedMonthStart = dateFilter =>
  `DATE('${dateFilter}', 'start of month')`;
const previousMonthEnd = dateFilter =>
  `DATE('${dateFilter}', 'start of month', '-1 day')`;

// Running total from the earliest log up to the end of the selected month.
const rangeEarliestToSelectedMonth = dateFilter => ({
  start: EARLIEST_LOG_DATE,
  end: selectedMonthEnd(dateFilter),
});
// Running total from the earliest log up to the end of the previous month.
const rangeEarliestToPreviousMonth = dateFilter => ({
  start: EARLIEST_LOG_DATE,
  end: previousMonthEnd(dateFilter),
});
// Movements that happened within the selected month only.
const rangeWholeSelectedMonth = dateFilter => ({
  start: selectedMonthStart(dateFilter),
  end: selectedMonthEnd(dateFilter),
});

/**
 * Resolve the custom-report `start`/`end` BETWEEN bounds from the three mutually
 * exclusive custom-date filters (in priority order). Returns `{start, end}` as
 * raw SQL fragments (empty strings when no filter is supplied — matching the
 * original behavior).
 */
export const resolveCustomDateRange = ({
  selectedMonthYearDateFilter,
  monthToDateFilter,
  dateRangeFilter,
}) => {
  if (selectedMonthYearDateFilter) {
    return {
      start: `DATE('${selectedMonthYearDateFilter}', 'start of month')`,
      end: `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };
  }
  if (monthToDateFilter) {
    return {
      start: `DATE('${monthToDateFilter.start}', 'start of month')`,
      end: `DATE('${monthToDateFilter.end}')`,
    };
  }
  if (dateRangeFilter) {
    return {
      start: `DATE('${dateRangeFilter.start}')`,
      end: `DATE('${dateRangeFilter.end}')`,
    };
  }
  return {start: '', end: ''};
};

// --------------------------------------------------------------------------
// Revenue-group helpers (sales + external amounts; formula lives in revenues.js)
// --------------------------------------------------------------------------

// Revenue-group monthly total (internal POS sales + external/manual amounts) for
// the group that owns a category. `categoryIdSql` is the SQL expression that
// resolves the category id in the surrounding report query (e.g.
// `'items.category_id'`, `'i.category_id'`).
export const revenueGroupTotalForCategorySql = (categoryIdSql, dateFilter) =>
  buildRevenueGroupMonthTotalSql({
    groupIdSql: `(
      SELECT revenue_group_id
      FROM active_revenue_categories revenue_categories
      WHERE category_id = ${categoryIdSql}
      ORDER BY date_created DESC
    )`,
    dateSql: `datetime('${dateFilter}')`,
  });

// Grand total across ALL revenue groups for the month (sales + external),
// used as the all-categories cost-percentage denominator.
export const revenueGroupsGrandTotalSql = dateFilter =>
  `(SELECT IFNULL(SUM(${buildRevenueGroupMonthTotalSql({
    groupIdSql: 'revenue_groups.id',
    dateSql: `'${dateFilter}'`,
  })}), 0) FROM active_revenue_groups revenue_groups)`;

// Scalar subquery resolving a category's revenue-group NAME. `categoryIdSql` is
// the surrounding-query expression for the category id.
export const revenueGroupNameSubquery = categoryIdSql => `(
        SELECT name
        FROM active_revenue_groups revenue_groups
        WHERE revenue_groups.id = (
          SELECT revenue_group_id
          FROM active_revenue_categories revenue_categories
          WHERE category_id = ${categoryIdSql}
          ORDER BY date_created DESC
        )
      ) AS revenue_group_name`;

// The `FROM (SELECT *, revenue_group_name, revenue_group_id, total) AS <alias>`
// wrapper that decorates each base item/category row with its revenue-group
// name/id and monthly total. `entity` is 'item' (wraps active_items i) or
// 'category' (wraps active_categories c).
const revenueGroupWrappedFrom = (entity, dateFilter) => {
  const isItem = entity === 'item';
  const baseTable = isItem ? 'active_items i' : 'active_categories c';
  const catIdSql = isItem ? 'i.category_id' : 'c.id';
  const outAlias = isItem ? 'items' : 'categories';
  return `
      FROM (
        SELECT *,
        (
          SELECT name FROM active_revenue_groups revenue_groups
          WHERE revenue_groups.id = (
            SELECT revenue_group_id
            FROM active_revenue_categories revenue_categories
            WHERE revenue_categories.category_id = ${catIdSql}
            ORDER BY date_created DESC
          )
        ) AS revenue_group_name,
        (
          SELECT revenue_group_id
          FROM active_revenue_categories revenue_categories
          WHERE revenue_categories.category_id = ${catIdSql}
          ORDER BY date_created DESC
        ) AS revenue_group_id,
        ${revenueGroupTotalForCategorySql(
          catIdSql,
          dateFilter,
        )} AS selected_month_revenue_group_total_amount
        FROM ${baseTable}
      ) AS ${outAlias}`;
};

// --------------------------------------------------------------------------
// Column-list generators
// --------------------------------------------------------------------------

// Add/removed pivot columns over a middle subquery `src`, for the given stock
// `measures` (each in {'qty','cost','cost_net','cost_tax'}), e.g.
//   IFNULL(SUM(CASE WHEN src.operation_type = 'add_stock' THEN src.total_stock_cost END), 0) AS <prefix>_added_stock_cost
const pivotAddRemoveColumns = (src, prefix, measures) =>
  measures
    .map(
      m => `
        IFNULL(SUM(CASE WHEN ${src}.operation_type = 'add_stock' THEN ${src}.total_stock_${m} END), 0) AS ${prefix}_added_stock_${m},
        IFNULL(SUM(CASE WHEN ${src}.operation_type = 'remove_stock' THEN ${src}.total_stock_${m} END), 0) AS ${prefix}_removed_stock_${m}`,
    )
    .join(',');

// Operation-code pivot columns inside the operation-code subquery: one
// IFNULL(SUM(CASE ...)) per (operation × cost-variant), plus optional qty.
const operationPivotColumns = (src, {includeQty = false} = {}) => {
  const costCols = OPERATION_CODES.map(op =>
    COST_VARIANTS.map(
      v =>
        `IFNULL(SUM(CASE WHEN ${src}.operation_code = '${op.code}' THEN ${src}.total_cost${v} END), 0) AS whole_month_operation_code_${op.slug}_total_cost${v}`,
    ).join(',\n        '),
  ).join(',\n        ');
  if (!includeQty) {
    return costCols;
  }
  const qtyCols = OPERATION_CODES.map(
    op =>
      `IFNULL(SUM(CASE WHEN ${src}.operation_code = '${op.code}' THEN ${src}.total_qty END), 0) AS whole_month_operation_code_${op.slug}_total_qty`,
  ).join(',\n        ');
  return `${costCols},\n\n        ${qtyCols}`;
};

// Operation-code passthrough columns in a report's outer SELECT, reading from
// the `whole_month_operations_and_totals_in_columns` join. `includeQty` appends
// the 10 qty passthrough columns.
export const operationPassthroughColumns = (src, {includeQty = false} = {}) => {
  const costCols = OPERATION_CODES.map(op =>
    COST_VARIANTS.map(
      v =>
        `${src}.whole_month_operation_code_${op.slug}_total_cost${v} AS whole_month_operation_code_${op.slug}_total_cost${v}`,
    ).join(',\n      '),
  ).join(',\n      ');
  if (!includeQty) {
    return costCols;
  }
  const qtyCols = OPERATION_CODES.map(
    op =>
      `${src}.whole_month_operation_code_${op.slug}_total_qty AS whole_month_operation_code_${op.slug}_total_qty`,
  ).join(',\n      ');
  return `${costCols},\n\n      ${qtyCols}`;
};

// "All entities per operation id" SUM columns in a *Totals report's outer SELECT,
// e.g. SUM(src.whole_month_operation_code_<slug>_total_cost) AS <outPrefix>_operation_id_<id>_total_cost
export const allEntitiesOperationSumColumns = (src, outPrefix) =>
  OPERATION_CODES.map(op =>
    COST_VARIANTS.map(
      v =>
        `SUM(${src}.whole_month_operation_code_${op.slug}_total_cost${v}) AS ${outPrefix}_operation_id_${op.id}_total_cost${v}`,
    ).join(',\n      '),
  ).join(',\n      ');

// --------------------------------------------------------------------------
// Subquery block builders (the LEFT JOIN (...) totals tables)
// --------------------------------------------------------------------------

/**
 * "Running totals" / "date filtered" pivot block — sums each operation's
 * qty/cost across a date window and pivots add_stock/remove_stock into columns,
 * grouped by item or category.
 *
 * Item variant keeps qty + cost/net/tax and the item id/name/category passthrough
 * columns; category variant keeps cost/net/tax only and joins active_items in the
 * innermost logs to resolve category_id. Both are reproduced exactly as the
 * original inlined them.
 */
export const periodTotalsBlock = ({
  entity,
  outer,
  inner,
  logs,
  prefix,
  start,
  end,
  joinTo,
}) => {
  // The base row this totals table joins back to. Defaults to the entity's own
  // table (`items.id` / `categories.id`); callers can point it at a different
  // column — e.g. spoilages joins these totals on `spoilages.item_id`.
  const joinTarget =
    joinTo || (entity === 'item' ? 'items.id' : 'categories.id');
  if (entity === 'item') {
    return `
      LEFT JOIN (
        SELECT ${inner}.item_id AS item_id,
        ${inner}.item_name AS item_name,
        ${inner}.item_category_id AS item_category_id,
        ${pivotAddRemoveColumns(inner, prefix, [
          'qty',
          'cost',
          'cost_net',
          'cost_tax',
        ])}
        FROM (
          SELECT SUM(${logs}.adjustment_qty) AS total_stock_qty,
          SUM(${logs}.adjustment_unit_cost * ${logs}.adjustment_qty) AS total_stock_cost,
          SUM(${logs}.adjustment_unit_cost_net * ${logs}.adjustment_qty) AS total_stock_cost_net,
          SUM(${logs}.adjustment_unit_cost_tax * ${logs}.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM (
            SELECT * FROM active_inventory_logs inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS ${logs}
          LEFT JOIN active_items items ON items.id = ${logs}.item_id
          LEFT JOIN operations ON operations.id = ${logs}.operation_id
          GROUP BY ${logs}.item_id, operations.type
        ) AS ${inner}
        LEFT JOIN active_items items ON items.id = ${inner}.item_id
        GROUP BY ${inner}.item_id
      ) AS ${outer}
      ON ${outer}.item_id = ${joinTarget}`;
  }

  return `
      LEFT JOIN (
        SELECT ${inner}.category_id AS category_id,
        ${pivotAddRemoveColumns(inner, prefix, ['cost', 'cost_net', 'cost_tax'])}
        FROM (
          SELECT SUM(${logs}.adjustment_unit_cost * ${logs}.adjustment_qty) AS total_stock_cost,
          SUM(${logs}.adjustment_unit_cost_net * ${logs}.adjustment_qty) AS total_stock_cost_net,
          SUM(${logs}.adjustment_unit_cost_tax * ${logs}.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          ${logs}.category_id AS category_id
          FROM (
            SELECT *
            FROM active_inventory_logs inventory_logs
            LEFT JOIN active_items items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS ${logs}
          LEFT JOIN active_categories categories ON categories.id = ${logs}.category_id
          LEFT JOIN operations ON operations.id = ${logs}.operation_id
          GROUP BY ${logs}.category_id, operations.type
        ) AS ${inner}
        LEFT JOIN active_categories categories ON categories.id = ${inner}.category_id
        GROUP BY ${inner}.category_id
      ) AS ${outer}
      ON ${outer}.category_id = ${joinTarget}`;
};

export const selectedMonthTotalsBlock = (entity, dateFilter) =>
  periodTotalsBlock({
    entity,
    outer: 'selected_month_totals',
    inner: 'selected_month_total_added_and_removed',
    logs: 'from_earliest_to_selected_month_logs',
    prefix: 'selected_month_total',
    ...rangeEarliestToSelectedMonth(dateFilter),
  });

export const previousMonthTotalsBlock = (entity, dateFilter) =>
  periodTotalsBlock({
    entity,
    outer: 'previous_month_totals',
    inner: 'previous_month_total_added_and_removed',
    logs: 'from_earliest_to_previous_month_logs',
    prefix: 'previous_month_total',
    ...rangeEarliestToPreviousMonth(dateFilter),
  });

// Item custom report uses logs alias `date_filtered_logs`; category custom report
// uses `from_earliest_to_date_filtered_logs` — preserved per-entity.
const dateFilteredTotalsBlock = (entity, start, end) =>
  periodTotalsBlock({
    entity,
    outer: 'date_filtered_totals',
    inner: 'date_filtered_total_added_and_removed',
    logs:
      entity === 'item'
        ? 'date_filtered_logs'
        : 'from_earliest_to_date_filtered_logs',
    prefix: 'date_filtered_total',
    start,
    end,
  });

// Qty-only "added/removed within the selected month" block (item reports only).
export const selectedMonthAddedAndRemovedBlock = dateFilter => {
  const {start, end} = rangeWholeSelectedMonth(dateFilter);
  return `
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
            SELECT * FROM active_inventory_logs inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS selected_month_logs
          LEFT JOIN active_items items ON items.id = selected_month_logs.item_id
          LEFT JOIN operations ON operations.id = selected_month_logs.operation_id
          GROUP BY selected_month_logs.item_id, operations.type
        ) AS selected_month_display_added_and_removed
        LEFT JOIN active_items items ON items.id = selected_month_display_added_and_removed.item_id
        GROUP BY selected_month_display_added_and_removed.item_id
      ) AS selected_month_added_and_removed
      ON selected_month_added_and_removed.item_id = items.id`;
};

/**
 * Whole-month add/removed totals block (cost/net/tax). Three historical forms are
 * preserved exactly:
 *  - item 'monthly'  : innermost joins items+operations and selects `id`; groups
 *                      on `whole_month_logs.type`.
 *  - item 'totals'   : innermost joins items only; middle joins operations.
 *  - category        : joins items (for category_id) + categories + operations.
 */
const wholeMonthTotalsBlock = (entity, dateFilter, itemForm) => {
  const {start, end} = rangeWholeSelectedMonth(dateFilter);
  const pivot = pivotAddRemoveColumns(
    'whole_month_total_added_and_removed',
    'whole_month_total',
    ['cost', 'cost_net', 'cost_tax'],
  );

  if (entity === 'category') {
    return `
      LEFT JOIN (
        SELECT whole_month_total_added_and_removed.category_id AS category_id,
        ${pivot}
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.category_id AS category_id
          FROM (
            SELECT *
            FROM active_inventory_logs inventory_logs
            LEFT JOIN active_items items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS whole_month_logs
          LEFT JOIN active_categories categories ON categories.id = whole_month_logs.category_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.category_id, operations.type
        ) AS whole_month_total_added_and_removed
        LEFT JOIN active_categories categories ON categories.id = whole_month_total_added_and_removed.category_id
        GROUP BY whole_month_total_added_and_removed.category_id
      ) AS whole_month_totals
      ON whole_month_totals.category_id = categories.id`;
  }

  if (itemForm === 'monthly') {
    return `
      LEFT JOIN (
        SELECT whole_month_total_added_and_removed.item_id AS item_id,
        ${pivot}
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_stock_cost_tax,
          whole_month_logs.type AS operation_type,
          whole_month_logs.item_id AS item_id
          FROM (
            SELECT *,
            inventory_logs.id AS id
            FROM active_inventory_logs inventory_logs
            LEFT JOIN active_items items ON items.id = inventory_logs.item_id
            LEFT JOIN operations ON operations.id = inventory_logs.operation_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS whole_month_logs
          LEFT JOIN active_items items ON items.id = whole_month_logs.item_id
          GROUP BY whole_month_logs.item_id, whole_month_logs.type
        ) AS whole_month_total_added_and_removed
        LEFT JOIN active_items items ON items.id = whole_month_total_added_and_removed.item_id
        GROUP BY whole_month_total_added_and_removed.item_id
      ) AS whole_month_totals
      ON whole_month_totals.item_id = items.id`;
  }

  // itemForm === 'totals'
  return `
      LEFT JOIN (
        SELECT whole_month_total_added_and_removed.item_id AS item_id,
        ${pivot}
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.item_id AS item_id
          FROM (
            SELECT *
            FROM active_inventory_logs inventory_logs
            LEFT JOIN active_items items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS whole_month_logs
          LEFT JOIN active_items items ON items.id = whole_month_logs.item_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.item_id, operations.type
        ) AS whole_month_total_added_and_removed
        LEFT JOIN active_items items ON items.id = whole_month_total_added_and_removed.item_id
        GROUP BY whole_month_total_added_and_removed.item_id
      ) AS whole_month_totals
      ON whole_month_totals.item_id = items.id`;
};

/**
 * Operation-code pivot block — per item/category, one column per
 * (operation × cost-variant). Three historical forms are preserved exactly:
 *  - item 'monthly' : also pivots qty; innermost is bare logs + operations join.
 *  - item 'totals'  : cost-only; innermost joins items; middle joins operations.
 *  - category       : cost-only; joins items (for category_id) + categories.
 */
const operationPivotBlock = (entity, dateFilter, itemForm) => {
  const {start, end} = rangeWholeSelectedMonth(dateFilter);
  const src = 'whole_month_operations_and_totals';

  if (entity === 'category') {
    return `
      LEFT JOIN (
        SELECT ${src}.category_id AS category_id,
        ${operationPivotColumns(src)}
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.category_id AS category_id,
          whole_month_logs.operation_id AS operation_id,
          operations.code AS operation_code
          FROM (
            SELECT *
            FROM active_inventory_logs inventory_logs
            LEFT JOIN active_items items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS whole_month_logs
          LEFT JOIN active_categories categories ON categories.id = whole_month_logs.category_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.category_id, whole_month_logs.operation_id
        ) AS ${src}
        LEFT JOIN active_categories categories ON categories.id = ${src}.category_id
        GROUP BY ${src}.category_id
      ) AS whole_month_operations_and_totals_in_columns
      ON whole_month_operations_and_totals_in_columns.category_id = categories.id`;
  }

  if (itemForm === 'monthly') {
    return `
      LEFT JOIN (
        SELECT ${src}.item_id AS item_id,
        ${operationPivotColumns(src, {includeQty: true})}
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_cost_tax,
          SUM(whole_month_logs.adjustment_qty) AS total_qty,
          whole_month_logs.item_id AS item_id,
          whole_month_logs.operation_id AS operation_id,
          operations.code AS operation_code
          FROM (
            SELECT *
            FROM active_inventory_logs inventory_logs
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS whole_month_logs
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.item_id, whole_month_logs.operation_id
        ) AS ${src}
        GROUP BY ${src}.item_id
      ) AS whole_month_operations_and_totals_in_columns
      ON whole_month_operations_and_totals_in_columns.item_id = items.id`;
  }

  // itemForm === 'totals'
  return `
      LEFT JOIN (
        SELECT ${src}.item_id AS item_id,
        ${operationPivotColumns(src)}
        FROM (
          SELECT SUM(whole_month_logs.adjustment_unit_cost * whole_month_logs.adjustment_qty) AS total_cost,
          SUM(whole_month_logs.adjustment_unit_cost_net * whole_month_logs.adjustment_qty) AS total_cost_net,
          SUM(whole_month_logs.adjustment_unit_cost_tax * whole_month_logs.adjustment_qty) AS total_cost_tax,
          operations.type AS operation_type,
          whole_month_logs.item_id AS item_id,
          whole_month_logs.operation_id AS operation_id,
          operations.code AS operation_code
          FROM (
            SELECT *
            FROM active_inventory_logs inventory_logs
            LEFT JOIN active_items items ON items.id = inventory_logs.item_id
            WHERE inventory_logs.voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN ${start}
            AND ${end}
          ) AS whole_month_logs
          LEFT JOIN active_items items ON items.id = whole_month_logs.item_id
          LEFT JOIN operations ON operations.id = whole_month_logs.operation_id
          GROUP BY whole_month_logs.item_id, whole_month_logs.operation_id
        ) AS ${src}
        LEFT JOIN active_items items ON items.id = ${src}.item_id
        GROUP BY ${src}.item_id
      ) AS whole_month_operations_and_totals_in_columns
      ON whole_month_operations_and_totals_in_columns.item_id = items.id`;
};

// --------------------------------------------------------------------------
// Top-level report SQL builders (one per exported reports.js function)
// --------------------------------------------------------------------------

const OPS_COLS = 'whole_month_operations_and_totals_in_columns';

export const buildItemsMonthlyReportSql = ({dateFilter, queryFilter, queryOrderBy, limit, offset}) => {
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

      whole_month_totals.whole_month_total_added_stock_cost AS whole_month_total_added_stock_cost,
      whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_total_removed_stock_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net AS whole_month_total_added_stock_cost_net,
      whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_total_removed_stock_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax AS whole_month_total_added_stock_cost_tax,
      whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_total_removed_stock_cost_tax,
      whole_month_totals.whole_month_total_added_stock_cost - whole_month_totals.whole_month_total_removed_stock_cost AS whole_month_grand_total_cost,
      whole_month_totals.whole_month_total_added_stock_cost_net - whole_month_totals.whole_month_total_removed_stock_cost_net AS whole_month_grand_total_cost_net,
      whole_month_totals.whole_month_total_added_stock_cost_tax - whole_month_totals.whole_month_total_removed_stock_cost_tax AS whole_month_grand_total_cost_tax,

      ${operationPassthroughColumns(OPS_COLS, {includeQty: true})}
    `;
  const countAllQuery = `SELECT COUNT(*) `;
  const query = `
      ${revenueGroupWrappedFrom('item', dateFilter)}
      ${selectedMonthTotalsBlock('item', dateFilter)}
      ${previousMonthTotalsBlock('item', dateFilter)}
      ${selectedMonthAddedAndRemovedBlock(dateFilter)}
      ${wholeMonthTotalsBlock('item', dateFilter, 'monthly')}
      ${operationPivotBlock('item', dateFilter, 'monthly')}

      JOIN active_categories categories ON categories.id = items.category_id

      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;
  return {selectAllQuery, countAllQuery, query};
};

export const buildItemsMonthlyReportTotalsSql = ({dateFilter, queryFilter, limit, offset}) => {
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

      ${allEntitiesOperationSumColumns(OPS_COLS, 'whole_month_all_items')},

      selected_month_added_and_removed.total_added_stock_qty AS selected_month_total_added_stock_qty,
      selected_month_added_and_removed.total_removed_stock_qty AS selected_month_total_removed_stock_qty,

      (
        SELECT name
        FROM active_revenue_groups revenue_groups
        WHERE revenue_groups.id = (
          SELECT revenue_group_id
          FROM active_revenue_categories revenue_categories
          WHERE category_id = items.category_id
          ORDER BY date_created DESC
        )
      ) AS revenue_group_name,
      ${revenueGroupTotalForCategorySql(
        'items.category_id',
        dateFilter,
      )} AS selected_month_revenue_group_total_amount
    `;
  const countAllQuery = `SELECT COUNT(*) `;
  const query = `
      FROM active_items items
      ${selectedMonthTotalsBlock('item', dateFilter)}
      ${previousMonthTotalsBlock('item', dateFilter)}
      ${wholeMonthTotalsBlock('item', dateFilter, 'totals')}
      ${operationPivotBlock('item', dateFilter, 'totals')}
      ${selectedMonthAddedAndRemovedBlock(dateFilter)}

      JOIN active_categories categories ON categories.id = items.category_id

      ${queryFilter}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;
  return {selectAllQuery, countAllQuery, query};
};

export const buildItemReportSql = ({id, dateFilter}) => {
  const selectAllQuery = `
      SELECT items.id AS id,
      items.id AS item_id,
      items.name AS item_name,
      items.sku AS sku,
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

      (
        SELECT name
        FROM active_revenue_groups revenue_groups
        WHERE revenue_groups.id = (
          SELECT revenue_group_id
          FROM active_revenue_categories revenue_categories
          WHERE category_id = items.category_id
          ORDER BY date_created DESC
        )
      ) AS revenue_group_name,
      ${revenueGroupTotalForCategorySql(
        'items.category_id',
        dateFilter,
      )} AS selected_month_revenue_group_total_amount
    `;
  const query = `
      FROM active_items items
      ${selectedMonthTotalsBlock('item', dateFilter)}
      ${previousMonthTotalsBlock('item', dateFilter)}
      ${selectedMonthAddedAndRemovedBlock(dateFilter)}

      LEFT JOIN active_categories categories ON categories.id = items.category_id

      WHERE items.id = '${id}'
    `;
  return {selectAllQuery, query};
};

export const buildCategoriesMonthlyReportSql = ({dateFilter, queryFilter, queryOrderBy, limit, offset}) => {
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

      ${operationPassthroughColumns(OPS_COLS)}
    `;
  const countAllQuery = `SELECT COUNT(*) `;
  const query = `
      ${revenueGroupWrappedFrom('category', dateFilter)}
      ${selectedMonthTotalsBlock('category', dateFilter)}
      ${previousMonthTotalsBlock('category', dateFilter)}
      ${wholeMonthTotalsBlock('category', dateFilter)}
      ${operationPivotBlock('category', dateFilter)}

      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;
  return {selectAllQuery, countAllQuery, query};
};

export const buildCategoriesMonthlyReportTotalsSql = ({dateFilter, queryFilter}) => {
  const selectAllQuery = `
      SELECT categories.id AS id,
      categories.id AS category_id,
      categories.name AS category_name,

      SUM(whole_month_totals.whole_month_total_removed_stock_cost) / ${revenueGroupsGrandTotalSql(dateFilter)} * 100 AS whole_month_all_categories_total_removed_stock_cost_percentage,
      SUM(whole_month_totals.whole_month_total_removed_stock_cost_net) / ${revenueGroupsGrandTotalSql(dateFilter)} * 100 AS whole_month_all_categories_total_removed_stock_cost_net_percentage,

      SUM(whole_month_totals.whole_month_total_added_stock_cost) / ${revenueGroupsGrandTotalSql(dateFilter)} * 100 AS whole_month_all_categories_total_added_stock_cost_percentage,
      SUM(whole_month_totals.whole_month_total_added_stock_cost_net) / ${revenueGroupsGrandTotalSql(dateFilter)} * 100 AS whole_month_all_categories_total_added_stock_cost_net_percentage,

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


      ${allEntitiesOperationSumColumns(OPS_COLS, 'whole_month_all_categories')}
    `;
  const countAllQuery = `SELECT COUNT(*) `;
  const query = `
      ${revenueGroupWrappedFrom('category', dateFilter)}
      ${selectedMonthTotalsBlock('category', dateFilter)}
      ${previousMonthTotalsBlock('category', dateFilter)}
      ${wholeMonthTotalsBlock('category', dateFilter)}
      ${operationPivotBlock('category', dateFilter)}

      ${queryFilter}
    `;
  return {selectAllQuery, countAllQuery, query};
};

export const buildItemsCustomReportSql = ({dateFilter, start, end, queryFilter, queryOrderBy, limit, offset}) => {
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
        FROM active_revenue_groups revenue_groups
        WHERE revenue_groups.id = (
          SELECT revenue_group_id
          FROM active_revenue_categories revenue_categories
          WHERE category_id = items.category_id
          ORDER BY date_created DESC
        )
      ) AS revenue_group_name,
      ${revenueGroupTotalForCategorySql(
        'items.category_id',
        dateFilter,
      )} AS selected_month_revenue_group_total_amount
    `;
  const countAllQuery = `SELECT COUNT(*) `;
  const query = `
      FROM active_items items
      ${selectedMonthTotalsBlock('item', dateFilter)}
      ${previousMonthTotalsBlock('item', dateFilter)}
      ${selectedMonthAddedAndRemovedBlock(dateFilter)}
      ${dateFilteredTotalsBlock('item', start, end)}

      JOIN active_categories categories ON categories.id = items.category_id

      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;
  return {selectAllQuery, countAllQuery, query};
};

export const buildItemsCustomReportTotalsSql = ({dateFilter, start, end, queryFilter, limit, offset}) => {
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
        FROM active_revenue_groups revenue_groups
        WHERE revenue_groups.id = (
          SELECT revenue_group_id
          FROM active_revenue_categories revenue_categories
          WHERE category_id = items.category_id
          ORDER BY date_created DESC
        )
      ) AS revenue_group_name,
      ${revenueGroupTotalForCategorySql(
        'items.category_id',
        dateFilter,
      )} AS selected_month_revenue_group_total_amount
    `;
  const countAllQuery = `SELECT COUNT(*) `;
  const query = `
      FROM active_items items
      ${selectedMonthTotalsBlock('item', dateFilter)}
      ${previousMonthTotalsBlock('item', dateFilter)}
      ${selectedMonthAddedAndRemovedBlock(dateFilter)}
      ${dateFilteredTotalsBlock('item', start, end)}

      JOIN active_categories categories ON categories.id = items.category_id

      ${queryFilter}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;
  return {selectAllQuery, countAllQuery, query};
};

export const buildCategoriesCustomReportSql = ({dateFilter, start, end, queryFilter, queryOrderBy, limit, offset}) => {
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
      ${revenueGroupNameSubquery('categories.id')},
      ${revenueGroupTotalForCategorySql(
        'categories.id',
        dateFilter,
      )} AS selected_month_revenue_group_total_amount
    `;
  const countAllQuery = `SELECT COUNT(*) `;
  const query = `
      FROM active_categories categories
      ${selectedMonthTotalsBlock('category', dateFilter)}
      ${previousMonthTotalsBlock('category', dateFilter)}
      ${dateFilteredTotalsBlock('category', start, end)}

      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;
  return {selectAllQuery, countAllQuery, query};
};

export const buildCategoriesCustomReportTotalsSql = ({dateFilter, start, end, queryFilter, limit, offset}) => {
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

      ${revenueGroupNameSubquery('categories.id')},
      ${revenueGroupTotalForCategorySql(
        'categories.id',
        dateFilter,
      )} AS selected_month_revenue_group_total_amount
    `;
  const countAllQuery = `SELECT COUNT(*) `;
  const query = `
      FROM active_categories categories
      ${selectedMonthTotalsBlock('category', dateFilter)}
      ${previousMonthTotalsBlock('category', dateFilter)}
      ${dateFilteredTotalsBlock('category', start, end)}

      ${queryFilter}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `;
  return {selectAllQuery, countAllQuery, query};
};

export const buildRevenueGroupsMonthlyReportTotalsSql = ({dateFilter}) => {
  const selectAllQuery = `
      SELECT categories.id AS id,
      categories.id AS category_id,
      categories.name AS category_name,
      categories.revenue_group_id AS revenue_group_id,
      categories.revenue_group_name AS revenue_group_name,

      SUM(IFNULL((selected_month_totals.selected_month_total_removed_stock_cost / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS selected_month_revenue_group_categories_cost_percentage,
      SUM(IFNULL((selected_month_totals.selected_month_total_removed_stock_cost_net / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS selected_month_revenue_group_categories_net_cost_percentage,

      SUM(IFNULL((whole_month_operations_and_totals_in_columns.whole_month_operation_code_new_purchase_total_cost / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS selected_month_revenue_group_categories_purchase_cost_percentage,
      SUM(IFNULL((whole_month_operations_and_totals_in_columns.whole_month_operation_code_new_purchase_total_cost_net / categories.selected_month_revenue_group_total_amount) * 100, 0)) AS selected_month_revenue_group_categories_purchase_net_cost_percentage,

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

      ${allEntitiesOperationSumColumns(OPS_COLS, 'whole_month_revenue_group_categories')}
    `;
  const countAllQuery = `SELECT COUNT(*) `;
  const query = `
      ${revenueGroupWrappedFrom('category', dateFilter)}
      ${selectedMonthTotalsBlock('category', dateFilter)}
      ${previousMonthTotalsBlock('category', dateFilter)}
      ${wholeMonthTotalsBlock('category', dateFilter)}
      ${operationPivotBlock('category', dateFilter)}

      GROUP BY categories.revenue_group_name
    `;
  return {selectAllQuery, countAllQuery, query};
};

export const buildTotalItemsSql = () => `
      SELECT COUNT(*)
      FROM active_items items
    `;

export const buildTotalCategoriesSql = () => `
      SELECT COUNT(*)
      FROM active_categories categories
    `;
