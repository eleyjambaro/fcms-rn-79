import AsyncStorage from '@react-native-async-storage/async-storage';
import {getDBConnection} from '../localDb';
import {
  createQueryFilter,
  isMutationDisabled,
} from '../utils/localDbQueryHelpers';

export const getSalesOrderGroups = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = 'sales_order_groups.order_date';
  let queryFilter = '';

  if (filter && Object.keys(filter).length > 0) {
    for (let key in filter) {
      if (filter[key] === '') {
        delete filter[key];
      }

      let value = '';
      let dateFilter = '';

      if (typeof filter[key] === 'string') {
        value = `'${filter[key]}'`;
      } else if (
        key === '__dateFilter' &&
        typeof filter[key] === 'object' &&
        Object.keys(filter[key]).length > 0
      ) {
        /**
         * Expecting object shapes:
         *
         * __dateFilter: {
         *    isDateRange: true,
         *    startDate: '2022-07-10',
         *    endDate: '09-08-22',
         *    dateFieldName: 'date_confirmed'
         * }
         */
        if (filter[key].isDateRange) {
          dateFilter = ` ${filter[key].dateFieldName} BETWEEN date('${filter[key].startDate}' AND date('${filter[key].endDate}') `;
        } else {
          /**
           * Expecting object shapes:
           *
           * __dateFilter: {
           *    isDateRange: false,
           *    date: '2022-09-08',
           *    dateFieldName: 'date_confirmed'
           * }
           */
          dateFilter = `${filter[key].dateFieldName} = date('${filter[key].date}')`;
        }
      } else {
        value = filter[key];
      }

      let expression = `${key} = ${value} `;

      if (filter[key].isDateFilter) {
        expression = dateFilter;
      }

      if (queryFilter) {
        queryFilter = queryFilter += `AND  ${expression} `;
      } else {
        queryFilter = `WHERE ${expression} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const salesInvoices = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      SUM(sales_orders.order_unit_selling_price * sales_orders.order_qty) AS order_total_amount,
      SUM(sales_orders.order_unit_selling_price * sales_orders.fulfilled_order_qty) AS fulfilled_order_total_amount,
      CASE
        WHEN SUM(sales_orders.order_unit_selling_price * sales_orders.fulfilled_order_qty) >= SUM(sales_orders.order_unit_selling_price * sales_orders.order_qty) THEN 'completed'
        ELSE 'incomplete'
        END sales_status
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM sales_order_groups
      INNER JOIN sales_orders ON sales_orders.sales_order_group_id = sales_order_groups.id

      GROUP BY sales_order_groups.id

      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        salesInvoices.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: salesInvoices,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get sales order groups.');
  }
};

export const getSalesOrderGroup = async ({queryKey}) => {
  const [_key, {id}] = queryKey;

  const query = `SELECT * FROM sales_order_groups WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch sales order group.');
  }
};

export const getSalesOrderGroupGrandTotal = async ({queryKey}) => {
  const [_key, {filter = {}, id}] = queryKey;
  let queryFilterObj = {...filter};
  let queryFilter = '';

  if (!id) return 0;

  queryFilterObj['sales_order_groups.id'] = id;

  if (queryFilterObj && Object.keys(queryFilterObj).length > 0) {
    for (let key in queryFilterObj) {
      if (queryFilterObj[key] === '') {
        delete queryFilterObj[key];
      } else {
        let value =
          typeof queryFilterObj[key] === 'string'
            ? `'${queryFilterObj[key]}'`
            : queryFilterObj[key];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const countAllQuery = `SELECT SUM(sales_orders.order_unit_selling_price * sales_orders.order_qty)`;
    const query = `
      FROM sales_order_groups
      INNER JOIN sales_orders ON sales_orders.sales_order_group_id = sales_order_groups.id

      ${queryFilter}
    ;`;

    const result = await db.executeSql(countAllQuery + query);
    const grandTotal =
      result[0].rows.raw()[0][
        'SUM(sales_orders.order_unit_selling_price * sales_orders.order_qty)'
      ];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get sales order group grand total.');
  }
};

export const getSalesOrderGroupItems = async ({queryKey, pageParam = 1}) => {
  const [_key, {salesOrderGroupId, filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = '';
  let queryFilterObj = {...filter};
  let queryFilter = '';

  queryFilterObj['sales_order_group_id'] = salesOrderGroupId;

  if (queryFilterObj && Object.keys(queryFilterObj).length > 0) {
    for (let key in queryFilterObj) {
      if (queryFilterObj[key] === '') {
        delete queryFilterObj[key];
      } else {
        let value =
          typeof queryFilterObj[key] === 'string'
            ? `'${queryFilterObj[key]}'`
            : queryFilterObj[key];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const salesOrderGroupItems = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      /* modifier_options table with modifier fields */
      WITH cte_item_modifier_options AS (
        SELECT * FROM modifier_options
        JOIN modifiers ON modifiers.id = modifier_options.modifier_id
      )

      SELECT *,
      (
        SELECT COUNT(*)
        FROM cte_item_modifier_options cte_imo
        WHERE cte_imo.item_id = items.id
      ) AS item_modifier_options_count,
      sales_orders.id AS order_id,
      sales_orders.order_unit_selling_price AS order_unit_selling_price,
      sales_orders.order_qty AS order_qty,
      sales_orders.order_unit_selling_price * sales_orders.order_qty AS subtotal_amount,
      sales_orders.meta_use_measurement_per_piece AS use_measurement_per_piece,
      inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty AS current_stock_qty
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM sales_orders
      INNER JOIN items ON items.id = sales_orders.item_id

      LEFT JOIN (
        SELECT inventory_logs_added_and_removed.item_id AS item_id,
        inventory_logs_added_and_removed.item_name AS item_name,
        inventory_logs_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_added_stock_qty,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_added_stock_cost,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost_net END), 0) AS total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost_net END), 0) AS total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost_tax END), 0) AS total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost_tax END), 0) AS total_removed_stock_cost_tax
        FROM (
          SELECT SUM(inventory_logs.adjustment_qty) AS total_stock_qty,
          SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty) AS total_stock_cost,
          SUM(inventory_logs.adjustment_unit_cost_net * inventory_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(inventory_logs.adjustment_unit_cost_tax * inventory_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM inventory_logs
          LEFT JOIN items ON items.id = inventory_logs.item_id
          LEFT JOIN operations ON operations.id = inventory_logs.operation_id
          WHERE inventory_logs.voided != 1
          GROUP BY inventory_logs.item_id, operations.type
        ) AS inventory_logs_added_and_removed
        LEFT JOIN items ON items.id = inventory_logs_added_and_removed.item_id
        GROUP BY inventory_logs_added_and_removed.item_id
      ) AS inventory_logs_added_and_removed_totals
      ON inventory_logs_added_and_removed_totals.item_id = sales_orders.item_id

      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        salesOrderGroupItems.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: salesOrderGroupItems,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get sales order group items.');
  }
};
