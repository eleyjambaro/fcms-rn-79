import {
  getDBConnection,
  getCloudSyncParams,
  getSettingSyncId,
  SETTINGS_SEED_SENTINEL,
} from '../localDb';
import {scheduleSyncSoon} from '../services/syncService';

export const defaultSettings = [
  // Logo settings
  {
    name: 'logo_display_company_name',
    value: '1',
    setting_group: 'Logo',
    setting_sub_group: '',
  },
  {
    name: 'logo_display_branch',
    value: '0',
    setting_group: 'Logo',
    setting_sub_group: '',
  },
  {
    name: 'currency_code',
    value: 'PHP',
    setting_group: '',
    setting_sub_group: '',
  },
  {
    name: 'default_printer_id',
    value: '',
    setting_group: '',
    setting_sub_group: '',
  },
  // Inventory settings
  {
    name: 'auto_deduct_spoilages',
    value: '0',
    setting_group: 'Inventory',
    setting_sub_group: '',
  },
];

// Seeds a single (default) setting row. settings is a delta-sync table: id is
// TEXT === sync_id (deterministic per branch+name so every device converges),
// and the seed is stamped at the epoch sentinel (updated_at == synced_at) so a
// freshly-seeded default neither pushes (and clobbers a real server value) nor
// wins a pull against a real one. The first updateSettings() bumps updated_at
// past the sentinel, at which point the change pushes normally.
export const createSetting = async ({values}) => {
  try {
    const db = await getDBConnection();
    const {deviceId, branchId} = await getCloudSyncParams();
    const syncId = getSettingSyncId(branchId, values.name);
    const query = `INSERT INTO settings (
      id,
      sync_id,
      name,
      value,
      setting_group,
      setting_sub_group,
      device_id,
      branch_id,
      updated_at,
      synced_at,
      is_deleted
    )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`;

    return db.executeSql(query, [
      syncId,
      syncId,
      values.name ?? null,
      values.value ?? null,
      values.setting_group ?? null,
      values.setting_sub_group ?? null,
      deviceId ?? null,
      branchId ?? null,
      SETTINGS_SEED_SENTINEL,
      SETTINGS_SEED_SENTINEL,
    ]);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create setting.');
  }
};

export const getSettings = async ({queryKey}) => {
  const [_key, {settingNames}] = queryKey;

  // Read from the NULL-safe active_ view so soft-deleted rows stay hidden.
  let query = `SELECT * FROM active_settings WHERE name IN (${settingNames
    ?.map(name => `'${name}'`)
    ?.join(', ')})`;

  if (typeof settingNames === 'string' && settingNames === '*') {
    query = `SELECT * FROM active_settings`;
  }

  try {
    const db = await getDBConnection();
    const results = await db.executeSql(query);

    let settings = [];
    let settingsMap = {};

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        let setting = result.rows.item(index);
        settings.push(setting);
        settingsMap[setting.name] = setting.value;
      }
    });

    return {
      result: settings,
      resultMap: settingsMap,
    };
  } catch (error) {
    if (error?.message?.includes('no such table')) {
      return {result: [], resultMap: {}};
    }
    console.debug(error);
    throw Error('Failed to fetch settings.');
  }
};

export const updateSettings = async ({values, onSuccess, onError}) => {
  try {
    const db = await getDBConnection();

    if (!values.length > 0) {
      throw Error('values parameter for settings is missing');
    }

    /**
     * tmp table columns:
     * name, value, setting_group, setting_sub_group
     */
    let tmpValues = `VALUES `;

    for (let index = 0; index < values.length; index++) {
      // tmp values
      tmpValues += `(
        '${values[index].name}',
        '${values[index].value}'
      )`;

      if (values.length - 1 !== index) {
        tmpValues += `,
          `;
      }
    }

    // update each setting value. Bump updated_at (UTC, matches the sync
    // watermark format) so the change is collected on the next push.
    const updateEachSettingValueQuery = `
      WITH tmp(name, value) AS (${tmpValues})

      UPDATE settings SET
        value = (SELECT value FROM tmp WHERE settings.name = tmp.name),
        updated_at = CURRENT_TIMESTAMP

      WHERE name IN (SELECT name FROM tmp)
    `;

    await db.executeSql(updateEachSettingValueQuery);

    // settings is a delta-sync table and the UPDATE above bumped updated_at
    // past synced_at, so push the change right away (debounced) instead of
    // waiting for the next foreground sync tick — this is what makes a toggle
    // like auto_deduct_spoilages reach the server (and the web app) promptly.
    scheduleSyncSoon();

    return {
      result: {},
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update settings.');
  }
};

export const createDefaultSettings = async () => {
  try {
    const db = await getDBConnection();
    const results = await db.executeSql(
      `SELECT COUNT(*) as count FROM settings`,
    );
    const count = results[0]?.rows?.item(0)?.count ?? 0;

    if (count > 0) {
      // Settings already seeded — backfill only the defaults that don't exist
      // yet, so newly-introduced settings (e.g. auto_deduct_spoilages) reach
      // users created before this version.
      const existing = await db.executeSql(`SELECT name FROM settings`);
      const names = new Set();
      existing.forEach(result => {
        for (let i = 0; i < result.rows.length; i++) {
          names.add(result.rows.item(i).name);
        }
      });

      const missing = defaultSettings.filter(s => !names.has(s.name));
      if (!missing.length) {
        return;
      }

      return await Promise.all(missing.map(values => createSetting({values})));
    }

    return await Promise.all(
      defaultSettings.map(values => createSetting({values})),
    );
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const getAllSettings = async ({queryKey}) => {
  const [_key] = queryKey;

  let query = `SELECT * FROM active_settings`;

  try {
    const db = await getDBConnection();
    const results = await db.executeSql(query);

    let settings = [];
    let settingsMap = {};

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        let setting = result.rows.item(index);
        settings.push(setting);
        settingsMap[setting.name] = setting.value;
      }
    });

    return {
      result: settings,
      resultMap: settingsMap,
    };
  } catch (error) {
    if (error?.message?.includes('no such table')) {
      return {result: [], resultMap: {}};
    }
    console.debug(error);
    throw Error('Failed to fetch all settings.');
  }
};

export const deleteAllSettings = async () => {
  try {
    const db = await getDBConnection();

    // Soft-delete: settings is a delta-sync table (Invariant 4 — never DELETE
    // FROM). Bump updated_at so the tombstone propagates on the next push.
    const query = `UPDATE settings SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP`;
    await db.executeSql(query);

    console.info('Settings deleted');
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deletePreviousAppVersionDefaultSettings = async (
  currentVersion = '0.0.0',
) => {
  try {
    const db = await getDBConnection();

    // Soft-delete (see deleteAllSettings).
    const query = `UPDATE settings SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE app_version != '${currentVersion}'`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
