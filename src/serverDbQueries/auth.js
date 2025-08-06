import axios from 'axios';
import {
  configRequestHeader,
  getAuthToken,
  storeAuthToken,
} from '../utils/cloudAuthHelpers';
import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';

import {getLocalAccountDBConnection} from '../localDb';

import urls from '../constants/urls';
import {rnStorageKeys} from '../constants/rnSecureStorageKeys';

const API_URL = urls.cloudApiUrl;

const defaultCloudEmailKey = rnStorageKeys.cloudDefaultEmail;

export const getDefaultCloudEmail = async () => {
  try {
    let email = null;

    const db = await getLocalAccountDBConnection();

    const hasDefaultEmail = await SecureStorage.hasItem(defaultCloudEmailKey);

    if (hasDefaultEmail) {
      email = await SecureStorage.getItem(defaultCloudEmailKey);
    }

    if (!email) {
      /**
       * Get root user account email
       */
      const getRootAccountQuery = `
      SELECT * FROM accounts WHERE is_root_account = 1
    `;
      const getRootAccountResult = await db.executeSql(getRootAccountQuery);
      const rootAccount = getRootAccountResult[0].rows.item(0);
      email = rootAccount?.email;
    }

    if (!email) {
      /**
       * Get company email
       */
      const getCompany = `SELECT * FROM companies ORDER BY id ASC LIMIT 1`;
      const getCompanyResult = await db.executeSql(getCompany);
      const company = getCompanyResult[0].rows.item(0);
      email = company?.company_email;
    }

    if (!email) return false;

    return email;
  } catch (error) {
    console.log(error);
  }
};

export const setDefaultCloudEmail = async email => {
  if (!email) return;

  try {
    await SecureStorage.setItem(
      defaultCloudEmailKey,
      email,
      ACCESSIBLE.WHEN_UNLOCKED,
    );
  } catch (error) {
    console.log(error);
  }
};

export const loginUser = async ({values, onError}) => {
  try {
    const {data} = await axios.post(`${API_URL}/api/users/log`, values);

    if (!data?.user || !data?.token || data?.error) {
      onError && onError({errorMessage: data?.error});
      return;
    }

    await storeAuthToken(data?.token);
    await setDefaultCloudEmail(data?.user?.email);

    return data;
  } catch (error) {
    if (error?.response?.data?.error) {
      onError && onError({errorMessage: error?.response?.data?.error});
    }

    throw error;
  }
};

export const loginUserViaOTPThruEmail = async ({values, onError}) => {
  try {
    const {data} = await axios.post(
      `${API_URL}/api/verify-otp-and-authenticate`,
      values,
    );

    if (!data?.user || !data?.auth_token || data?.error) {
      onError && onError({errorMessage: data?.error});
      return;
    }

    await storeAuthToken(data?.auth_token);
    await setDefaultCloudEmail(data?.user?.email);

    return data;
  } catch (error) {
    if (error?.response?.data?.error) {
      onError && onError({errorMessage: error?.response?.data?.error});
    }

    throw error;
  }
};

export const getOTPThruEmailToLogin = async () => {
  try {
    let email = await getDefaultCloudEmail();

    if (!email) return false;

    const values = {email, timezone: 'Asia/Manila'};

    const {data} = await axios.post(
      `${API_URL}/api/get-otp-to-authenticate`,
      values,
      {
        headers: await configRequestHeader(),
      },
    );

    if (data && data.success) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.log(error);
  }
};

export const isEmailRegistered = async () => {
  try {
    let email = await getDefaultCloudEmail();

    if (!email) return false;

    const values = {email};

    const {data} = await axios.post(
      `${API_URL}/api/is-email-registered`,
      values,
      {
        headers: await configRequestHeader(),
      },
    );

    if (data && data.email && !data.error) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.log(error);
  }
};

export const signUpUser = async ({values, onError}) => {
  try {
    const {data} = await axios.post(`${API_URL}/api/users/reg`, values);

    if (!data?.user || !data?.token) {
      onError && onError({errorMessage: data?.error});
      return;
    }

    // await storeAuthToken(data?.token);
    await setDefaultCloudEmail(data?.user?.email);

    return data;
  } catch (error) {
    if (error?.response?.data?.error) {
      onError && onError({errorMessage: error?.response?.data?.error});
    }

    throw error;
  }
};

export const getLoggedInUser = async () => {
  try {
    const authToken = await getAuthToken();

    if (!authToken) {
      return {authToken, authUser: null};
    }

    const {data} = await axios.get(`${API_URL}/api/users/get-logged-in`, {
      headers: await configRequestHeader(),
    });

    if (!data.payload) {
      return {};
    }

    return {...data, authToken, authUser: data.payload};
  } catch (error) {
    console.log(error);
  }
};
