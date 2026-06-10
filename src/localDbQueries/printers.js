import {getDBConnection, getCloudSyncParams} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import getAppConfig from '../constants/appConfig';
import {getSettings} from './settings';
import uuid from 'react-native-uuid';

export const createPrinter = async ({values, onInsertLimitReached}) => {
  try {
    const db = await getDBConnection();
    const {deviceId, branchId} = await getCloudSyncParams();
    const newPrinterId = uuid.v4();
    // Auto-reconnect defaults to ON (mirrors the column's DEFAULT 1) when the
    // caller doesn't specify it; the create form passes an explicit boolean.
    const autoConnect =
      values.auto_connect === undefined || values.auto_connect === null
        ? 1
        : values.auto_connect
        ? 1
        : 0;
    const createPrinterQuery = `INSERT INTO saved_printers (
    id,
    display_name,
    device_name,
    inner_mac_address,
    auto_connect,
    device_id,
    branch_id
  )

  VALUES(
    '${newPrinterId}',
    '${values.display_name.replace(/\'/g, "''")}',
    '${values.device_name.replace(/\'/g, "''")}',
    '${values.inner_mac_address.replace(/\'/g, "''")}',
    ${autoConnect},
    ${deviceId ? `'${deviceId}'` : 'NULL'},
    ${branchId ? `'${branchId}'` : 'NULL'}
  );`;
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

    if (createPrinterResult?.[0]?.rowsAffected > 0) {
      /**
       * Set as default printer if there's no any
       */
      const defaultPrinter = await getDefaultPrinter({
        queryKey: ['defaultPrinter'],
      });

      if (!defaultPrinter?.result) {
        await setDefaultPrinter({id: newPrinterId});
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
  const query = `SELECT * FROM saved_printers WHERE id = '${id}'`;

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
  // Only touch auto_connect when the caller provided it, so callers that update
  // just the printer's name/device don't clobber the existing preference.
  const autoConnectSet =
    updatedValues.auto_connect === undefined ||
    updatedValues.auto_connect === null
      ? ''
      : `,
  auto_connect = ${updatedValues.auto_connect ? 1 : 0}`;
  const query = `UPDATE saved_printers
  SET display_name = '${updatedValues.display_name.replace(/\'/g, "''")}',
  device_name = '${updatedValues.device_name.replace(/\'/g, "''")}',
  inner_mac_address = '${updatedValues.inner_mac_address.replace(
    /\'/g,
    "''",
  )}'${autoConnectSet}
  WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update printer.');
  }
};

// Toggle just the auto-reconnect preference (used by the "Connect to default
// printer?" dialog). saved_printers is an excluded, non-sync table, so a plain
// UPDATE is correct here — no soft-delete / updated_at handling needed.
export const setPrinterAutoConnect = async ({id, autoConnect}) => {
  const query = `UPDATE saved_printers SET auto_connect = ${
    autoConnect ? 1 : 0
  } WHERE id = '${String(id).replace(/\'/g, "''")}'`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update printer auto-reconnect setting.');
  }
};

export const deletePrinter = async ({id}) => {
  const query = `DELETE FROM saved_printers WHERE id = '${id}'`;

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
  // Store the id verbatim. `saved_printers.id` is a TEXT UUID (createTables +
  // createPrinter's uuid.v4()), so the previous `parseInt(id)` corrupted it to
  // 'NaN' (or a truncated number when the UUID led with a digit). That value
  // never matched any saved_printers.id, so getDefaultPrinter's lookup found no
  // row and returned null — triggering the same `!defaultPrinter` no-op
  // described below on every context-based print.
  const query = `UPDATE settings SET value = '${String(id).replace(
    /\'/g,
    "''",
  )}' WHERE name = 'default_printer_id'`;

  try {
    // The `default_printer_id` setting lives in the COMPANY DB (it is read back
    // via getSettings/getDefaultPrinter, both on getDBConnection). Writing it to
    // the account DB here meant the company DB's row was never set, so
    // getDefaultPrinter always returned null and every context-based print
    // (Sales Register / Sales Invoice) silently no-op'd on the `!defaultPrinter`
    // guard — while the create-printer screen's own test kept working because it
    // talks to BLEPrinter directly.
    const db = await getDBConnection();
    await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to set default printer.');
  }
};
