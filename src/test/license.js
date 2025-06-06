import DeviceInfo from 'react-native-device-info';
import {sign, decode} from 'react-native-pure-jwt';
import RNSecureStorage, {ACCESSIBLE} from 'rn-secure-storage';
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

    await RNSecureStorage.set('licenseToken', licenseToken, {
      accessible: ACCESSIBLE.WHEN_UNLOCKED,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const removeLicenseToken = async () => {
  try {
    const hasLicenseToken = await RNSecureStorage.exists('licenseToken');

    if (hasLicenseToken) {
      await RNSecureStorage.remove('licenseToken');
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const saveLicenseKey = async () => {
  try {
    const licenseKey = uuid.v4();

    await RNSecureStorage.set('licenseKey', licenseKey, {
      accessible: ACCESSIBLE.WHEN_UNLOCKED,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const removeLicenseKey = async () => {
  try {
    const hasLicenseKey = await RNSecureStorage.exists('licenseKey');

    if (hasLicenseKey) {
      await RNSecureStorage.remove('licenseKey');
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};
