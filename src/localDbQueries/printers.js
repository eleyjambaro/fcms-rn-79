import {getDBConnection, getCloudSyncParams} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import getAppConfig from '../constants/appConfig';
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
    // saved_printers is a delta-sync table: id is TEXT === sync_id, and
    // updated_at is stamped (UTC, matching the sync watermark format) so the new
    // printer pushes on the next sync.
    const createPrinterQuery = `INSERT INTO saved_printers (
    id,
    sync_id,
    display_name,
    device_name,
    inner_mac_address,
    auto_connect,
    device_id,
    branch_id,
    updated_at,
    is_deleted
  )

  VALUES(
    '${newPrinterId}',
    '${newPrinterId}',
    '${values.display_name.replace(/\'/g, "''")}',
    '${values.device_name.replace(/\'/g, "''")}',
    '${values.inner_mac_address.replace(/\'/g, "''")}',
    ${autoConnect},
    ${deviceId ? `'${deviceId}'` : 'NULL'},
    ${branchId ? `'${branchId}'` : 'NULL'},
    CURRENT_TIMESTAMP,
    0
  );`;
    const appConfig = await getAppConfig();
    const insertLimit = appConfig?.insertLimit;

    // Limit is per-device and excludes soft-deleted rows — count via the active
    // view filtered to this device (printers are device-private).
    if (
      insertLimit > 0 &&
      (await isInsertLimitReached('active_saved_printers', insertLimit, {
        device_id: deviceId,
      }))
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

  try {
    const db = await getDBConnection();
    // Printers are device-private: read from the NULL-safe active view and scope
    // to this device so other tablets' printers never appear here.
    const {deviceId} = await getCloudSyncParams();
    let queryFilter = createQueryFilter(filter, {device_id: deviceId ?? ''});
    const vendors = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectQuery = `
      SELECT *
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM active_saved_printers

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
  const query = `SELECT * FROM active_saved_printers WHERE id = '${id}'`;

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
  )}'${autoConnectSet},
  updated_at = CURRENT_TIMESTAMP
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
// printer?" dialog). saved_printers is now a delta-sync table, so bump
// updated_at too — the preference is per-device but still pushed so it restores
// after a reinstall on the same device.
export const setPrinterAutoConnect = async ({id, autoConnect}) => {
  const query = `UPDATE saved_printers SET auto_connect = ${
    autoConnect ? 1 : 0
  }, updated_at = CURRENT_TIMESTAMP WHERE id = '${String(id).replace(
    /\'/g,
    "''",
  )}'`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update printer auto-reconnect setting.');
  }
};

export const deletePrinter = async ({id}) => {
  // Soft-delete: saved_printers is a delta-sync table (Invariant 4 — never
  // DELETE FROM). Bump updated_at so the tombstone propagates on the next push.
  const query = `UPDATE saved_printers SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete printer.');
  }
};

export const getDefaultPrinter = async () => {
  // The default printer is now a per-device flag on the printer row itself
  // (saved_printers.is_default), not the old company-wide default_printer_id
  // setting. This keeps the default device-private (a tablet can't default to a
  // Bluetooth printer it can't reach) and lets it restore after a reinstall on
  // the same device via the normal printer sync.
  try {
    const db = await getDBConnection();
    const {deviceId} = await getCloudSyncParams();
    const result = await db.executeSql(
      `SELECT * FROM active_saved_printers
       WHERE IFNULL(is_default, 0) = 1 AND device_id ${
         deviceId ? `= '${String(deviceId).replace(/\'/g, "''")}'` : 'IS NULL'
       }
       LIMIT 1`,
    );

    return {
      result: result[0].rows.item(0) ?? null,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get default printer.');
  }
};

export const setDefaultPrinter = async ({id}) => {
  // Flip is_default on this device's printers: set the chosen row to 1 and all
  // of this device's other rows to 0, bumping updated_at so the change pushes.
  // Scoped to device_id so it never touches another device's default.
  try {
    const db = await getDBConnection();
    const {deviceId} = await getCloudSyncParams();
    const safeId = String(id).replace(/\'/g, "''");
    const deviceClause = deviceId
      ? `device_id = '${String(deviceId).replace(/\'/g, "''")}'`
      : 'device_id IS NULL';

    const query = `UPDATE saved_printers
      SET is_default = CASE WHEN id = '${safeId}' THEN 1 ELSE 0 END,
          updated_at = CURRENT_TIMESTAMP
      WHERE ${deviceClause}`;

    await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to set default printer.');
  }
};
