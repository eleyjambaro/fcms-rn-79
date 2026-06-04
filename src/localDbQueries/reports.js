import {getDBConnection} from '../localDb';
import {createQueryFilter} from '../utils/localDbQueryHelpers';
import {
  OPERATION_CODES,
  resolveCustomDateRange,
  buildItemsMonthlyReportSql,
  buildItemsMonthlyReportTotalsSql,
  buildItemReportSql,
  buildCategoriesMonthlyReportSql,
  buildCategoriesMonthlyReportTotalsSql,
  buildItemsCustomReportSql,
  buildItemsCustomReportTotalsSql,
  buildCategoriesCustomReportSql,
  buildCategoriesCustomReportTotalsSql,
  buildRevenueGroupsMonthlyReportTotalsSql,
  buildTotalItemsSql,
  buildTotalCategoriesSql,
} from './reportsSqlBuilders';

// Helper for the `${prefix}_operation_id_<n>_total_cost[...]` columns that the
// *Totals reports emit per inventory operation. Reads the three cost variants of
// each operation off `row` into a flat `{ <prefix>OperationId<n>TotalCost... }`
// object, matching the shape the consuming components expect.
const collectPerOperationTotals = (row, prefix, sqlPrefix) => {
  const totals = {};
  OPERATION_CODES.forEach(({id}) => {
    totals[`${prefix}OperationId${id}TotalCost`] =
      row?.[`${sqlPrefix}_operation_id_${id}_total_cost`];
    totals[`${prefix}OperationId${id}TotalCostNet`] =
      row?.[`${sqlPrefix}_operation_id_${id}_total_cost_net`];
    totals[`${prefix}OperationId${id}TotalCostTax`] =
      row?.[`${sqlPrefix}_operation_id_${id}_total_cost_tax`];
  });
  return totals;
};

const collectRows = (results, into) => {
  results.forEach(result => {
    for (let index = 0; index < result.rows.length; index++) {
      into.push(result.rows.item(index));
    }
  });
};

export const getItemsMonthlyReport = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, dateFilter, limit = 15}] = queryKey;
  const orderBy = 'categories.name, items.name';
  const queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const {selectAllQuery, countAllQuery, query} = buildItemsMonthlyReportSql({
      dateFilter,
      queryFilter,
      queryOrderBy,
      limit,
      offset,
    });

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    collectRows(results, items);

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

export const getItemsMonthlyReportTotals = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, dateFilter, limit = 0}] = queryKey;
  const queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const offset = (pageParam - 1) * limit;
    const {selectAllQuery, countAllQuery, query} =
      buildItemsMonthlyReportTotalsSql({dateFilter, queryFilter, limit, offset});

    const results = await db.executeSql(selectAllQuery + query);
    // Run the count so its SQL shape is preserved (parity with the original).
    await db.executeSql(countAllQuery + query);

    const row = results?.[0]?.rows?.raw()?.[0];

    return {
      page: pageParam,
      totals: {
        selectedMonthAllItemsTotalCost: row?.['selected_month_all_items_total_cost'],
        selectedMonthAllItemsTotalCostNet:
          row?.['selected_month_all_items_total_cost_net'],
        selectedMonthAllItemsTotalCostTax:
          row?.['selected_month_all_items_total_cost_tax'],
        wholeMonthAllItemsTotalAddedStockCost:
          row?.['whole_month_all_items_total_added_stock_cost'],
        wholeMonthAllItemsTotalAddedStockCostNet:
          row?.['whole_month_all_items_total_added_stock_cost_net'],
        wholeMonthAllItemsTotalAddedStockCostTax:
          row?.['whole_month_all_items_total_added_stock_cost_tax'],
        wholeMonthAllItemsTotalRemovedStockCost:
          row?.['whole_month_all_items_total_removed_stock_cost'],
        wholeMonthAllItemsTotalRemovedStockCostNet:
          row?.['whole_month_all_items_total_removed_stock_cost_net'],
        wholeMonthAllItemsTotalRemovedStockCostTax:
          row?.['whole_month_all_items_total_removed_stock_cost_tax'],

        ...collectPerOperationTotals(
          row,
          'wholeMonthAllItems',
          'whole_month_all_items',
        ),
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
    const {selectAllQuery, query} = buildItemReportSql({id, dateFilter});

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
  const queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const {selectAllQuery, countAllQuery, query} =
      buildCategoriesMonthlyReportSql({
        dateFilter,
        queryFilter,
        queryOrderBy,
        limit,
        offset,
      });

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    collectRows(results, items);

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
  const queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const {selectAllQuery, countAllQuery, query} =
      buildCategoriesMonthlyReportTotalsSql({dateFilter, queryFilter});

    const results = await db.executeSql(selectAllQuery + query);
    await db.executeSql(countAllQuery + query);

    const row = results?.[0]?.rows?.raw()?.[0];

    return {
      page: pageParam,
      totals: {
        selectedMonthAllCategoriesTotalCost:
          row?.['selected_month_all_categories_total_cost'],
        selectedMonthAllCategoriesTotalCostNet:
          row?.['selected_month_all_categories_total_cost_net'],
        selectedMonthAllCategoriesTotalCostTax:
          row?.['selected_month_all_categories_total_cost_tax'],
        previousMonthAllCategoriesTotalCost:
          row?.['previous_month_all_categories_total_cost'],
        previousMonthAllCategoriesTotalCostNet:
          row?.['previous_month_all_categories_total_cost_net'],
        previousMonthAllCategoriesTotalCostTax:
          row?.['previous_month_all_categories_total_cost_tax'],
        wholeMonthAllCategoriesTotalCost:
          row?.['whole_month_all_categories_total_cost'],
        wholeMonthAllCategoriesTotalCostNet:
          row?.['whole_month_all_categories_total_cost_net'],
        wholeMonthAllCategoriesTotalCostTax:
          row?.['whole_month_all_categories_total_cost_tax'],

        // whole month percentage:
        wholeMonthAllCategoriesTotalAddedStockCostPercentage:
          row?.['whole_month_all_categories_total_added_stock_cost_percentage'],
        wholeMonthAllCategoriesTotalAddedStockCostNetPercentage:
          row?.[
            'whole_month_all_categories_total_added_stock_cost_net_percentage'
          ],
        wholeMonthAllCategoriesTotalRemovedStockCostPercentage:
          row?.[
            'whole_month_all_categories_total_removed_stock_cost_percentage'
          ],
        wholeMonthAllCategoriesTotalRemovedStockCostNetPercentage:
          row?.[
            'whole_month_all_categories_total_removed_stock_cost_net_percentage'
          ],

        wholeMonthAllCategoriesTotalAddedStockCost:
          row?.['whole_month_all_categories_total_added_stock_cost'],
        wholeMonthAllCategoriesTotalAddedStockCostNet:
          row?.['whole_month_all_categories_total_added_stock_cost_net'],
        wholeMonthAllCategoriesTotalAddedStockCostTax:
          row?.['whole_month_all_categories_total_added_stock_cost_tax'],
        wholeMonthAllCategoriesTotalRemovedStockCost:
          row?.['whole_month_all_categories_total_removed_stock_cost'],
        wholeMonthAllCategoriesTotalRemovedStockCostNet:
          row?.['whole_month_all_categories_total_removed_stock_cost_net'],
        wholeMonthAllCategoriesTotalRemovedStockCostTax:
          row?.['whole_month_all_categories_total_removed_stock_cost_tax'],
        ...collectPerOperationTotals(
          row,
          'wholeMonthAllCategories',
          'whole_month_all_categories',
        ),
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
  const queryFilter = createQueryFilter(filter);
  const {start, end} = resolveCustomDateRange({
    selectedMonthYearDateFilter,
    monthToDateFilter,
    dateRangeFilter,
  });

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const {selectAllQuery, countAllQuery, query} = buildItemsCustomReportSql({
      dateFilter,
      start,
      end,
      queryFilter,
      queryOrderBy,
      limit,
      offset,
    });

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    collectRows(results, items);

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
  const queryFilter = createQueryFilter(filter);
  const {start, end} = resolveCustomDateRange({
    selectedMonthYearDateFilter,
    monthToDateFilter,
    dateRangeFilter,
  });

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const {selectAllQuery, countAllQuery, query} =
      buildItemsCustomReportTotalsSql({
        dateFilter,
        start,
        end,
        queryFilter,
        limit,
        offset,
      });

    const results = await db.executeSql(selectAllQuery + query);
    await db.executeSql(countAllQuery + query);

    const row = results?.[0]?.rows?.raw()?.[0];

    collectRows(results, items);

    return {
      page: pageParam,
      totals: {
        dateFilteredAllItemsTotalAddedStockCost:
          row?.['date_filtered_all_items_total_added_stock_cost'],
        dateFilteredAllItemsTotalAddedStockCostNet:
          row?.['date_filtered_all_items_total_added_stock_cost_net'],
        dateFilteredAllItemsTotalAddedStockCostTax:
          row?.['date_filtered_all_items_total_added_stock_cost_tax'],
        dateFilteredAllItemsTotalRemovedStockCost:
          row?.['date_filtered_all_items_total_removed_stock_cost'],
        dateFilteredAllItemsTotalRemovedStockCostNet:
          row?.['date_filtered_all_items_total_removed_stock_cost_net'],
        dateFilteredAllItemsTotalRemovedStockCostTax:
          row?.['date_filtered_all_items_total_removed_stock_cost_tax'],
        dateFilteredAllItemsTotalCost:
          row?.['date_filtered_all_items_total_cost'],
        dateFilteredAllItemsTotalCostNet:
          row?.['date_filtered_all_items_total_cost_net'],
        dateFilteredAllItemsTotalCostTax:
          row?.['date_filtered_all_items_total_cost_tax'],
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
  const queryFilter = createQueryFilter(filter);
  const {start, end} = resolveCustomDateRange({
    selectedMonthYearDateFilter,
    monthToDateFilter,
    dateRangeFilter,
  });

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const {selectAllQuery, countAllQuery, query} =
      buildCategoriesCustomReportSql({
        dateFilter,
        start,
        end,
        queryFilter,
        queryOrderBy,
        limit,
        offset,
      });

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    collectRows(results, items);

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
  const queryFilter = createQueryFilter(filter);
  const {start, end} = resolveCustomDateRange({
    selectedMonthYearDateFilter,
    monthToDateFilter,
    dateRangeFilter,
  });

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const {selectAllQuery, countAllQuery, query} =
      buildCategoriesCustomReportTotalsSql({
        dateFilter,
        start,
        end,
        queryFilter,
        limit,
        offset,
      });

    const results = await db.executeSql(selectAllQuery + query);
    await db.executeSql(countAllQuery + query);

    const row = results?.[0]?.rows?.raw()?.[0];

    collectRows(results, items);

    return {
      page: pageParam,
      totals: {
        selectedMonthAllCategoriesTotalCost:
          row?.['selected_month_all_categories_total_cost'],
        selectedMonthAllCategoriesTotalCostNet:
          row?.['selected_month_all_categories_total_cost_net'],
        selectedMonthAllCategoriesTotalCostTax:
          row?.['selected_month_all_categories_total_cost_tax'],
        previousMonthAllCategoriesTotalCost:
          row?.['previous_month_all_categories_total_cost'],
        previousMonthAllCategoriesTotalCostNet:
          row?.['previous_month_all_categories_total_cost_net'],
        previousMonthAllCategoriesTotalCostTax:
          row?.['previous_month_all_categories_total_cost_tax'],
        dateFilteredAllCategoriesTotalCost:
          row?.['date_filtered_all_categories_total_cost'],
        dateFilteredAllCategoriesTotalCostNet:
          row?.['date_filtered_all_categories_total_cost_net'],
        dateFilteredAllCategoriesTotalCostTax:
          row?.['date_filtered_all_categories_total_cost_tax'],
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
  const [_key, {dateFilter}] = queryKey;

  try {
    const db = await getDBConnection();
    const {selectAllQuery, query} = buildRevenueGroupsMonthlyReportTotalsSql({
      dateFilter,
    });

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

export const getTotalItems = async () => {
  try {
    const db = await getDBConnection();

    const result = await db.executeSql(buildTotalItemsSql());
    const totalCount = result?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    return {
      result: totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get total items.');
  }
};

export const getTotalCategories = async () => {
  try {
    const db = await getDBConnection();

    const result = await db.executeSql(buildTotalCategoriesSql());
    const totalCount = result?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    return {
      result: totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get total categories.');
  }
};
