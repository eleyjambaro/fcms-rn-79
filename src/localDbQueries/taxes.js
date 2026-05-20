import {getDBConnection, getCloudSyncParams} from '../localDb';
import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import getAppConfig from '../constants/appConfig';
import uuid from 'react-native-uuid';

export const defaultTaxes = [
  // vat
  {name: 'VAT', rate_percentage: 12, is_compound_tax: 0, is_app_default: 1},
];

export const createTax = async ({values, onInsertLimitReached}) => {
  try {
    const db = await getDBConnection();
    const {deviceId, branchId} = await getCloudSyncParams();
    const newId = uuid.v4();
    const newSyncId = uuid.v4();
    const query = `INSERT INTO taxes (
    id,
    name,
    rate_percentage,
    is_compound_tax,
    is_app_default,
    device_id,
    branch_id,
    sync_id,
    updated_at
  )

  VALUES(
    '${newId}',
    '${values.name.replace(/\'/g, "''")}',
    ${values.rate_percentage},
    ${parseInt(values.is_compound_tax || 0)},
    ${parseInt(values.is_app_default || 0)},
    ${deviceId ? `'${deviceId}'` : 'NULL'},
    ${branchId ? `'${branchId}'` : 'NULL'},
    '${newSyncId}',
    CURRENT_TIMESTAMP
  );`;
    const appConfig = await getAppConfig();
    const insertLimit = appConfig?.insertLimit;

    if (insertLimit > 0 && (await isInsertLimitReached('taxes', insertLimit))) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit,
          message: `You can only create up to ${insertLimit} taxes`,
        });
      console.debug('Failed to create tax, insert limit reached.');

      return;
    }

    const result = await db.executeSql(query);
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create tax.');
  }
};

export const getTaxes = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, limit = 1000000000}] = queryKey;
  const orderBy = 'name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const taxes = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectQuery = `
      SELECT *
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM active_taxes taxes

      ${queryFilter}

      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    `;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        taxes.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: taxes,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get taxes.');
  }
};

export const getTax = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM active_taxes taxes WHERE taxes.id = '${id}'`;

  if (!id) {
    return {
      result: null,
    };
  }

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch tax.');
  }
};

export const updateTax = async ({id, updatedValues}) => {
  const query = `UPDATE taxes
  SET name = '${updatedValues.name.replace(/\'/g, "''")}',
  rate_percentage = '${parseFloat(updatedValues.rate_percentage || 0)}',
  is_app_default = '${parseInt(updatedValues.is_app_default || 0)}',
  updated_at = CURRENT_TIMESTAMP
  WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update tax.');
  }
};

export const deleteTax = async ({id}) => {
  const query = `UPDATE taxes SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete tax.');
  }
};

export const createDefaultTaxes = async () => {
  try {
    const db = await getDBConnection();
    const results = await db.executeSql(
      `SELECT COUNT(*) as count FROM active_taxes`,
    );
    const count = results[0]?.rows?.item(0)?.count ?? 0;

    if (count > 0) {
      return;
    }

    return await Promise.all(defaultTaxes.map(values => createTax({values})));
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteAllTaxes = async () => {
  try {
    const db = await getDBConnection();

    const query = `UPDATE taxes SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteDefaultTaxes = async () => {
  try {
    const db = await getDBConnection();

    const query = `UPDATE taxes SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE is_app_default = 1`;
    await db.executeSql(query);

    console.info('Default taxes deleted');
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deletePreviousAppVersionDefaultTaxes = async (
  currentVersion = '0.0.0',
) => {
  try {
    const db = await getDBConnection();

    const query = `UPDATE taxes SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE app_version != '${currentVersion}'`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
