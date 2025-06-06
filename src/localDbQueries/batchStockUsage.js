import AsyncStorage from '@react-native-async-storage/async-storage';
import {getDBConnection} from '../localDb';
import {createQueryFilter} from '../utils/localDbQueryHelpers';

export const getItemsAndBatchStockUsageEntries = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = 'categories.name, items.name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();

    const stockUsageEntries = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectQuery = `
      SELECT
      items.id,
      items.category_id AS item_category_id,
      items.name AS name,
      items.barcode AS barcode,
      items.uom_abbrev AS uom_abbrev,
      items.unit_cost AS unit_cost,
      items.initial_stock_qty AS initial_stock_qty,
      items.low_stock_level AS low_stock_level,

      inventory_logs_added_and_removed_totals.total_added_stock_qty AS total_added_stock_qty,
      inventory_logs_added_and_removed_totals.total_removed_stock_qty AS total_removed_stock_qty,
      inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty AS current_stock_qty,
      inventory_logs_added_and_removed_totals.total_added_stock_cost AS total_added_stock_cost,
      inventory_logs_added_and_removed_totals.total_removed_stock_cost AS total_removed_stock_cost,
      inventory_logs_added_and_removed_totals.total_added_stock_cost - inventory_logs_added_and_removed_totals.total_removed_stock_cost AS current_stock_cost,

      batch_stock_usage_entries.remove_stock_qty AS remove_stock_qty,
      batch_stock_usage_entries.remove_stock_unit_cost AS remove_stock_unit_cost,
      batch_stock_usage_entries.remove_stock_unit_cost * batch_stock_usage_entries.remove_stock_qty AS total_cost,

      batch_stock_usage_groups.id AS batch_stock_usage_group_id,
      batch_stock_usage_groups.confirmed AS confirmed
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM items
      LEFT JOIN (
        SELECT inventory_logs_added_and_removed.item_id AS item_id,
        inventory_logs_added_and_removed.item_name AS item_name,
        inventory_logs_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_added_stock_qty,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_added_stock_cost,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_removed_stock_cost
        FROM (
          SELECT SUM(inventory_logs.adjustment_qty) AS total_stock_qty,
          SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty) AS total_stock_cost,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM inventory_logs
          LEFT JOIN items ON items.id = inventory_logs.item_id
          LEFT JOIN operations ON operations.id = inventory_logs.operation_id
          GROUP BY inventory_logs.item_id, operations.type
        ) AS inventory_logs_added_and_removed
        LEFT JOIN items ON items.id = inventory_logs_added_and_removed.item_id
        GROUP BY inventory_logs_added_and_removed.item_id
      ) AS inventory_logs_added_and_removed_totals
      ON inventory_logs_added_and_removed_totals.item_id = items.id

      LEFT JOIN batch_stock_usage_entries ON batch_stock_usage_entries.item_id = items.id
      LEFT JOIN batch_stock_usage_groups ON batch_stock_usage_groups.id = batch_stock_usage_entries.batch_stock_usage_group_id
      LEFT JOIN categories ON categories.id = items.category_id 
      
      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        stockUsageEntries.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: stockUsageEntries,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get stock usage entries.');
  }
};

export const getBatchStockUsageEntries = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = '';
  let queryFilterObj = {...filter};
  let queryFilter = '';

  try {
    let currentBatchStockUsageGroupId = await AsyncStorage.getItem(
      'currentBatchStockUsageGroupId',
    );

    if (!currentBatchStockUsageGroupId) {
      throw new Error('No current batch stock usage group found');
    }

    queryFilterObj['batch_stock_usage_entries.batch_stock_usage_group_id'] =
      currentBatchStockUsageGroupId;

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

    const db = await getDBConnection();
    const stockUsageEntries = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT
      items.id,
      items.category_id AS item_category_id,
      items.name AS name,
      items.barcode AS barcode,
      items.uom_abbrev AS uom_abbrev,
      items.unit_cost AS unit_cost,
      items.initial_stock_qty AS initial_stock_qty,
      items.current_stock_qty AS current_stock_qty,
      items.low_stock_level AS low_stock_level,

      batch_stock_usage_entries.remove_stock_qty AS remove_stock_qty,
      batch_stock_usage_entries.remove_stock_unit_cost AS remove_stock_unit_cost,
      batch_stock_usage_entries.remove_stock_unit_cost * batch_stock_usage_entries.remove_stock_qty AS total_cost
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM items
      INNER JOIN batch_stock_usage_entries ON batch_stock_usage_entries.item_id = items.id

      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        stockUsageEntries.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: stockUsageEntries,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get stock usage entries.');
  }
};

export const getBatchStockUsageEntriesCount = async ({queryKey}) => {
  const [_key, {filter = {}}] = queryKey;
  let queryFilterObj = {...filter};
  let queryFilter = '';

  try {
    let currentBatchStockUsageGroupId = await AsyncStorage.getItem(
      'currentBatchStockUsageGroupId',
    );

    if (!currentBatchStockUsageGroupId) {
      return 0;
    }

    queryFilterObj['batch_stock_usage_entries.batch_stock_usage_group_id'] =
      currentBatchStockUsageGroupId;

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

    const db = await getDBConnection();
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM items
      INNER JOIN batch_stock_usage_entries ON batch_stock_usage_entries.item_id = items.id

      ${queryFilter}
    ;`;
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    return totalCount;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get stock usage entries count.');
  }
};

export const getBatchStockUsageEntriesGrandTotal = async ({queryKey}) => {
  const [_key, {filter = {}}] = queryKey;
  let queryFilter = '';

  try {
    let currentBatchStockUsageGroupId = await AsyncStorage.getItem(
      'currentBatchStockUsageGroupId',
    );

    if (!currentBatchStockUsageGroupId) {
      return 0;
    }

    queryFilter = createQueryFilter(filter, {
      'batch_stock_usage_entries.batch_stock_usage_group_id':
        currentBatchStockUsageGroupId,
    });

    const db = await getDBConnection();
    const countAllQuery = `SELECT SUM(batch_stock_usage_entries.remove_stock_unit_cost * batch_stock_usage_entries.remove_stock_qty)`;
    const query = `
      FROM items
      INNER JOIN batch_stock_usage_entries ON batch_stock_usage_entries.item_id = items.id

      ${queryFilter}
    ;`;
    const result = await db.executeSql(countAllQuery + query);
    const grandTotal =
      result[0].rows.raw()[0][
        'SUM(batch_stock_usage_entries.remove_stock_unit_cost * batch_stock_usage_entries.remove_stock_qty)'
      ];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get stock usage entries grand total.');
  }
};

export const createBatchStockUsageEntry = async ({values}) => {
  const createBatchStockUsageGroupQuery = `INSERT INTO batch_stock_usage_groups DEFAULT VALUES;`;

  try {
    const db = await getDBConnection();

    // check if there's an existing unconfirmed Batch Stock Usage Group
    // before creating new one
    let currentBatchStockUsageGroupId = await AsyncStorage.getItem(
      'currentBatchStockUsageGroupId',
    );

    if (!currentBatchStockUsageGroupId) {
      // create new Batch Stock Usage Group
      const createBatchStockUsageGroupResult = await db.executeSql(
        createBatchStockUsageGroupQuery,
      );

      if (createBatchStockUsageGroupResult[0].rowsAffected > 0) {
        await AsyncStorage.setItem(
          'currentBatchStockUsageGroupId',
          createBatchStockUsageGroupResult[0].insertId?.toString(),
        );

        currentBatchStockUsageGroupId =
          createBatchStockUsageGroupResult[0].insertId;
      } else {
        throw Error('Failed to create new batch stock usage group');
      }
    }

    const getBatchStockUsageEntryQuery = `SELECT * FROM batch_stock_usage_entries WHERE item_id = ${values.item_id} AND batch_stock_usage_group_id = ${currentBatchStockUsageGroupId};`;
    const createBatchStockUsageEntryQuery = `INSERT INTO batch_stock_usage_entries (
      batch_stock_usage_group_id,
      item_id,
      remove_stock_qty,
      remove_stock_unit_cost
    )
    
    VALUES(
      ${parseInt(currentBatchStockUsageGroupId)},
      ${parseInt(values.item_id)},
      ${parseFloat(values.remove_stock_qty)},
      ${parseFloat(values.remove_stock_unit_cost)}
    );`;

    const updateBatchStockUsageEntryQuery = `UPDATE batch_stock_usage_entries
      SET remove_stock_qty = ${parseFloat(values.remove_stock_qty)},
      remove_stock_unit_cost = ${parseFloat(values.remove_stock_unit_cost)}
      WHERE item_id = ${values.item_id}
      AND batch_stock_usage_group_id = ${currentBatchStockUsageGroupId}
    `;

    // check if there's an existing Batch Stock Usage Entry within the current Batch Stock Usage Group
    // before creating new one
    const getBatchStockUsageEntryResult = await db.executeSql(
      getBatchStockUsageEntryQuery,
    );
    let batchStockUsageEntry = getBatchStockUsageEntryResult[0].rows.item(0);

    if (!batchStockUsageEntry) {
      // create new Batch Stock Usage Entry
      const createBatchStockUsageEntryResult = await db.executeSql(
        createBatchStockUsageEntryQuery,
      );
      batchStockUsageEntry = createBatchStockUsageEntryResult[0].rows.item(0);
    } else {
      // update existing Batch Stock Usage Entry within the current Batch Stock Usage Group
      const updateBatchStockUsageEntryResult = await db.executeSql(
        updateBatchStockUsageEntryQuery,
      );
      batchStockUsageEntry = updateBatchStockUsageEntryResult[0].rows.item(0);
    }

    return batchStockUsageEntry;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create batch stock usage entry.');
  }
};

export const hasCurrentBatchStockUsageGroup = async () => {
  try {
    const currentBatchStockUsageGroupId = await AsyncStorage.getItem(
      'currentBatchStockUsageGroupId',
    );
    return currentBatchStockUsageGroupId ? true : false;
  } catch (error) {
    console.debug(error);
    throw Error('Failed while checking current batch stock usage group.');
  }
};

export const confirmBatchStockUsageEntries = async ({usageDate}) => {
  const dateConfirmed = usageDate
    ? `datetime('${usageDate}')`
    : `datetime('now')`;

  try {
    const db = await getDBConnection();

    // check if there's an existing unconfirmed Batch Stock Usage Group
    let currentBatchStockUsageGroupId = await AsyncStorage.getItem(
      'currentBatchStockUsageGroupId',
    );

    if (!currentBatchStockUsageGroupId) {
      throw Error('No current batch stock usage group found');
    }

    const batchStockUsageEntries = [];

    // get all batch stock usage entries
    const getAllCurrentBatchStockUsageEntriesQuery = `
      SELECT *,
      items.id AS id,
      items.current_stock_qty - batch_stock_usage_entries.remove_stock_qty AS updated_current_stock,
      taxes.id AS item_tax_id,
      taxes.name AS item_tax_name,
      taxes.rate_percentage AS item_tax_rate_percentage
      FROM batch_stock_usage_entries
      INNER JOIN items ON items.id = batch_stock_usage_entries.item_id
      LEFT JOIN taxes ON taxes.id = items.tax_id
      WHERE batch_stock_usage_group_id = ${currentBatchStockUsageGroupId};
    `;

    const getAllCurrentBatchStockUsageEntriesResults = await db.executeSql(
      getAllCurrentBatchStockUsageEntriesQuery,
    );

    // insert each batch stock usage entries to Inventory logs
    let insertInventoryLogsQuery = `
      INSERT INTO inventory_logs (
        operation_id,
        item_id,
        adjustment_unit_cost,
        adjustment_unit_cost_net,
        adjustment_unit_cost_tax,
        adjustment_tax_rate_percentage,
        adjustment_tax_name,
        adjustment_qty,
        adjustment_date,
        batch_stock_usage_group_id
      )
      
      VALUES
    `;

    let tmpValues = `VALUES `;

    getAllCurrentBatchStockUsageEntriesResults.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        let batchStockUsageEntry = result.rows.item(index);
        batchStockUsageEntries.push(batchStockUsageEntry);

        const unitCost = parseFloat(
          batchStockUsageEntry.remove_stock_unit_cost || 0,
        );
        const qty = parseFloat(batchStockUsageEntry.remove_stock_qty || 0);
        const taxRatePercentage = parseFloat(
          batchStockUsageEntry.item_tax_rate_percentage || 0,
        );

        const unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
        const unitCostTax = unitCost - unitCostNet;
        const taxName = batchStockUsageEntry.item_tax_name
          ? `'${batchStockUsageEntry.item_tax_name}'`
          : 'null';

        // operation_id 6 is equal to Stock Usage Entry
        insertInventoryLogsQuery += `(
          6,
          ${batchStockUsageEntry.item_id},
          ${unitCost},
          ${unitCostNet},
          ${unitCostTax},
          ${taxRatePercentage},
          ${taxName},
          ${qty},
          ${dateConfirmed},
          ${parseInt(currentBatchStockUsageGroupId)}
        )`;

        if (result.rows.length - 1 !== index) {
          insertInventoryLogsQuery += `,
            `;
        } else {
          insertInventoryLogsQuery += ';';
        }

        // tmp values
        tmpValues += `(
          ${batchStockUsageEntry.item_id},
          ${batchStockUsageEntry.updated_current_stock}
        )`;

        if (result.rows.length - 1 !== index) {
          tmpValues += `,
            `;
        }
      }
    });

    await db.executeSql(insertInventoryLogsQuery);

    // update each item's current stock quantity
    const updateItemsCurrentStockQuery = `
      WITH tmp(item_id, updated_current_stock) AS (${tmpValues})

      UPDATE items SET current_stock_qty = (SELECT updated_current_stock FROM tmp WHERE items.id = tmp.item_id)

      WHERE id IN (SELECT item_id FROM tmp)
    `;

    const updateItemsCurrentStockResult = await db.executeSql(
      updateItemsCurrentStockQuery,
    );

    // delete each batch stock usage entries
    const deleteBatchStockUsageEntriesQuery = `DELETE FROM batch_stock_usage_entries
      WHERE batch_stock_usage_group_id = ${currentBatchStockUsageGroupId}
    ;`;
    const deleteBatchStockUsageEntriesResult = await db.executeSql(
      deleteBatchStockUsageEntriesQuery,
    );

    if (deleteBatchStockUsageEntriesResult[0].rowsAffected === 0) {
      throw Error('Failed to delete batch stock usage entries');
    }

    // update current Batch Stock Group
    const updateBatchStockUsageGroupQuery = `UPDATE batch_stock_usage_groups
      SET confirmed = 1,
      date_confirmed = ${dateConfirmed}
      WHERE id = ${currentBatchStockUsageGroupId}
    `;

    const updateBatchStockUsageGroupResult = await db.executeSql(
      updateBatchStockUsageGroupQuery,
    );

    if (updateBatchStockUsageGroupResult[0].rowsAffected === 0) {
      throw Error(
        'Failed to confirm batch stock usage entries while updating current batch stock usage group',
      );
    }

    // remove current Batch Stock Usage Group ID from storage
    await AsyncStorage.removeItem('currentBatchStockUsageGroupId');

    return {
      batchStockUsageGroupId: currentBatchStockUsageGroupId,
      batchStockUsageEntries,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to confirm batch stock usage entries.');
  }
};

export const getBatchStockUsageGroups = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = 'date_confirmed';
  let queryFilter = '';

  if (filter && Object.keys(filter).length > 0) {
    for (let key in filter) {
      if (filter[key] === '') {
        delete filter[key];
      } else {
        let value =
          typeof filter[key] === 'string' ? `'${filter[key]}'` : filter[key];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const batchStockUsageGroups = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT
      batch_stock_usage_groups.id,
      date_created,
      date_confirmed,
      SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty) AS total_cost
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM batch_stock_usage_groups
      INNER JOIN inventory_logs ON inventory_logs.batch_stock_usage_group_id = batch_stock_usage_groups.id

      GROUP BY batch_stock_usage_groups.id

      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        batchStockUsageGroups.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: batchStockUsageGroups,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get batch stock usages.');
  }
};

export const getBatchStockUsageGroupGrandTotal = async ({queryKey}) => {
  const [_key, {filter = {}, id}] = queryKey;
  let queryFilterObj = {...filter};
  let queryFilter = '';

  if (!id) return 0;

  queryFilterObj['batch_stock_usage_groups.id'] = id;

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
    const countAllQuery = `SELECT SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty)`;
    const query = `
      FROM batch_stock_usage_groups
      INNER JOIN inventory_logs ON inventory_logs.batch_stock_usage_group_id = batch_stock_usage_groups.id

      ${queryFilter}
    ;`;

    const result = await db.executeSql(countAllQuery + query);
    const grandTotal =
      result[0].rows.raw()[0][
        'SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty)'
      ];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get batch stock usage grand total.');
  }
};

export const getBatchStockUsageGroup = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM batch_stock_usage_groups WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch batch stock usage group.');
  }
};

export const getBatchStockUsageGroupItems = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key, {batchStockUsageGroupId, filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = '';
  let queryFilterObj = {...filter};
  let queryFilter = '';

  queryFilterObj['batch_stock_usage_group_id'] = batchStockUsageGroupId;

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
    const batchStockUsageGroupItems = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      inventory_logs.adjustment_unit_cost AS remove_stock_unit_cost,
      inventory_logs.adjustment_qty AS remove_stock_qty,
      inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty AS total_cost
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM inventory_logs
      INNER JOIN items ON items.id = inventory_logs.item_id

      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        batchStockUsageGroupItems.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: batchStockUsageGroupItems,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get batch stock usage group items.');
  }
};
