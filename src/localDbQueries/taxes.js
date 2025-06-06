import {getDBConnection} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import {appStorageKeySeperator} from './appVersions';
import getAppConfig from '../constants/appConfig';

export const defaultTaxes = [
  // vat
  {name: 'VAT', rate_percentage: 12, is_compound_tax: 0, is_app_default: 1},
];

export const createTax = async ({values, onInsertLimitReached}) => {
  const query = `INSERT INTO taxes (
    name,
    rate_percentage,
    is_compound_tax,
    is_app_default
  )
  
  VALUES(
    '${values.name.replace(/\'/g, "''")}',
    ${values.rate_percentage},
    ${parseInt(values.is_compound_tax || 0)},
    ${parseInt(values.is_app_default || 0)}

  );`;

  try {
    const db = await getDBConnection();
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

    return db.executeSql(query);
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
      FROM taxes

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
  const query = `SELECT * FROM taxes WHERE id = ${id}`;

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
  is_app_default = '${parseInt(updatedValues.is_app_default || 0)}'
  WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update tax.');
  }
};

export const deleteTax = async ({id}) => {
  const query = `DELETE FROM taxes WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete tax.');
  }
};

export const createDefaultTaxes = async (version = '0.0.0') => {
  let hasDefaultTaxes = false;
  const key = `hasDefaultTaxes${appStorageKeySeperator}${version}`;

  try {
    hasDefaultTaxes = await AsyncStorage.getItem(key);

    if (hasDefaultTaxes === 'true') {
      console.log(`Default Taxes (${version}) has been already initialized.`);
      return;
    }

    const results = await Promise.all(
      defaultTaxes.map(async values => {
        return await createTax({values});
      }),
    );

    await AsyncStorage.setItem(key, 'true');
    console.log(
      `Default Taxes (${version}) has been initialized successfully.`,
    );

    return results;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteAllTaxes = async () => {
  try {
    const db = await getDBConnection();

    const query = `DELETE FROM taxes`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteDefaultTaxes = async () => {
  try {
    const db = await getDBConnection();

    const query = `DELETE FROM taxes WHERE is_app_default = 1`;
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

    const query = `DELETE FROM taxes WHERE app_version != '${currentVersion}'`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
