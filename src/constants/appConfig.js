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

const freeTierAppConfig = () => (env === 'dev' ? devAppConfig : defaultAppConfig);

const readDesignatedBranchId = async () => {
  try {
    const has = await SecureStorage.hasItem(
      rnStorageKeys.cloudV2DesignatedBranch,
    );
    if (!has) {
      return null;
    }
    const raw = await SecureStorage.getItem(
      rnStorageKeys.cloudV2DesignatedBranch,
    );
    return raw ? JSON.parse(raw)?.id ?? null : null;
  } catch {
    return null;
  }
};

export async function getAppConfig() {
  try {
    const hasLicenseToken = await SecureStorage.hasItem(
      rnStorageKeys.licenseToken,
    );
    if (!hasLicenseToken) {
      return freeTierAppConfig();
    }

    const licenseToken = await SecureStorage.getItem(
      rnStorageKeys.licenseToken,
    );
    const {payload, appConfig: appConfigFromLicense} =
      verifyLicenseToken(licenseToken);

    // Entitlement is PER-BRANCH. Even with a valid token, the upgraded config
    // only applies on a branch the license was activated on; on any other
    // branch the user gets the free tier (the license gate is prompted).
    const currentBranchId = await readDesignatedBranchId();
    const allowedBranchIds = payload?.allowed_branch_ids ?? [];
    if (!currentBranchId || !allowedBranchIds.includes(currentBranchId)) {
      return freeTierAppConfig();
    }

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
