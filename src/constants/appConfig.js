import SecureStorage from 'react-native-fast-secure-storage';

import packageJson from '../../package.json';
import {
  rnStorageKeys,
  branchLicenseTokenStorageKey,
} from './rnSecureStorageKeys';
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
    // License key + token are stored per branch (a company may activate a
    // different key on each branch). Read the current branch's token, falling
    // back to the legacy single slot for users who activated before per-branch
    // storage existed.
    const currentBranchId = await readDesignatedBranchId();
    const perBranchTokenKey = branchLicenseTokenStorageKey(currentBranchId);
    let storedTokenKey = null;
    if (currentBranchId && (await SecureStorage.hasItem(perBranchTokenKey))) {
      storedTokenKey = perBranchTokenKey;
    } else if (await SecureStorage.hasItem(rnStorageKeys.licenseToken)) {
      storedTokenKey = rnStorageKeys.licenseToken;
    }

    if (!storedTokenKey) {
      return freeTierAppConfig();
    }

    const licenseToken = await SecureStorage.getItem(storedTokenKey);
    const {payload, appConfig: appConfigFromLicense} =
      verifyLicenseToken(licenseToken);

    // Entitlement is PER-DEVICE and PER-BRANCH. Even with a valid token, the
    // upgraded config only applies when BOTH the current device and the
    // current branch were activated on the license; otherwise the user gets
    // the free tier (the license gate is prompted).
    const currentDeviceId = await SecureStorage.hasItem(
      rnStorageKeys.cloudV2DeviceId,
    )
      ? await SecureStorage.getItem(rnStorageKeys.cloudV2DeviceId)
      : null;
    const allowedDeviceIds = payload?.allowed_device_ids ?? [];
    const allowedBranchIds = payload?.allowed_branch_ids ?? [];
    if (
      !currentDeviceId ||
      !allowedDeviceIds.includes(currentDeviceId) ||
      !currentBranchId ||
      !allowedBranchIds.includes(currentBranchId)
    ) {
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
