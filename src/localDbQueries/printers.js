import {getDBConnection, getLocalAccountDBConnection} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import getAppConfig from '../constants/appConfig';
import {getSettings} from './settings';

export const createPrinter = async ({values, onInsertLimitReached}) => {
  const createPrinterQuery = `INSERT INTO saved_printers (
    display_name,
    device_name,
    inner_mac_address
  )
  
  VALUES(
    '${values.display_name.replace(/\'/g, "''")}',
    '${values.device_name.replace(/\'/g, "''")}',
    '${values.inner_mac_address.replace(/\'/g, "''")}'
  );`;

  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();
    const insertLimit = appConfig?.insertLimit;

    if (
      insertLimit > 0 &&
      (await isInsertLimitReached('saved_printers', insertLimit))
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit,
          message: `You can only create up to ${insertLimit} printers`,
        });
      console.debug('Failed to create printer, insert limit reached.');

      return;
    }

    const createPrinterResult = await db.executeSql(createPrinterQuery);

    const createdPrintedId = createPrinterResult?.[0]?.insertId;

    if (createdPrintedId) {
      /**
       * Set as default printer if there's no any
       */
      const defaultPrinter = await getDefaultPrinter({
        queryKey: ['defaultPrinter'],
      });

      if (!defaultPrinter?.result) {
        await setDefaultPrinter({id: createdPrintedId});
      }
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create printer.');
  }
};

export const getPrinters = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, limit = 1000000000}] = queryKey;
  const orderBy = 'display_name';
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
      FROM saved_printers

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
    throw Error('Failed to get printers.');
  }
};

export const getPrinter = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM saved_printers WHERE id = ${id}`;

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
    throw Error('Failed to fetch printer.');
  }
};

export const updatePrinter = async ({id, updatedValues}) => {
  const query = `UPDATE saved_printers
  SET display_name = '${updatedValues.display_name.replace(/\'/g, "''")}',
  device_name = '${updatedValues.device_name.replace(/\'/g, "''")}',
  inner_mac_address = '${updatedValues.inner_mac_address.replace(/\'/g, "''")}'
  WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update printer.');
  }
};

export const deletePrinter = async ({id}) => {
  const query = `DELETE FROM saved_printers WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete printer.');
  }
};

export const getDefaultPrinter = async () => {
  try {
    /**
     * Get default printer id
     */
    const getDefaultPrinterQueryData = await getSettings({
      queryKey: ['settings', {settingNames: ['default_printer_id']}],
    });

    const settings = getDefaultPrinterQueryData?.resultMap;

    if (
      !settings ||
      !settings.default_printer_id ||
      settings.default_printer_id === '0'
    ) {
      return null;
    }

    const defaultPrinter = await getPrinter({
      queryKey: ['printer', {id: settings.default_printer_id}],
    });

    return defaultPrinter;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get default printer.');
  }
};

export const setDefaultPrinter = async ({id}) => {
  const query = `UPDATE settings SET value = '${parseInt(
    id,
  )}' WHERE name = 'default_printer_id'`;

  try {
    const db = await getLocalAccountDBConnection();
    await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to set default printer.');
  }
};
