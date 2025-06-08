import DeviceInfo from 'react-native-device-info';
import {sign, decode} from 'react-native-pure-jwt';
import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';
import uuid from 'react-native-uuid';

/**
 * Data from client
 */
const deviceUniqueId = DeviceInfo.getUniqueIdSync();

export const generateLicenseToken = async () => {
  try {
    const licenseTokenPayload = {
      exp: new Date().getTime() + 1000 * 60 * 3, // 3 mins expiration token test
      appConfig: {
        insertLimit: 0,
        insertItemLimitPerCategory: 0,
        insertCategoryLimit: 0,
        insertUserLimit: 0,
      },
    };

    const keyPair = uuid.v4();

    const licenseToken = await sign(
      licenseTokenPayload,
      deviceUniqueId + keyPair, // secret
      {
        alg: 'HS256',
      },
    );

    return `${licenseToken}__kp__${keyPair}`;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const saveLicenseToken = async () => {
  try {
    const licenseToken = await generateLicenseToken();

    await SecureStorage.setItem(
      'licenseToken',
      licenseToken,
      ACCESSIBLE.WHEN_UNLOCKED,
    );
  } catch (error) {
    console.error(error);
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
    console.error(error);
    throw error;
  }
};

export const saveLicenseKey = async () => {
  try {
    const licenseKey = uuid.v4();

    await SecureStorage.setItem(
      'licenseKey',
      licenseKey,
      ACCESSIBLE.WHEN_UNLOCKED,
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const removeLicenseKey = async () => {
  try {
    const hasLicenseKey = await SecureStorage.hasItem('licenseKey');

    if (hasLicenseKey) {
      await SecureStorage.removeItem('licenseKey');
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};
