import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';
import {sign, decode} from 'react-native-pure-jwt';
import DeviceInfo from 'react-native-device-info';
import packageJson from '../../package.json';

import {createNewOrGetDeviceImplantedUniqueId} from '../constants/deviceImplantedUniqueIdConfig';

export const env = 'prod'; // change to 'dev' manualy when on development mode
export const appVersion = packageJson.version;
export const localUserDefaultRoleId = 2; // Encoder

export const defaultAppConfig = {
  version: appVersion,
  insertLimit: 4,
  insertItemLimitPerCategory: 3,
  insertCategoryLimit: 4,
  insertUserLimit: 0,
  /* Data Sync & Backup */
  enableBackupDataLocally: true,
  enableRecoverDataLocally: false,
  enableExportReports: false,
  /* Inventory Data Template */
  enableImportInventoryDataTemplate: true,
  enableExportInventoryDataTemplate: true,
};

export async function getAppConfig() {
  try {
    let licenseToken = null;

    const hasLicenseToken = await SecureStorage.hasItem('licenseToken');

    if (hasLicenseToken) {
      licenseToken = await SecureStorage.getItem('licenseToken');
    }

    if (!licenseToken) {
      return defaultAppConfig;
    }

    const parsedLicenseToken = JSON.parse(licenseToken);
    const {lt: token, kp: keyPair} = parsedLicenseToken;

    const diuid = await createNewOrGetDeviceImplantedUniqueId();
    let secretKey = diuid + keyPair;

    // decode token
    const {payload} = await decode(
      token, // the token
      secretKey, // the secret
      {
        skipValidation: false, // to skip signature and exp verification
      },
    );

    const appConfigFromLicense = payload?.appConfig;

    if (appConfigFromLicense && Object.keys(appConfigFromLicense).length > 0) {
      // remove all undefined keys inside app config from license
      Object.keys(appConfigFromLicense).forEach(
        key =>
          appConfigFromLicense[key] === undefined &&
          delete appConfigFromLicense[key],
      );

      return {
        ...defaultAppConfig,
        // override default app config
        ...appConfigFromLicense,
      };
    } else {
      return defaultAppConfig;
    }
  } catch (error) {
    /**
     * react-native-pure-jwt error codes (v3.0.2):
     * - error.code === '3': The JWT is expired.
     * - error.code === '6': Invalid signature (or secret key).
     */
    console.debug(error);

    return defaultAppConfig;
  }
}

export default getAppConfig;
