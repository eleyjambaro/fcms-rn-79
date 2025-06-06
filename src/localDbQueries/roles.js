import {getLocalAccountDBConnection} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {appStorageKeySeperator} from './appVersions';
import {localUserDefaultRoleId} from '../constants/appConfig';

export const defaultRoles = [
  {
    id: 1,
    name: 'Admin',
    role_config_json: JSON.stringify({
      enable: ['*'],
      disable: [],
    }),
    is_app_default: 1,
  },
  {
    id: 2,
    name: 'Encoder',
    role_config_json: JSON.stringify({
      enable: ['*'],
      disable: [
        'revenues',
        'recipes',
        'reports',
        'dataSyncAndBackup',
        'inventoryDataTemplate',
        'userManagement',
        'settings',
        'account.updateCompanyProfile',
      ],
    }),
    is_app_default: 1,
  },
];

export const getRoles = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = 'name';
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
    const db = await getLocalAccountDBConnection();
    const list = [];
    const offset = (pageParam - 1) * limit;
    const selectAllQuery = `SELECT * `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `FROM roles ${queryFilter} ORDER BY ${orderBy} ASC LIMIT ${limit} OFFSET ${offset}`;

    const results = await db.executeSql(selectAllQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        list.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: list,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get roles.');
  }
};

export const getRole = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM roles WHERE id = ${id}`;

  if (!id) {
    return {
      result: null,
    };
  }

  try {
    const db = await getLocalAccountDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get role.');
  }
};

export const getUserAccountRole = async accountRoleId => {
  try {
    if (!accountRoleId) {
      throw Error('Missing accountRoleId parameter');
    }

    const db = await getLocalAccountDBConnection();

    const query = `SELECT * FROM roles WHERE id = ${parseInt(accountRoleId)}`;
    const result = await db.executeSql(query);

    return result[0].rows.item(0);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get user account role.');
  }
};

export const assignDefaultRoleToAnAccount = async accountId => {
  try {
    if (!accountId) {
      throw Error('Missing accountId parameter');
    }

    const db = await getLocalAccountDBConnection();

    const updateAccountRoleToDefaultQuery = `
      UPDATE accounts
      SET role_id = ${parseInt(localUserDefaultRoleId)}
      WHERE id = ${parseInt(accountId)}
    `;
    const updateAccountRoleToDefaultResult = await db.executeSql(
      updateAccountRoleToDefaultQuery,
    );

    const getAccountQuery = `
      SELECT * FROM accounts WHERE id = ${parseInt(accountId)}
    `;
    const getAccountResult = await db.executeSql(getAccountQuery);

    return getAccountResult[0].rows.item(0);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to assign default role to an account.');
  }
};

export const createRole = async ({values}) => {
  let idField = '';
  let idValue = '';

  /**
   * id field and value are included only
   * when inserting app's default role with
   * default assigned id
   */
  if (
    values.is_app_default &&
    parseInt(values.is_app_default) === 1 &&
    values.id
  ) {
    idField = 'id, ';
    idValue = `${parseInt(values.id)}, `;
  }

  const query = `INSERT INTO roles (
    ${idField}
    name,
    role_config_json,
    is_app_default
  )

  VALUES (
    ${idValue}
    '${values.name}',
    '${values.role_config_json}',
    ${parseInt(values.is_app_default || 0)}
  );`;

  try {
    const db = await getLocalAccountDBConnection();
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create role.');
  }
};

export const createDefaultRoles = async (version = '0.0.0') => {
  let hasDefaultRoles = false;
  const key = `hasDefaultRoles${appStorageKeySeperator}${version}`;

  try {
    hasDefaultRoles = await AsyncStorage.getItem(key);

    if (hasDefaultRoles === 'true') {
      console.log(`Default Roles (${version}) has been already initialized.`);
      return;
    }

    const results = await Promise.all(
      defaultRoles.map(async values => {
        return await createRole({values});
      }),
    );

    await AsyncStorage.setItem(key, 'true');
    console.log(
      `Default Roles (${version}) has been initialized successfully.`,
    );

    return results;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteDefaultRoles = async () => {
  try {
    const db = await getLocalAccountDBConnection();

    const query = `DELETE FROM roles WHERE is_app_default = 1`;
    await db.executeSql(query);
    console.info('Default roles deleted');
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
