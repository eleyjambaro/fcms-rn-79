import AsyncStorage from '@react-native-async-storage/async-storage';
import {getDBConnection} from '../localDb';
import {
  createQueryFilter,
  isMutationDisabled,
} from '../utils/localDbQueryHelpers';

export const getSalesInvoices = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = 'invoices.invoice_date';
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
      (
        SELECT COUNT(*) FROM payments WHERE payments.invoice_id = invoices.id
      ) AS payment_method_count,
      (
        SELECT SUM(IFNULL(payments.payment_amount, 0)) FROM payments WHERE payments.invoice_id = invoices.id AND payments.payment_method = 'cash'
      ) AS cash_payment_total_amount,
      (
        SELECT SUM(IFNULL(payments.payment_amount, 0)) FROM payments WHERE payments.invoice_id = invoices.id AND payments.payment_method = 'card'
      ) AS card_payment_total_amount,
      SUM(sale_logs.sale_unit_selling_price * sale_logs.sale_qty) AS total_amount
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM invoices
      INNER JOIN sale_logs ON sale_logs.invoice_id = invoices.id

      GROUP BY invoices.id

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
    throw Error('Failed to get sales invoices.');
  }
};

export const getSalesInvoice = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM invoices WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch sales invoice.');
  }
};

export const getSalesInvoiceGrandTotal = async ({queryKey}) => {
  const [_key, {filter = {}, id}] = queryKey;
  let queryFilterObj = {...filter};
  let queryFilter = '';

  if (!id) return 0;

  queryFilterObj['invoices.id'] = id;

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
    const countAllQuery = `SELECT SUM(sale_logs.sale_unit_selling_price * sale_logs.sale_qty)`;
    const query = `
      FROM invoices
      INNER JOIN sale_logs ON sale_logs.invoice_id = invoices.id

      ${queryFilter}
    ;`;

    const result = await db.executeSql(countAllQuery + query);
    const grandTotal =
      result[0].rows.raw()[0][
        'SUM(sale_logs.sale_unit_selling_price * sale_logs.sale_qty)'
      ];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get sales invoice grand total.');
  }
};

export const getSalesInvoiceItems = async ({queryKey, pageParam = 1}) => {
  const [_key, {invoiceId, filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = '';
  let queryFilterObj = {...filter};
  let queryFilter = '';

  queryFilterObj['invoice_id'] = invoiceId;

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
    const salesInvoiceItems = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      sale_logs.id AS id,
      sale_logs.sale_unit_selling_price AS sale_unit_selling_price,
      sale_logs.sale_qty AS sale_qty,
      sale_logs.sale_unit_selling_price * sale_logs.sale_qty AS subtotal_amount
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM sale_logs
      INNER JOIN items ON items.id = sale_logs.item_id

      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        salesInvoiceItems.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: salesInvoiceItems,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get sales invoice items.');
  }
};
