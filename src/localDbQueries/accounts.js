import {getLocalAccountDBConnection, getDBConnection} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {sign, decode} from 'react-native-pure-jwt';
import bcrypt from 'react-native-bcrypt';
import uuid from 'react-native-uuid';
import * as RNFS from 'react-native-fs';
import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';

import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import keys from '../keys/index';
import appDefaults from '../constants/appDefaults';
import localAccountConfig from '../constants/localAccountConfig';
import {deleteAllSettings, updateSettings} from './settings';
import {
  deleteAllCompanies,
  getCurrentSelectedCompany,
  recreateAllCompanies,
} from './companies';
import getAppConfig from '../constants/appConfig';
import {assignDefaultRoleToAnAccount, getUserAccountRole} from './roles';
import DeviceInfo from 'react-native-device-info';
import {createNewOrGetDeviceImplantedUniqueId} from '../constants/deviceImplantedUniqueIdConfig';
import {getLicenseStatus} from './license';
import {rnStorageKeys} from '../constants/rnSecureStorageKeys';
import manualDataRecovery from '../constants/dataRecovery';

export const generateAuthToken = async (account, roleConfig) => {
  try {
    if (!account || !Object.keys(account).length > 0) {
      throw Error(
        `Unable to generate auth token. Missing or invalid account parameter`,
      );
    }

    const authTokenPayload = {
      exp: new Date().getTime() + 1000 * 60 * 60 * 16, // 16 hrs expiration
      id: account.id,
      account_uid: account.account_uid,
      username: account.username,
      is_root_account: account.is_root_account,
      role_id: account.role_id,
    };

    if (!account.is_root_account && roleConfig) {
      authTokenPayload.role_config_json = JSON.stringify(roleConfig);
      authTokenPayload.role_config = roleConfig;
    }

    const diuid = await createNewOrGetDeviceImplantedUniqueId();
    let secretKey = diuid;

    const authToken = await sign(
      authTokenPayload,
      secretKey, // secret
      {
        alg: 'HS256',
      },
    );

    /**
     * Save auth token to storage
     */
    await SecureStorage.set(rnStorageKeys.authToken, authToken, {
      accessible: ACCESSIBLE.WHEN_UNLOCKED,
    });

    return authToken;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const getAuthTokenStatus = async ({queryKey}) => {
  try {
    const [_key] = queryKey;

    let authToken = null;
    let tokenPayload = null;
    let isAuthTokenExpired = true;

    const hasAuthToken = await SecureStorage.exists('authToken');

    if (hasAuthToken) {
      authToken = await SecureStorage.get('authToken');

      const diuid = await createNewOrGetDeviceImplantedUniqueId();
      let secretKey = diuid;

      try {
        // decode token
        const {payload} = await decode(
          authToken, // the token
          secretKey, // secret
          {
            skipValidation: false, // to skip signature and exp verification
          },
        );

        if (payload) {
          tokenPayload = payload;
          isAuthTokenExpired = false;
        }
      } catch (error) {
        console.debug(error);
        isAuthTokenExpired = true;
      }
    }

    return {
      result: {
        hasAuthToken,
        authToken,
        isAuthTokenExpired,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get auth token status.');
  }
};

export const hasRootAccount = async ({queryKey}) => {
  const [_key] = queryKey;
  const query = `SELECT * FROM accounts WHERE is_root_account = 1`;

  try {
    const db = await getLocalAccountDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0) ? true : false,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch root account.');
  }
};

export const createAccount = async ({
  values,
  isRootAccount = false,
  onSuccess,
  onError,
}) => {
  try {
    const db = await getLocalAccountDBConnection();

    let companies = [];
    let hasCompany = false;

    const getCompaniesQuery = `SELECT * FROM companies`;
    const getCompaniesResult = await db.executeSql(getCompaniesQuery);
    getCompaniesResult.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        companies.push(result.rows.item(index));
      }
    });

    hasCompany = companies.length > 0 ? true : false;

    /**
     * Check if has company.
     * NOTE: We need to check if there's at least one company exists
     * as part of the completion of account setup.
     */
    if (!hasCompany) {
      onError &&
        onError({
          errorMessage: `No company found. Must create at least one company before creating an account to complete the account setup.`,
        });
      throw Error(
        `No company found. Must create at least one company before creating an account to complete the account setup.`,
      );
    }

    const company = companies[0];

    /**
     * Check if username is already exists
     * NOTE: Also check if email as username has already exists
     * to prevent login using email conflict
     */
    const getRootUserAccountQuery = `SELECT * FROM accounts WHERE username = '${values.username.trim()}' OR email = '${values.username.trim()}'`;
    const getRootUserAccountResult = await db.executeSql(
      getRootUserAccountQuery,
    );
    const fetchedRootUserAccount = getRootUserAccountResult[0].rows.item(0);

    if (fetchedRootUserAccount) {
      let fieldAlreadyExists =
        values.username.trim() === fetchedRootUserAccount.username
          ? 'username'
          : 'email';

      onError &&
        onError({
          errorMessage: `The name "${fetchedRootUserAccount[fieldAlreadyExists]}" already exists. Please specify a different name.`,
        });
      throw Error(
        `The name "${fetchedRootUserAccount[fieldAlreadyExists]}" already exists. Please specify a different name.`,
      );
    }

    /**
     * Hash account password
     */
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(values.password, salt);

    /**
     * Save account
     */
    let account = null;
    let accountId = null;

    const createAccountQuery = `
      INSERT INTO accounts (
        account_uid,
        username,
        email,
        password,
        is_root_account
      )
      
      VALUES(
        '${uuid.v4()}',
        '${values.username.trim()}',
        '${company.company_email || ''}',
        '${hashedPassword}',
        ${isRootAccount ? 1 : 0}
      );
    `;

    let accounts = [];

    const createAccountResult = await db.executeSql(createAccountQuery);

    if (createAccountResult[0].rowsAffected > 0) {
      accountId = createAccountResult[0].insertId;

      /**
       * Get created account by id
       */
      const getAccountQuery = `
        SELECT * FROM accounts WHERE id = ${parseInt(accountId)}      
      `;
      const getAccountResult = await db.executeSql(getAccountQuery);
      account = getAccountResult[0].rows.item(0);

      if (!account) {
        onError &&
          onError({
            errorMessage:
              'Something went wrong while fetching the created account',
          });
        throw Error('Something went wrong while fetching the created account');
      }

      accounts.push(account);

      try {
        await saveAccountForThisDeviceLocally({companies, accounts});
      } catch (error) {
        // undo the creation of the account
        await deleteAccount({id: account.id});

        if (error.code === 'ENOENT') {
          /**
           * Note: Should prompt user to enable all files management permission
           */
        }

        throw error;
      }
    }

    return {
      result: {
        account: {
          id: account?.id,
          account_uid: account?.account_uid,
          username: account?.username,
          is_root_account: account?.is_root_account,
          role_id: account?.role_id,
        },
        token: await generateAuthToken(account),
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create account.');
  }
};

export const getRootAccountUsername = async ({values}) => {
  try {
    const db = await getLocalAccountDBConnection();

    const getRootAccountQuery = `
      SELECT username FROM accounts WHERE is_root_account = 1
    `;
    const getRootAccountResult = await db.executeSql(getRootAccountQuery);
    const rootAccount = getRootAccountResult[0].rows.item(0);

    return {
      result: rootAccount.username,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch root account username.');
  }
};

export const emergencyChangePassword = async ({values}) => {
  try {
    const db = await getLocalAccountDBConnection();

    if (!values.password) {
      throw Error('Missing password field value.');
    }

    /**
     * Hash account password
     */
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(values.password, salt);

    /**
     * Save account
     */
    const updateRootAccountPassword = `
      UPDATE accounts
      SET password = '${hashedPassword}'
      WHERE is_root_account = 1
    `;

    await db.executeSql(updateRootAccountPassword);

    /**
     * Get root account
     */
    const getRootAccountQuery = `
      SELECT * FROM accounts WHERE is_root_account = 1
    `;
    const getRootAccountResult = await db.executeSql(getRootAccountQuery);
    const rootAccount = getRootAccountResult[0].rows.item(0);

    /**
     * Resave updated root account to this device
     */
    await saveUpdatedRootAccountAndCompaniesToThisDevice();

    return {
      result: rootAccount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to change password.');
  }
};

export const signInAccount = async ({
  values,
  onSuccess,
  onError,
  onEmergencyPasswordRecovery,
}) => {
  try {
    const db = await getLocalAccountDBConnection();

    const date = new Date();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const year = date.getFullYear();

    const emergencyPassword = `@${year}${month}${day}`;
    /**
     * Temporary password reset
     */
    if (
      values.username === 'rootaccount@recovery' &&
      values.password === emergencyPassword
    ) {
      /**
       * Get root account
       */
      const getRootAccountQuery = `
        SELECT * FROM accounts WHERE is_root_account = 1
      `;
      const getRootAccountResult = await db.executeSql(getRootAccountQuery);
      const rootAccount = getRootAccountResult[0].rows.item(0);

      onEmergencyPasswordRecovery &&
        onEmergencyPasswordRecovery({username: rootAccount.username});
      return;
    }

    /**
     * Get account by username (this is the user's email if local user account)
     */
    const getRootUserAccountQuery = `SELECT * FROM accounts WHERE username = '${values.username.trim()}' OR email = '${values.username.trim()}'`;
    const getRootUserAccountResult = await db.executeSql(
      getRootUserAccountQuery,
    );
    const fetchedRootUserAccount = getRootUserAccountResult[0].rows.item(0);

    if (!fetchedRootUserAccount) {
      onError &&
        onError({
          errorMessage: `The username or password is incorrect.`,
        });
      throw Error(`The username or password is incorrect.`);
    }

    /**
     * Check account password
     */
    const isPasswordCorrect = bcrypt.compareSync(
      values.password,
      fetchedRootUserAccount.password,
    );
    if (!isPasswordCorrect) {
      onError &&
        onError({
          errorMessage: `The username or password is incorrect.`,
        });
      throw Error(`The username or password is incorrect.`);
    }

    /**
     * Get user account role
     */
    let roleConfig = null;

    if (!fetchedRootUserAccount.is_root_account) {
      let roleId = fetchedRootUserAccount.role_id;

      if (!roleId) {
        const updatedAccount = await assignDefaultRoleToAnAccount(
          fetchedRootUserAccount.id,
        );
        roleId = updatedAccount.role_id;
      }

      /**
       * Get user account role
       */
      const role = await getUserAccountRole(roleId);
      roleConfig = JSON.parse(role.role_config_json);
    }

    /**
     * Return result with generated auth token
     */
    return {
      result: {
        account: {
          id: fetchedRootUserAccount?.id,
          account_uid: fetchedRootUserAccount?.account_uid,
          username: fetchedRootUserAccount?.username,
          is_root_account: fetchedRootUserAccount?.is_root_account,
          role_id: fetchedRootUserAccount?.role_id,
          role_config: roleConfig,
        },
        token: await generateAuthToken(fetchedRootUserAccount, roleConfig),
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to sign in account.');
  }
};

export const recreateRootAccountFromAccountsArray = async ({
  accounts,
  companies,
}) => {
  try {
    const db = await getLocalAccountDBConnection();

    if (!accounts || !accounts.length > 0) {
      throw Error('Accounts parameter is missing or no length.');
    }

    const account = accounts[0];
    let company = null;

    if (accounts.length > 1 || !account || !account?.is_root_account) {
      throw Error(
        'Failed to recreate root account. Accounts array should only contain 1 account, which is the root account created in this device upon first time installation',
      );
    }

    /**
     * Inject company email as root account's email if email is null
     * to support login using email feature starting from version 1.1.108
     */
    if (!account.email && companies && companies?.length === 1) {
      company = companies[0];
    }

    let rootAccountEmail = account.email || '';

    if (!rootAccountEmail && company && company.company_email) {
      rootAccountEmail = company.company_email;
    }

    let insertRootAccountQuery = `
      INSERT INTO accounts (
        account_uid,
        username,
        email,
        password,
        is_root_account
      )
      
      VALUES (
        '${account.account_uid}',
        '${account.username}',
        '${rootAccountEmail}',
        '${account.password}',
        ${account.is_root_account}
      );
    `;

    await db.executeSql(insertRootAccountQuery);

    if (!rootAccountEmail && company && company.company_email) {
      await saveUpdatedRootAccountAndCompaniesToThisDevice();
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to recreate root account.');
  }
};

export const deleteAccount = async ({id}) => {
  try {
    const db = await getLocalAccountDBConnection();

    const query = `DELETE FROM accounts WHERE id = ${parseInt(id)}`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteAllAccounts = async () => {
  try {
    const db = await getLocalAccountDBConnection();

    const query = `DELETE FROM accounts`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const isLocalAccountSetupCompleted = async () => {
  const isCompleted = await AsyncStorage.getItem(
    'isLocalAccountSetupCompleted',
  );

  if (!isCompleted || isCompleted === 'false') {
    return false;
  } else if (isCompleted || isCompleted === 'true') {
    return true;
  } else {
    return false;
  }
};

export const markLocalAccountSetupAsCompleted = async () => {
  await AsyncStorage.setItem('isLocalAccountSetupCompleted', 'true');
};

const getLocalAccountConfigFileData = async () => {
  try {
    // Check if Local Account Config File exists (local_account.json)
    const localAccountConfigPath = localAccountConfig.localAccountConfigPath;
    const localAccountConfigFileExists = await RNFS.exists(
      `${localAccountConfigPath}/${localAccountConfig.configFileName}`,
    );

    if (!localAccountConfigFileExists) {
      /**
       * it means that the Local Account Config file was deleted,
       * or it was the first time the app has been installed to this device.
       *
       * TODO: To ensure that the Local Account Config file was not intentionally deleted,
       * check from server if there's an existing account for this device.
       *
       * IF no account on server, then:
       * (1) show create company screen,
       * (2) show create local account screen,
       * and/or other additional Account Setup screen
       */

      return null;
    }

    const configFileJson = await RNFS.readFile(
      `${localAccountConfigPath}/${localAccountConfig.configFileName}`,
      'utf8',
    );

    if (!configFileJson) return null;

    const configFileData = JSON.parse(configFileJson);

    return configFileData;
  } catch (error) {
    throw error;
  }
};

const getLocalUserAccountsConfigFileData = async () => {
  try {
    /**
     * Check if there's an existing local user accounts (local_user_accounts.json file)
     */
    const localAccountConfigPath = localAccountConfig.localAccountConfigPath;
    const localUserAccountsFilePath = `${localAccountConfigPath}/${localAccountConfig.localUserAccountsFileName}`;
    const localUserAccountsFileExists = await RNFS.exists(
      localUserAccountsFilePath,
    );

    if (!localUserAccountsFileExists) return null;

    const localUserAccountsJson = await RNFS.readFile(
      localUserAccountsFilePath,
      'utf8',
    );

    if (!localUserAccountsJson) return null;

    const configFileData = JSON.parse(localUserAccountsJson);

    return configFileData;
  } catch (error) {
    throw error;
  }
};

const deleteLocalAccountConfigFile = async () => {
  try {
    // Check if Local Account Config File exists (local_account.json)
    const localAccountConfigPath = localAccountConfig.localAccountConfigPath;
    const localAccountConfigFilePath = `${localAccountConfigPath}/${localAccountConfig.configFileName}`;
    const localAccountConfigFileExists = await RNFS.exists(
      localAccountConfigFilePath,
    );

    if (!localAccountConfigFileExists) {
      /**
       * it means that the Local Account Config file was deleted,
       * or it was the first time the app has been installed to this device.
       */

      return;
    }

    await RNFS.unlink(localAccountConfigFilePath);
  } catch (error) {
    throw error;
  }
};

const deleteLocalUserAccountsConfigFile = async () => {
  try {
    /**
     * Check if there's an existing local user accounts (local_user_accounts.json file)
     */
    const localAccountConfigPath = localAccountConfig.localAccountConfigPath;
    const localUserAccountsFilePath = `${localAccountConfigPath}/${localAccountConfig.localUserAccountsFileName}`;
    const localUserAccountsFileExists = await RNFS.exists(
      localUserAccountsFilePath,
    );

    if (!localUserAccountsFileExists) {
      return;
    }

    await RNFS.unlink(localUserAccountsFilePath);
  } catch (error) {
    throw error;
  }
};

export const handleAccountCheckingForThisDevice = async () => {
  try {
    const isSetupCompleted = await isLocalAccountSetupCompleted();

    if (isSetupCompleted) {
      // it means that app was already installed
      return;
    }

    // if not, it means app is newly installed
    /**
     * Get existing account for this device
     */

    const configFileData = await getLocalAccountConfigFileData();

    const diuid = await createNewOrGetDeviceImplantedUniqueId();
    let secretKey = diuid;

    // verify if config file was generated from this device by verifying the token
    const {payload} = await decode(
      configFileData?.token, // the token
      secretKey, // the secret
      {
        skipValidation: false, // to skip signature and exp verification
      },
    );

    if (!payload) {
      throw Error('Token has no payload.');
    }

    const companies = payload?.companies;
    const accounts = payload?.accounts;

    // confirm if there are companies and accounts from the payload
    if (
      !companies ||
      !accounts ||
      !Object.keys(companies).length > 0 ||
      !Object.keys(accounts).length > 0
    ) {
      throw Error('No companies and accounts from the payload.');
    }

    /**
     * Delete all local accounts (from db table), and companies
     */
    await deleteAllAccounts();
    await deleteAllCompanies();

    /**
     * Recreate (resave to db tables) local accounts, company, and update settings
     * based on the token payload data.
     *
     * NOTE: Saved local account for this device will only be saved to the server
     * once users have activated their license key. ***Call saveAccountForThisDeviceToServer
     */
    await recreateRootAccountFromAccountsArray({accounts, companies});
    await recreateAllCompanies({companies});

    /**
     * Check if there are also existing local user accounts (local_user_accounts.json file)
     */
    const localUserAcountsConfigFileData =
      await getLocalUserAccountsConfigFileData();

    if (localUserAcountsConfigFileData?.localUserAccounts) {
      await recreateLocalUserAccounts({
        localUserAccounts: localUserAcountsConfigFileData.localUserAccounts,
      });
    }

    await markLocalAccountSetupAsCompleted();
  } catch (error) {
    /**
     * react-native-pure-jwt error codes (v3.0.2):
     * - error.code === '3': The JWT is expired.
     * - error.code === '6': Invalid signature (or secret key).
     */
    console.debug(error);
    /**
     * Invalid signature, it means that:
     * 1. There's an existing local account config file from other device, or
     * 2. The app is running on the emulator, the app has been reinstalled, and the
     * device unique id has been resetted
     */
    if (error?.code === '6') {
      try {
        await deleteAllAccounts();
        await deleteAllCompanies();
        await RNFS.unlink(
          `${localAccountConfig.localAccountConfigPath}/${localAccountConfig.configFileName}`,
        );
      } catch (err) {
        throw err;
      }
    }

    throw error;
  }
};

export const saveAccountForThisDeviceLocally = async ({
  companies,
  accounts,
  settings,
  onSuccess,
}) => {
  try {
    /**
     * Create app directory on the device if NOT exist
     */
    const appDirectoryPath = appDefaults.externalStorageAppDirectoryPath;
    const appDirectoryExists = await RNFS.exists(appDirectoryPath);

    if (!appDirectoryExists) {
      await RNFS.mkdir(appDirectoryPath);
    }

    /**
     * Create Local Account Config directory on the device if NOT exist
     */
    const localAccountConfigPath = localAccountConfig.localAccountConfigPath;
    const localAccountConfigDirectoryExists = await RNFS.exists(
      localAccountConfigPath,
    );

    if (!localAccountConfigDirectoryExists) {
      await RNFS.mkdir(localAccountConfigPath);
    }

    /**
     * Generate Local Account Config token
     */
    // validate companies and accounts
    if (
      !companies ||
      !accounts ||
      !Object.keys(companies).length > 0 ||
      !Object.keys(accounts).length > 0
    ) {
      throw Error('No companies or accounts parameter');
    }

    const tokenPayload = {
      companies,
      accounts,
    };

    const diuid = await createNewOrGetDeviceImplantedUniqueId();
    let secretKey = diuid;

    const localAccountConfigToken = await sign(
      tokenPayload,
      secretKey, // secret
      {
        alg: 'HS256',
      },
    );
    const localAccountConfigFileData = {
      token: localAccountConfigToken,
    };

    const localAccountConfigFileDataJson = JSON.stringify(
      localAccountConfigFileData,
    );

    const localAccountConfigFilePath = `${localAccountConfigPath}/${localAccountConfig.configFileName}`;

    // Check if there's already a Local Account Config File exists (local_account.json)
    const localAccountConfigFileExists = await RNFS.exists(
      localAccountConfigFilePath,
    );

    if (localAccountConfigFileExists) {
      // delete existing
      await RNFS.unlink(localAccountConfigFilePath);
    }

    /**
     * Create Local Account Config file (local_account.json)
     */
    await RNFS.writeFile(
      localAccountConfigFilePath,
      localAccountConfigFileDataJson,
      'utf8',
    );

    await markLocalAccountSetupAsCompleted();
  } catch (error) {
    console.debug(error);
    console.debug('Failed to save account for this device.');
    throw error;
  }
};

export const saveUpdatedRootAccountAndCompaniesToThisDevice = async () => {
  try {
    const db = await getLocalAccountDBConnection();

    /**
     * Get root account and companies
     */

    const accounts = [];
    const getRootAccountsQuery = `
      SELECT * FROM accounts WHERE is_root_account = 1
    `;
    const getRootAccountsResult = await db.executeSql(getRootAccountsQuery);

    getRootAccountsResult.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        accounts.push(result.rows.item(index));
      }
    });

    const companies = [];
    const getCompaniesQuery = `
      SELECT * FROM companies
    `;
    const getCompaniesResult = await db.executeSql(getCompaniesQuery);

    getCompaniesResult.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        companies.push(result.rows.item(index));
      }
    });

    /**
     * Create app directory on the device if NOT exist
     */
    const appDirectoryPath = appDefaults.externalStorageAppDirectoryPath;
    const appDirectoryExists = await RNFS.exists(appDirectoryPath);

    if (!appDirectoryExists) {
      await RNFS.mkdir(appDirectoryPath);
    }

    /**
     * Create Local Account Config directory on the device if NOT exist
     */
    const localAccountConfigPath = localAccountConfig.localAccountConfigPath;
    const localAccountConfigDirectoryExists = await RNFS.exists(
      localAccountConfigPath,
    );

    if (!localAccountConfigDirectoryExists) {
      await RNFS.mkdir(localAccountConfigPath);
    }

    /**
     * Generate Local Account Config token
     */
    // validate companies and accounts
    if (
      !companies ||
      !accounts ||
      !Object.keys(companies).length > 0 ||
      !Object.keys(accounts).length > 0
    ) {
      throw Error('No companies or accounts parameter');
    }

    const tokenPayload = {
      companies,
      accounts,
    };

    const diuid = await createNewOrGetDeviceImplantedUniqueId();
    let secretKey = diuid;

    const localAccountConfigToken = await sign(
      tokenPayload,
      secretKey, // secret
      {
        alg: 'HS256',
      },
    );
    const localAccountConfigFileData = {
      token: localAccountConfigToken,
    };

    const localAccountConfigFileDataJson = JSON.stringify(
      localAccountConfigFileData,
    );

    const localAccountConfigFilePath = `${localAccountConfigPath}/${localAccountConfig.configFileName}`;

    // Check if there's already a Local Account Config File exists (local_account.json)
    const localAccountConfigFileExists = await RNFS.exists(
      localAccountConfigFilePath,
    );

    if (localAccountConfigFileExists) {
      // delete existing
      await RNFS.unlink(localAccountConfigFilePath);
    }

    /**
     * Create Local Account Config file (local_account.json)
     */
    await RNFS.writeFile(
      localAccountConfigFilePath,
      localAccountConfigFileDataJson,
      'utf8',
    );
  } catch (error) {
    console.debug(error);
    console.debug(
      'Failed to save updated roout account and companies to this device.',
    );
    throw error;
  }
};

/**
 * Local User Accounts
 */
/**
 * Call this function every INSERT, UPDATE, and DELETE local user accounts
 * to have an updated copy of all local user accounts to this device as json file
 */
export const saveUpdatedLocalUserAccountsToThisDevice = async () => {
  try {
    const db = await getLocalAccountDBConnection();

    const accounts = [];
    const getLocalUserAccounts = `
      SELECT * FROM accounts WHERE is_root_account = 0
    `;
    const results = await db.executeSql(getLocalUserAccounts);

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        accounts.push(result.rows.item(index));
      }
    });

    /**
     * Create app directory on the device if NOT exist
     */
    const appDirectoryPath = appDefaults.externalStorageAppDirectoryPath;
    const appDirectoryExists = await RNFS.exists(appDirectoryPath);

    if (!appDirectoryExists) {
      await RNFS.mkdir(appDirectoryPath);
    }

    /**
     * Create Local Account Config directory on the device if NOT exist
     */
    const localAccountConfigPath = localAccountConfig.localAccountConfigPath;
    const localAccountConfigDirectoryExists = await RNFS.exists(
      localAccountConfigPath,
    );

    if (!localAccountConfigDirectoryExists) {
      await RNFS.mkdir(localAccountConfigPath);
    }

    const localUserAccountsFilePath = `${localAccountConfigPath}/${localAccountConfig.localUserAccountsFileName}`;

    /**
     * Create local_user_accounts.json file
     */

    // Check if there's already a local_user_accounts.json file exists
    const localUserAccountsFileExists = await RNFS.exists(
      localUserAccountsFilePath,
    );

    if (localUserAccountsFileExists) {
      // delete existing
      await RNFS.unlink(localUserAccountsFilePath);
    }

    const localUserAccountsFileData = {
      localUserAccounts: accounts,
    };

    const localUserAccountsJson = JSON.stringify(localUserAccountsFileData);

    /**
     * Create Local User Accounts file (local_user_accounts.json)
     */
    await RNFS.writeFile(
      localUserAccountsFilePath,
      localUserAccountsJson,
      'utf8',
    );
  } catch (error) {
    console.debug(error);
    console.debug(
      'Failed to save updated local user accounts for this device.',
    );
    throw error;
  }
};

export const createLocalUserAccount = async ({
  values,
  onInsertLimitReached,
  onError,
}) => {
  try {
    const db = await getLocalAccountDBConnection();
    const appConfig = await getAppConfig();
    const insertLimit = appConfig?.insertUserLimit;

    if (
      insertLimit > 0 &&
      (await isInsertLimitReached('accounts', insertLimit))
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit,
          message: `You can only create up to ${insertLimit} local user accounts`,
        });
      console.debug(
        'Failed to create local user account, insert limit reached.',
      );

      return;
    }

    /**
     * Get company uid
     */
    const company = await getCurrentSelectedCompany();
    const companyUID = company.company_uid;

    /**
     * Check if email or email as username is already exists
     */
    const getAccountByEmailQuery = `SELECT * FROM accounts WHERE username = '${values.email}' OR email = '${values.email}'`;
    const getAccountByEmailResult = await db.executeSql(getAccountByEmailQuery);
    const fetchedAccountByEmail = getAccountByEmailResult[0].rows.item(0);

    if (fetchedAccountByEmail) {
      onError &&
        onError({
          errorMessage: `The email "${fetchedAccountByEmail.username}" already exists. Please enter a different email.`,
        });
      throw Error(
        `The email "${fetchedAccountByEmail.username}" already exists. Please enter a different email.`,
      );
    }

    /**
     * Hash account password
     */
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(values.password, salt);

    const createLocalUserAccountQuery = `INSERT INTO accounts (
      company_uid,
      account_uid,
      first_name,
      last_name,
      username,
      email,
      password,
      role_id
    )
    
    VALUES(
      '${companyUID}',
      '${uuid.v4()}',
      '${values.first_name}',
      '${values.last_name}',
      '${values.email}',
      '${values.email}',
      '${hashedPassword}',
      ${parseInt(values.role_id)}
    );`;

    const createLocalUserAccountResult = await db.executeSql(
      createLocalUserAccountQuery,
    );

    if (createLocalUserAccountResult[0].rowsAffected > 0) {
      await saveUpdatedLocalUserAccountsToThisDevice();
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create local user account.');
  }
};

export const getLocalUserAccounts = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, limit = 1000000000}] = queryKey;
  const orderBy = 'first_name';
  let queryFilter = createQueryFilter(filter, {
    is_root_account: 0,
    is_deactivated: 0,
  });

  try {
    const db = await getLocalAccountDBConnection();
    const list = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectQuery = `
      SELECT *,
      accounts.id AS id,
      roles.name AS role_name
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM accounts
      JOIN roles ON roles.id = accounts.role_id

      ${queryFilter}

      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    `;

    const results = await db.executeSql(selectQuery + query);
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
    throw Error('Failed to get local user accounts.');
  }
};

export const getLocalUserAccount = async ({queryKey, pageParam = 1}) => {
  const [_key, {id}] = queryKey;

  try {
    const db = await getLocalAccountDBConnection();

    const getLocalUserAccountQuery = `
      SELECT *,
      accounts.id AS id,
      roles.name AS role_name

      FROM accounts
      JOIN roles ON roles.id = accounts.role_id

      WHERE accounts.id = ${parseInt(id)}
    `;

    const getLocalUserAccountResult = await db.executeSql(
      getLocalUserAccountQuery,
    );
    const localUserAccount = getLocalUserAccountResult[0].rows.item(0);

    return {
      result: localUserAccount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get local user account.');
  }
};

export const updateLocalUserAccount = async ({id, updatedValues, onError}) => {
  try {
    const db = await getLocalAccountDBConnection();

    /**
     * Check if email or email as username is already exists
     */
    const getAccountByEmailQuery = `SELECT * FROM accounts WHERE (username = '${
      updatedValues.email
    }' OR email = '${updatedValues.email}') AND id != ${parseInt(id)}`;
    const getAccountByEmailResult = await db.executeSql(getAccountByEmailQuery);
    const fetchedAccountByEmail = getAccountByEmailResult[0].rows.item(0);

    if (fetchedAccountByEmail) {
      onError &&
        onError({
          errorMessage: `The email "${fetchedAccountByEmail.username}" already exists. Please enter a different email.`,
        });
      throw Error(
        `The email "${fetchedAccountByEmail.username}" already exists. Please enter a different email.`,
      );
    }

    const query = `UPDATE accounts
    SET first_name = '${updatedValues.first_name}',
    last_name = '${updatedValues.last_name}',
    username = '${updatedValues.email}',
    email = '${updatedValues.email}',
    role_id = ${parseInt(updatedValues.role_id)}
    WHERE is_root_account = 0 AND id = ${id}
  `;

    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update local user account.');
  }
};

export const deleteLocalUserAccount = async ({id}) => {
  try {
    const db = await getLocalAccountDBConnection();

    const query = `DELETE FROM accounts WHERE id = ${parseInt(id)}`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const recreateLocalUserAccounts = async ({localUserAccounts}) => {
  try {
    const db = await getLocalAccountDBConnection();

    if (!localUserAccounts) {
      throw Error('localUserAccounts parameter is missing.');
    }

    const insertedAccounts = [];

    // insert each account
    let insertAccountsQuery = `
      INSERT INTO accounts (
        id,
        account_uid,
        username,
        password,
        company_id,
        company_uid,
        is_root_account,
        profile_photo_path,
        first_name,
        last_name,
        email,
        is_deactivated,
        reset_key,
        role_id,
        role_config_json,
        is_using_given_password
      )
      
      VALUES
    `;

    for (let index = 0; index < localUserAccounts.length; index++) {
      let account = localUserAccounts[index];
      insertedAccounts.push(account);

      insertAccountsQuery += `(
        ${account.id},
        '${account.account_uid}',
        '${account.username}',
        '${account.password}',
        ${account.company_id},
        '${account.company_uid}',
        ${account.is_root_account ? 1 : 0},
        '${account.profile_photo_path}',
        '${account.first_name}',
        '${account.last_name}',
        '${account.email}',
        ${account.is_deactivated ? 1 : 0},
        '${account.reset_key}',
        ${account.role_id},
        '${account.role_config_json}',
        ${account.is_using_given_password ? 1 : 0}
      )`;

      if (localUserAccounts.length - 1 !== index) {
        insertAccountsQuery += `,
          `;
      } else {
        insertAccountsQuery += ';';
      }
    }

    await db.executeSql(insertAccountsQuery);

    return insertedAccounts;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to recreate local user accounts.');
  }
};

export const saveBackupDataToThisDevice = async () => {
  try {
    /**
     * Create database recovery directory (to the device Downloads folder)
     */
    const dataRecoveryDirectoryName = manualDataRecovery.directoryName;

    const dataRecoveryDirectoryPath = `${RNFS.DownloadDirectoryPath}/${dataRecoveryDirectoryName}`;

    const dataRecoveryDirectoryExists = await RNFS.exists(
      dataRecoveryDirectoryPath,
    );

    if (!dataRecoveryDirectoryExists) {
      await RNFS.mkdir(dataRecoveryDirectoryPath);
    }

    /**
     * Generate database recovery config file token
     */
    const backupDbId = uuid.v4(); // backup db unique id on the file name
    const tokenPayload = {
      id: backupDbId, // TODO: hash this id to add an additional security layer
      info: {
        backupDate: Date.now(),
        // TODO: add more essential details here about the account
      },
    };

    const configToken = await sign(
      tokenPayload,
      manualDataRecovery.configTokenKey, // secret
      {
        alg: 'HS256',
      },
    );

    /**
     * Create database recovery config file (dbr_cfg.json)
     */
    const configFileName = manualDataRecovery.configFileName;
    const configFileData = {
      cfg_t: configToken,
    };

    const configFileDataJson = JSON.stringify(configFileData);

    // move the existing config file to the app files directory
    if (await RNFS.exists(`${dataRecoveryDirectoryPath}/${configFileName}`)) {
      await RNFS.moveFile(
        `${dataRecoveryDirectoryPath}/${configFileName}`,
        `${
          RNFS.ExternalDirectoryPath
        }/${configFileName}_replaced_${Date.now()}`,
      );
    }

    await RNFS.writeFile(
      `${dataRecoveryDirectoryPath}/${configFileName}`,
      configFileDataJson,
      'utf8',
    );

    const backupDbName = `${manualDataRecovery.backupDbPrefix}${backupDbId}`;

    /**
     * Locate databases path (where sqlite database file is located)
     *
     * /data/user/0/rocks.uxi.fcms/databases
     */
    const paths = RNFS.DocumentDirectoryPath.split('/');
    paths.pop();
    paths.push('databases');
    const databasesDirectoryPath = paths.join('/');

    /**
     * Copy sqlite database file from databases directory to data recovery directory
     */
    const dbFilePath = `${databasesDirectoryPath}/${appDefaults.dbName}`;

    const dbFileExists = await RNFS.exists(dbFilePath);

    if (dbFileExists) {
      await RNFS.copyFile(
        dbFilePath,
        `${dataRecoveryDirectoryPath}/${backupDbName}`,
      );
    }
  } catch (error) {
    throw error;
  }
};

const deleteAllDbTablesData = async db => {
  try {
    db.transaction(tx => {
      // Step 1: Get all user-defined tables
      tx.executeSql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
        [],
        (txObj, {rows}) => {
          const tableNames = [];
          for (let i = 0; i < rows.length; i++) {
            tableNames.push(rows.item(i).name);
          }

          console.info('TABLE NAMES: ', tableNames);

          // Step 2: Iterate and delete from each table
          tableNames.forEach(tableName => {
            tx.executeSql(
              `DELETE FROM ${tableName};`,
              [],
              () => console.info(`Cleared ${tableName}`),
              (txObj, error) =>
                console.error(`Failed to clear ${tableName}`, error),
            );
          });
        },
        (txObj, error) => {
          console.error('Failed to fetch table names', error);
          throw error;
        },
      );
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Delete root user account and other local accounts
 * including inventory data and financial data
 */
export const deleteMyAccount = async ({
  values,
  onError,
  onErrorLicenseKey,
  onSuccess,
  onRequireLicenseKey,
  onRequireRetypeText,
  onErrorRetypeText,
  enableBackupData = true,
}) => {
  try {
    const localAccountDb = await getLocalAccountDBConnection();
    /**
     * Validate root user account password
     */

    /**
     * 1. Get root user account
     */
    const getRootUserAccountQuery = `SELECT * FROM accounts WHERE is_root_account = 1`;
    const getRootUserAccountResult = await localAccountDb.executeSql(
      getRootUserAccountQuery,
    );
    const fetchedRootUserAccount = getRootUserAccountResult[0].rows.item(0);

    if (!fetchedRootUserAccount) {
      onError &&
        onError({
          errorMessage: `The credential is incorrect.`,
        });
      return;
    }

    /**
     * 2. Check account password
     */
    const isPasswordCorrect = bcrypt.compareSync(
      values.password,
      fetchedRootUserAccount.password,
    );
    if (!isPasswordCorrect) {
      onError &&
        onError({
          errorMessage: `The password is incorrect.`,
        });
      return;
    }

    // check first the status of license if there's any
    const {result: getLicenseStatusResult} = await getLicenseStatus({
      queryKey: ['licenseStatus', {returnCompleteKey: true}],
    });

    if (!getLicenseStatusResult) {
      throw Error('Failed on checking license status');
    }

    const {
      hasLicenseKey,
      licenseKey,
      hasLicenseToken,
      licenseToken,
      isLicenseExpired,
      appConfigFromLicense,
      metadata,
    } = getLicenseStatusResult;

    if (hasLicenseKey && !values.license_key) {
      onRequireLicenseKey && onRequireLicenseKey();
      return;
    }

    if (
      hasLicenseKey &&
      values.license_key &&
      values.license_key !== licenseKey
    ) {
      onErrorLicenseKey &&
        onErrorLicenseKey({errorMessage: 'Invalid license key.'});
      return;
    }

    if (onRequireRetypeText && !values.text) {
      onRequireRetypeText && onRequireRetypeText();
      return;
    }

    if (onRequireRetypeText && values.text === !values.text_to_retype) {
      onErrorRetypeText &&
        onErrorRetypeText({errorMessage: 'Please retype the text to confirm.'});
      return;
    }

    if (enableBackupData) {
      await saveBackupDataToThisDevice();
    }

    const appDb = await getDBConnection();

    // delete all app db tables data
    await deleteAllDbTablesData(appDb);

    // delete all local accounts db tables data
    await deleteAllDbTablesData(localAccountDb);

    // clear secure storage
    for (let key in rnStorageKeys) {
      if (await SecureStorage.hasItem(key)) {
        await SecureStorage.removeItem(key);
        console.info('Secured storage removed key: ', key);
      }
    }

    // clear async storage
    const appAsyncStorageKeys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(appAsyncStorageKeys);
    console.info('AsyncStorage removed keys: ', appAsyncStorageKeys);

    // delete root user account JSON file
    await deleteLocalAccountConfigFile();

    // delete local user accounts JSON file
    await deleteLocalUserAccountsConfigFile();

    onSuccess && onSuccess();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete your account.');
  }
};
