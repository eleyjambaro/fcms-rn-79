import {
  getDBConnection,
  getCloudSyncParams,
  getActiveCompanyId,
  getActiveBranchId,
  OPERATION_DEFAULT_UUIDS,
} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {appStorageKeySeperator} from './appVersions';
import appDefaults from '../constants/appDefaults';

/**
 * Stable string codes for default inventory operations.
 * Use these constants instead of comparing against numeric operation IDs.
 */
export const OPERATION_CODES = {
  PRE_APP_STOCK: 'pre_app_stock',
  NEW_PURCHASE: 'new_purchase',
  INVENTORY_RECOUNT_IN: 'inventory_recount_in',
  STOCK_TRANSFER_IN: 'stock_transfer_in',
  INITIAL_STOCK: 'initial_stock',
  STOCK_USAGE: 'stock_usage',
  INVENTORY_RECOUNT_OUT: 'inventory_recount_out',
  STOCK_TRANSFER_OUT: 'stock_transfer_out',
  NEW_YIELD_STOCK: 'new_yield_stock',
};

export const inventoryDefaultOperations = [
  // add stock
  {
    id: 1,
    code: OPERATION_CODES.PRE_APP_STOCK,
    type: 'add_stock',
    name: `Pre-${appDefaults.appDisplayName} Stock`,
    is_app_default: 1,
    order: 0,
  },
  {
    id: 2,
    code: OPERATION_CODES.NEW_PURCHASE,
    type: 'add_stock',
    name: 'New Purchase',
    is_app_default: 1,
    order: 1,
  },
  {
    id: 3,
    code: OPERATION_CODES.INVENTORY_RECOUNT_IN,
    type: 'add_stock',
    name: 'Inventory Re-count',
    is_app_default: 1,
    order: 2,
  },
  {
    id: 4,
    code: OPERATION_CODES.STOCK_TRANSFER_IN,
    type: 'add_stock',
    name: 'Stock Transfer In',
    is_app_default: 1,
    order: 3,
  },

  // remove stock
  {
    id: 5,
    code: OPERATION_CODES.INITIAL_STOCK,
    type: 'remove_stock',
    name: 'Initial Stock',
    is_app_default: 1,
    order: 0,
  },
  {
    id: 6,
    code: OPERATION_CODES.STOCK_USAGE,
    type: 'remove_stock',
    name: 'Stock Usage',
    is_app_default: 1,
    order: 1,
  },
  {
    id: 7,
    code: OPERATION_CODES.INVENTORY_RECOUNT_OUT,
    type: 'remove_stock',
    name: 'Inventory Re-count',
    is_app_default: 1,
    order: 2,
  },
  /**
   * As of version 1.1.x
   * id 8: Spoilage ((Stock Waste/Damage)) and id 9: Missing are deprecated
   * in favor of Spoilage module
   */
  // {
  //   id: 8,
  //   type: 'remove_stock',
  //   name: 'Spoilage (Stock Waste/Damage)',
  //   is_app_default: 1,
  //   order: 3,
  // },
  // {id: 9, type: 'remove_stock', name: 'Missing', is_app_default: 1, order: 4},
  {
    id: 10,
    code: OPERATION_CODES.STOCK_TRANSFER_OUT,
    type: 'remove_stock',
    name: 'Stock Transfer Out',
    is_app_default: 1,
    order: 5,
  },
  /**
   * New Inventory Operations from v1.1.111
   */
  // add stock
  {
    id: 11,
    code: OPERATION_CODES.NEW_YIELD_STOCK,
    type: 'add_stock',
    name: 'New Yield Stock',
    is_app_default: 1,
    order: 0,
  },
];

export const createInventoryOperation = async ({operation}) => {
  try {
    const db = await getDBConnection();
    const {deviceId, branchId} = await getCloudSyncParams();
    const query = `INSERT OR IGNORE INTO operations (
    id,
    code,
    type,
    name,
    is_app_default,
    list_item_order,
    device_id,
    branch_id
  )

  VALUES(
    '${
      (operation.code && OPERATION_DEFAULT_UUIDS[operation.code]) ||
      operation.id
    }',
    ${operation.code ? `'${operation.code}'` : 'NULL'},
    '${operation.type}',
    '${operation.name}',
    ${operation.is_app_default},
    ${operation.order},
    ${deviceId ? `'${deviceId}'` : 'NULL'},
    ${branchId ? `'${branchId}'` : 'NULL'}
  );`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to register operation.');
  }
};

export const createDefaultInventoryOperations = async (version = '0.0.0') => {
  const companyId = getActiveCompanyId() ?? 'nocompany';
  const branchId = getActiveBranchId() ?? 'nobranch';
  const key = `hasDefaultInventoryOperations${appStorageKeySeperator}${version}_${companyId}_${branchId}`;

  try {
    const hasFlag = await AsyncStorage.getItem(key);

    if (hasFlag === 'true') {
      // Verify operations actually exist in DB — the flag can be set but the DB
      // emptied by a migration, reinstall, or branch switch to a fresh DB.
      const db = await getDBConnection();
      const countResult = await db.executeSql(
        `SELECT COUNT(*) as cnt FROM operations WHERE is_app_default = 1`,
      );
      const count = countResult?.[0]?.rows?.item(0)?.cnt ?? 0;
      if (count > 0) {
        return;
      }
      console.log(
        '[createDefaultInventoryOperations] flag set but DB is empty, reseeding',
      );
    }

    const results = await Promise.all(
      inventoryDefaultOperations.map(async operation => {
        return await createInventoryOperation({operation});
      }),
    );

    await AsyncStorage.setItem(key, 'true');
    console.log(
      `Default Inventory Operations (${version}) has been initialized successfully.`,
    );

    return results;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteAllOperations = async () => {
  try {
    const db = await getDBConnection();

    const query = `DELETE FROM operations`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteDefaultOperations = async () => {
  try {
    const db = await getDBConnection();

    const query = `DELETE FROM operations WHERE is_app_default = 1`;
    await db.executeSql(query);

    console.info('Default operations deleted');
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deletePreviousAppVersionDefaultOperations = async (
  currentVersion = '0.0.0',
) => {
  try {
    const db = await getDBConnection();

    const query = `DELETE FROM operations WHERE app_version != '${currentVersion}'`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const getInventoryOperations = async ({queryKey, pageParam = 1}) => {
  const [_key, params] = queryKey;
  const filter = params?.filter ? {...params.filter} : {};
  const limit = 1000000000;
  const orderBy = 'list_item_order';
  const conditions = [];

  for (const key in filter) {
    if (filter[key] !== '') {
      const value =
        typeof filter[key] === 'string' ? `'${filter[key]}'` : filter[key];
      conditions.push(`${key} = ${value}`);
    }
  }

  const queryFilter =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')} ` : '';

  try {
    const db = await getDBConnection();
    const operations = [];
    const offset = (pageParam - 1) * limit;
    const selectAllQuery = `SELECT * `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `FROM operations ${queryFilter}ORDER BY ${orderBy} ASC LIMIT ${limit} OFFSET ${offset}`;

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        operations.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: operations,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get operations.');
  }
};

export const getInventoryOperation = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM operations WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get operation.');
  }
};
