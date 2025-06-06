import {getDBConnection} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import getAppConfig from '../constants/appConfig';

export const defaultTaxes = [
  // vat
  {name: 'VAT', rate_percentage: 12, is_compound_tax: 0},
];

export const createVendor = async ({values, onInsertLimitReached}) => {
  const query = `INSERT INTO vendors (
    first_name,
    last_name,
    company_name,
    vendor_display_name,
    tin,
    email,
    phone_number,
    mobile_number,
    remarks
  )
  
  VALUES(
    '${values.first_name.replace(/\'/g, "''")}',
    '${values.last_name.replace(/\'/g, "''")}',
    '${values.company_name.replace(/\'/g, "''")}',
    '${values.vendor_display_name.replace(/\'/g, "''")}',
    '${values.tin}',
    '${values.email}',
    '${values.phone_number}',
    '${values.mobile_number}',
    '${values.remarks ? values.remarks?.replace(/\'/g, "''") : ''}'
  );`;

  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();
    const insertLimit = appConfig?.insertLimit;

    if (
      insertLimit > 0 &&
      (await isInsertLimitReached('vendors', insertLimit))
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit,
          message: `You can only create up to ${insertLimit} vendors`,
        });
      console.debug('Failed to create vendor, insert limit reached.');

      return;
    }

    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create vendor.');
  }
};

export const getVendors = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, limit = 1000000000}] = queryKey;
  const orderBy = 'vendor_display_name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const vendors = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectQuery = `
      SELECT *
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM vendors

      ${queryFilter}

      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    `;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        vendors.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: vendors,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get vendors.');
  }
};

export const getVendor = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM vendors WHERE id = ${id}`;

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
    throw Error('Failed to fetch vendor.');
  }
};

export const updateVendor = async ({id, updatedValues}) => {
  const query = `UPDATE vendors
  SET first_name = '${updatedValues.first_name.replace(/\'/g, "''")}',
  last_name = '${updatedValues.last_name.replace(/\'/g, "''")}',
  company_name = '${updatedValues.company_name.replace(/\'/g, "''")}',
  vendor_display_name = '${updatedValues.vendor_display_name.replace(
    /\'/g,
    "''",
  )}',
  email = '${updatedValues.email}',
  phone_number = '${updatedValues.phone_number}',
  mobile_number = '${updatedValues.mobile_number}',
  remarks = '${
    updatedValues.remarks ? updatedValues.remarks.replace(/\'/g, "''") : ''
  }'
  WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update vendor.');
  }
};

export const deleteVendor = async ({id}) => {
  const query = `DELETE FROM vendors WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete vendor.');
  }
};

export const createDefaultTaxes = async () => {
  let hasDefaultTaxes = false;
  try {
    hasDefaultTaxes = await AsyncStorage.getItem('hasDefaultTaxes');

    if (hasDefaultTaxes === 'true') {
      console.log('Default Taxes has been already initialized.');
      return;
    }

    const results = await Promise.all(
      defaultTaxes.map(async values => {
        return await createTax({values});
      }),
    );

    await AsyncStorage.setItem('hasDefaultTaxes', 'true');
    console.log('Default Taxes has been initialized successfully.');

    return results;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
