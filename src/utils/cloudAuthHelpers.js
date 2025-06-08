import AsyncStorage from '@react-native-async-storage/async-storage';
import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';
import {rnStorageKeys} from '../constants/rnSecureStorageKeys';

export const storeAuthToken = async authToken => {
  try {
    if (!authToken) throw Error('authToken param missing');

    // await AsyncStorage.setItem('token', authToken);

    /**
     * Save auth token to storage
     */
    await SecureStorage.setItem(
      rnStorageKeys.cloudAuthToken,
      authToken,
      ACCESSIBLE.WHEN_UNLOCKED,
    );
  } catch (error) {
    throw error;
  }
};

export const getAuthToken = async () => {
  try {
    // const authToken = await AsyncStorage.getItem('token');

    let authToken = null;

    const hasAuthToken = await SecureStorage.hasItem('cloudAuthToken');

    if (hasAuthToken) {
      authToken = await SecureStorage.getItem('cloudAuthToken');
    }

    return authToken;
  } catch (error) {
    throw error;
  }
};

export const removeAuthToken = async () => {
  try {
    const hasAuthToken = await SecureStorage.hasItem('cloudAuthToken');

    if (hasAuthToken) {
      await SecureStorage.removeItem('cloudAuthToken');
    }
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const configRequestHeader = async () => {
  let headers = {};

  const authToken = await getAuthToken();

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  return headers;
};
