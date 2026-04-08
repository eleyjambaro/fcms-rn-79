import uuid from 'react-native-uuid';
import {getDBConnection, getCloudSyncParams} from '../localDb';
import {scheduleSyncSoon} from '../services/syncService';

export const getRecipeKinds = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = '';
  let queryFilterObj = {...filter};
  let queryFilter = '';

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
    const inventoryLogs = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM recipe_kinds
     
      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        inventoryLogs.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: inventoryLogs,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get recipe kinds.');
  }
};

export const createRecipeKind = async ({values}) => {
  try {
    const db = await getDBConnection();
    const {deviceId, branchId} = await getCloudSyncParams();
    const query = `INSERT INTO recipe_kinds (
    name,
    device_id,
    branch_id,
    sync_id,
    updated_at
  )

  VALUES(
    '${values.name}',
    ${deviceId ? `'${deviceId}'` : 'NULL'},
    ${branchId ? `'${branchId}'` : 'NULL'},
    '${uuid.v4()}',
    CURRENT_TIMESTAMP
  );`;
    const result = await db.executeSql(query);
    scheduleSyncSoon();
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create recipe kind.');
  }
};

export const getRecipeKind = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM recipe_kinds WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch recipe kind.');
  }
};

export const updateRecipeKind = async ({id, updatedValues}) => {
  const query = `UPDATE recipe_kinds
  SET name = '${updatedValues.name}',
  updated_at = CURRENT_TIMESTAMP
  WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);
    scheduleSyncSoon();
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update recipe kind.');
  }
};

export const deleteRecipeKind = async ({id}) => {
  const query = `DELETE FROM recipe_kinds WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);
    scheduleSyncSoon();
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete recipe kind.');
  }
};
