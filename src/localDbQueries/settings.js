import {getLocalAccountDBConnection} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {appStorageKeySeperator} from './appVersions';

export const defaultSettings = [
  // Logo settings
  {
    name: 'logo_display_company_name',
    value: '0',
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
];

export const createSetting = async ({values}) => {
  const query = `INSERT INTO settings (
    name,
    value,
    setting_group,
    setting_sub_group
  )
  
  VALUES(
    '${values.name}',
    '${values.value}',
    '${values.setting_group}',
    '${values.setting_sub_group}'
  );`;

  try {
    const db = await getLocalAccountDBConnection();

    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create setting.');
  }
};

export const getSettings = async ({queryKey}) => {
  const [_key, {settingNames}] = queryKey;

  let query = `SELECT * FROM settings WHERE name IN (${settingNames
    ?.map(name => `'${name}'`)
    ?.join(', ')})`;

  if (typeof settingNames === 'string' && settingNames === '*') {
    query = `SELECT * FROM settings`;
  }

  try {
    const db = await getLocalAccountDBConnection();
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
    console.debug(error);
    throw Error('Failed to fetch settings.');
  }
};

export const updateSettings = async ({values, onSuccess, onError}) => {
  try {
    const db = await getLocalAccountDBConnection();

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

    // update each setting value
    const updateEachSettingValueQuery = `
      WITH tmp(name, value) AS (${tmpValues})

      UPDATE settings SET value = (SELECT value FROM tmp WHERE settings.name = tmp.name)

      WHERE name IN (SELECT name FROM tmp)
    `;

    await db.executeSql(updateEachSettingValueQuery);

    return {
      result: {},
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update settings.');
  }
};

export const createDefaultSettings = async (version = '0.0.0') => {
  let hasDefaultSettings = false;
  const key = `hasDefaultSettings${appStorageKeySeperator}${version}`;

  try {
    hasDefaultSettings = await AsyncStorage.getItem(key);

    if (hasDefaultSettings === 'true') {
      console.log(
        `Default Settings (version ${version}) has been already initialized.`,
      );
      return;
    }

    const results = await Promise.all(
      defaultSettings.map(async values => {
        return await createSetting({values});
      }),
    );

    await AsyncStorage.setItem(key, 'true');
    console.log(
      `Default Settings (version ${version}) has been initialized successfully.`,
    );

    return results;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const getAllSettings = async ({queryKey}) => {
  const [_key] = queryKey;

  let query = `SELECT * FROM settings`;

  try {
    const db = await getLocalAccountDBConnection();
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
    console.debug(error);
    throw Error('Failed to fetch all settings.');
  }
};

export const deleteAllSettings = async () => {
  try {
    const db = await getLocalAccountDBConnection();

    const query = `DELETE FROM settings`;
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
    const db = await getLocalAccountDBConnection();

    const query = `DELETE FROM settings WHERE app_version != '${currentVersion}'`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
