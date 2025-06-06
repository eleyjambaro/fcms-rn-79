import {getDBConnection} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {appStorageKeySeperator} from './appVersions';

export const inventoryDefaultOperations = [
  // add stock
  {
    id: 1,
    type: 'add_stock',
    name: 'Initial Stock',
    is_app_default: 1,
    order: 0,
  },
  {
    id: 2,
    type: 'add_stock',
    name: 'New Purchase',
    is_app_default: 1,
    order: 1,
  },
  {
    id: 3,
    type: 'add_stock',
    name: 'Inventory Re-count',
    is_app_default: 1,
    order: 2,
  },
  {
    id: 4,
    type: 'add_stock',
    name: 'Stock Transfer In',
    is_app_default: 1,
    order: 3,
  },

  // remove stock
  {
    id: 5,
    type: 'remove_stock',
    name: 'Initial Stock',
    is_app_default: 1,
    order: 0,
  },
  {
    id: 6,
    type: 'remove_stock',
    name: 'Stock Usage',
    is_app_default: 1,
    order: 1,
  },
  {
    id: 7,
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
    type: 'add_stock',
    name: 'New Yield Stock',
    is_app_default: 1,
    order: 0,
  },
];

export const createInventoryOperation = async ({operation}) => {
  const query = `INSERT INTO operations (
    id,
    type,
    name,
    is_app_default,
    list_item_order
  )
  
  VALUES(
    ${operation.id},
    '${operation.type}',
    '${operation.name}',
    ${operation.is_app_default},
    ${operation.order}
  );`;

  try {
    const db = await getDBConnection();
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to register operation.');
  }
};

export const createDefaultInventoryOperations = async (version = '0.0.0') => {
  let hasDefaultInventoryOperations = false;
  const key = `hasDefaultInventoryOperations${appStorageKeySeperator}${version}`;

  try {
    hasDefaultInventoryOperations = await AsyncStorage.getItem(key);

    if (hasDefaultInventoryOperations === 'true') {
      console.log(
        `Default Inventory Operations (${version}) has been already initialized.`,
      );
      return;
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
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = 'type';
  let queryFilter = '';

  if (filter && Object.keys(filter).length > 0) {
    for (let key in filter) {
      if (filter[key] === '') {
        delete filter[key];
      } else {
        let value =
          typeof filter[key] === 'string' ? `'${filter[key]}'` : filter[key];
        queryFilter += `WHERE ${key} = ${value}; `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const operations = [];
    const offset = (pageParam - 1) * limit;
    const selectAllQuery = `SELECT * `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `FROM operations ${queryFilter} ORDER BY ${orderBy} ASC LIMIT ${limit} OFFSET ${offset}`;

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
  const query = `SELECT * FROM operations WHERE id = ${id}`;

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
