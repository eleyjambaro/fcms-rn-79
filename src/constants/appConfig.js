import SecureStorage from 'react-native-fast-secure-storage';

import packageJson from '../../package.json';
import {rnStorageKeys} from './rnSecureStorageKeys';
import {verifyLicenseToken} from '../utils/licenseTokenVerifier';
import {env} from '../config/env';

export {env};
export const appVersion = packageJson.version;
export const localUserDefaultRoleId = 2; // Encoders

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

const devAppConfig = {
  ...defaultAppConfig,
  insertLimit: 0,
  insertItemLimitPerCategory: 0,
  insertCategoryLimit: 0,
  insertUserLimit: 0,
  /* Data Sync & Backup */
  enableBackupDataLocally: true,
  enableRecoverDataLocally: true,
  enableExportReports: true,
  /* Inventory Data Template */
  enableImportInventoryDataTemplate: true,
  enableExportInventoryDataTemplate: true,
};

export async function getAppConfig() {
  try {
    const hasLicenseToken = await SecureStorage.hasItem(
      rnStorageKeys.licenseToken,
    );
    if (!hasLicenseToken) {
      return env === 'dev' ? devAppConfig : defaultAppConfig;
    }

    const licenseToken = await SecureStorage.getItem(
      rnStorageKeys.licenseToken,
    );
    const {appConfig: appConfigFromLicense} = verifyLicenseToken(licenseToken);

    if (
      !appConfigFromLicense ||
      Object.keys(appConfigFromLicense).length === 0
    ) {
      return defaultAppConfig;
    }

    // Strip undefined keys so they don't shadow the defaults.
    Object.keys(appConfigFromLicense).forEach(key => {
      if (appConfigFromLicense[key] === undefined) {
        delete appConfigFromLicense[key];
      }
    });

    return {
      ...defaultAppConfig,
      ...appConfigFromLicense,
    };
  } catch (error) {
    // verifyLicenseToken throws when the signature/iss/aud/exp are invalid,
    // and when the token is malformed. In all cases the user is not entitled
    // to the upgraded config — fall back to the free tier.
    console.debug(error);
    return defaultAppConfig;
  }
}

export default getAppConfig;
