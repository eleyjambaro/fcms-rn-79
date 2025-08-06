import DeviceInfo from 'react-native-device-info';
import {sign, decode} from 'react-native-pure-jwt';
import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';
import uuid from 'react-native-uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import keys from '../keys/index';
import {getLocalAccountDBConnection} from '../localDb';
import endpoints from '../constants/endpoints';
import {rnStorageKeys} from '../constants/rnSecureStorageKeys';
import deviceInfo from '../lib/deviceInfo';

export const hasLicenseKey = async ({queryKey}) => {
  const [_key] = queryKey;

  const hasLicenseKey = await SecureStorage.hasItem('licenseKey');

  return {
    result: hasLicenseKey ? true : false,
  };
};

export const getLicenseKey = async ({queryKey}) => {
  const [_key, {returnCompleteKey}] = queryKey;

  let licenseKey = null;

  const hasLicenseKey = await SecureStorage.hasItem('licenseKey');

  if (hasLicenseKey) {
    licenseKey = await SecureStorage.getItem('licenseKey');
  }

  const hiddenChars = 'XXXXXXXX-XXXX-XXXX-XXXX-';

  if (licenseKey && !returnCompleteKey) {
    licenseKey = hiddenChars + licenseKey.substring(hiddenChars.length);
  }

  return {
    result: licenseKey,
  };
};

export const getLicenseStatus = async ({queryKey}) => {
  try {
    const [_key, {returnCompleteKey}] = queryKey;

    let licenseKey = null;
    let licenseToken = null;
    let appConfigFromLicense = null;
    let metadata = {};
    let expirationDate = null;
    let currentDate = new Date();
    let isLicenseExpired = true;

    const hasLicenseKey = await SecureStorage.hasItem('licenseKey');

    if (hasLicenseKey) {
      licenseKey = await SecureStorage.getItem('licenseKey');
    }

    const hiddenChars = 'XXXXXXXX-XXXX-XXXX-XXXX-';

    if (licenseKey && !returnCompleteKey) {
      licenseKey = hiddenChars + licenseKey.substring(hiddenChars.length);
    }

    const hasLicenseToken = await SecureStorage.hasItem('licenseToken');

    if (hasLicenseToken) {
      licenseToken = await SecureStorage.getItem('licenseToken');

      const parsedLicenseToken = JSON.parse(licenseToken);
      const {lt: token, kp: keyPair} = parsedLicenseToken;
      metadata = parsedLicenseToken.md;

      const deviceId = await deviceInfo.getDeviceId();
      let secretKey = deviceId + keyPair;

      try {
        // decode token
        const {payload} = await decode(
          token, // the token
          secretKey, // the secret
          {
            skipValidation: false, // to skip signature and exp verification
          },
        );

        if (payload) {
          appConfigFromLicense = payload?.appConfig;
        }
      } catch (error) {
        console.debug(error);
        isLicenseExpired = true;
      }
    }

    if (Object.keys(metadata).length > 0) {
      const {expirationDateInMs} = metadata;
      expirationDate = new Date(expirationDateInMs);
      isLicenseExpired = currentDate >= expirationDate;
    }

    return {
      result: {
        hasLicenseKey,
        licenseKey,
        hasLicenseToken,
        licenseToken,
        isLicenseExpired,
        appConfigFromLicense,
        metadata,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get license key status.');
  }
};

export const removeLicenseKey = async () => {
  try {
    const hasLicenseKey = await SecureStorage.hasItem('licenseKey');

    if (hasLicenseKey) {
      await SecureStorage.removeItem('licenseKey');
    }
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const saveLicenseKey = async licenseKey => {
  try {
    if (!licenseKey) {
      throw Error('Missing licenseKey parameter');
    }

    await SecureStorage.setItem(
      rnStorageKeys.licenseKey,
      licenseKey,
      ACCESSIBLE.WHEN_UNLOCKED,
    );
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const saveLicenseToken = async (licenseToken, keyPair) => {
  try {
    if (!licenseToken || !keyPair) {
      throw Error('Missing licenseToken or keyPair params');
    }

    const licenseTokenKeyPairAndMetadata = {
      lt: licenseToken,
      kp: keyPair,
      md: {},
      _ac: {},
    };

    const deviceId = await deviceInfo.getDeviceId();
    let secretKey = deviceId + keyPair;

    // decode token
    const {payload} = await decode(
      licenseToken, // the token
      secretKey, // the secret
      {
        skipValidation: false, // to skip signature and exp verification
      },
    );

    licenseTokenKeyPairAndMetadata.md = payload?.metadata;
    licenseTokenKeyPairAndMetadata._ac = payload?.appConfig; // save app config for future reference only

    /**
     * Stringify license token and keypair together with metadata
     */
    const licenseTokenJSON = JSON.stringify(licenseTokenKeyPairAndMetadata);

    await SecureStorage.setItem(
      rnStorageKeys.licenseToken,
      licenseTokenJSON,
      ACCESSIBLE.WHEN_UNLOCKED,
    );
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const removeLicenseToken = async () => {
  try {
    const hasLicenseToken = await SecureStorage.hasItem('licenseToken');

    if (hasLicenseToken) {
      await SecureStorage.removeItem('licenseToken');
    }
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const configRequestHeader = () => {
  let headers = {};

  headers['Access-Control-Request-Headers'] = '*';
  headers['apiKey'] = keys.mongodbDataApiKey;

  return headers;
};

export const activateLicense = async ({values, authState}) => {
  try {
    const {license_key: licenseKey} = values;
    let localAuthToken = null;

    let accountUID = null;
    let companyUID = 'test';

    const deviceId = await deviceInfo.getDeviceId();
    let deviceUID = deviceId;

    let accounts = [];
    let companies = [];

    /**
     * Verify account uid if it's a root user
     */
    const authUserAccountUID = authState?.authUser?.account_uid;

    const getRootAccountQuery = `SELECT * FROM accounts WHERE is_root_account = 1`;

    const db = await getLocalAccountDBConnection();
    const getRootAccountResult = await db.executeSql(getRootAccountQuery);
    const rootAccount = getRootAccountResult[0].rows.item(0);

    if (authUserAccountUID !== rootAccount.account_uid) {
      throw Error(
        'Unable to activate license. Must be a root account to proceed.',
      );
    } else {
      accountUID = authUserAccountUID;
    }

    localAuthToken = authState?.authToken;

    /**
     * Get all local user accounts and companies
     */
    const getAllAccountsQuery = `SELECT * FROM accounts`;
    const getAllAccountsResult = await db.executeSql(getAllAccountsQuery);

    getAllAccountsResult.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        accounts.push(result.rows.item(index));
      }
    });

    const getAllCompaniesQuery = `SELECT * FROM companies`;
    const getAllCompaniesResult = await db.executeSql(getAllCompaniesQuery);

    getAllCompaniesResult.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        companies.push(result.rows.item(index));
      }
    });

    if (!accounts.length > 0 || !companies.length > 0) {
      throw Error(
        'Unable to activate license. Must have a root account and company.',
      );
    }

    const requestBody = {
      licenseKey,
      localAuthToken,
      deviceUID,
      accountUID,
      companyUID,
      localAccounts: accounts,
      localCompanies: companies,
    };

    let response = null;

    // call API endpoint
    try {
      response = await axios.post(endpoints.activateLicense(), requestBody, {
        headers: configRequestHeader(),
      });
    } catch (error) {
      console.debug(error.message);

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.debug(error.response.data);
        console.debug(error.response.status);
        console.debug(error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.debug(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.debug('Error', error.message);
      }
      console.debug(error.config);

      throw error;
    }

    const {data} = response;

    const {lt, kp, apiVersion} = data;

    if (!lt) {
      throw Error('Missing lt from API response.');
    }

    if (!kp) {
      throw Error('Missing kp from API response.');
    }

    await saveLicenseKey(licenseKey);
    await saveLicenseToken(lt, kp);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
