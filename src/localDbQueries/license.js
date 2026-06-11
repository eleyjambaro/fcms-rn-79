import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';

import {
  rnStorageKeys,
  branchLicenseKeyStorageKey,
  branchLicenseTokenStorageKey,
} from '../constants/rnSecureStorageKeys';
import {
  activateLicense as activateLicenseApi,
  addLicenseBranch as addLicenseBranchApi,
  addLicenseDevice as addLicenseDeviceApi,
  refreshLicense as refreshLicenseApi,
} from '../serverDbQueries/v2/licenses';
import {
  decodeLicenseTokenUnsafe,
  verifyLicenseToken,
} from '../utils/licenseTokenVerifier';

const HIDDEN_PREFIX = 'XXXXXXXX-XXXX-XXXX-XXXX-';

const maskLicenseKey = key =>
  key ? HIDDEN_PREFIX + key.substring(HIDDEN_PREFIX.length) : null;

const readSecureItem = async key => {
  const has = await SecureStorage.hasItem(key);
  return has ? await SecureStorage.getItem(key) : null;
};

const readDesignatedBranchId = async () => {
  const raw = await readSecureItem(rnStorageKeys.cloudV2DesignatedBranch);
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.id ?? null;
  } catch {
    return null;
  }
};

// ============================================================================
// Storage primitives
//
// License key + token are stored PER BRANCH (keyed by branch id) so a company
// can activate a different license key on each of its branches. The read path
// prefers the current branch's slot and falls back to the legacy single slot
// for users who activated before per-branch storage existed. Writes always go
// to the per-branch slot.
// ============================================================================

const removeSecureItem = async key => {
  if (await SecureStorage.hasItem(key)) {
    await SecureStorage.removeItem(key);
  }
};

// Read the license key for a branch, falling back to the legacy single slot.
const readBranchLicenseKey = async branchId => {
  if (branchId) {
    const perBranch = await readSecureItem(branchLicenseKeyStorageKey(branchId));
    if (perBranch) return perBranch;
  }
  return await readSecureItem(rnStorageKeys.licenseKey);
};

// Read the license token for a branch, falling back to the legacy single slot.
const readBranchLicenseToken = async branchId => {
  if (branchId) {
    const perBranch = await readSecureItem(
      branchLicenseTokenStorageKey(branchId),
    );
    if (perBranch) return perBranch;
  }
  return await readSecureItem(rnStorageKeys.licenseToken);
};

export const hasLicenseKey = async () => {
  const branchId = await readDesignatedBranchId();
  const key = await readBranchLicenseKey(branchId);
  return {result: !!key};
};

export const getLicenseKey = async ({queryKey}) => {
  const [, {returnCompleteKey = false} = {}] = queryKey ?? ['licenseKey', {}];
  const branchId = await readDesignatedBranchId();
  const raw = await readBranchLicenseKey(branchId);
  return {result: raw ? (returnCompleteKey ? raw : maskLicenseKey(raw)) : null};
};

export const saveLicenseKey = async (licenseKey, branchId) => {
  if (!licenseKey) throw new Error('Missing licenseKey parameter');
  await SecureStorage.setItem(
    branchLicenseKeyStorageKey(branchId),
    licenseKey,
    ACCESSIBLE.WHEN_UNLOCKED,
  );
};

export const removeLicenseKey = async branchId => {
  await removeSecureItem(branchLicenseKeyStorageKey(branchId));
};

export const saveLicenseToken = async (token, branchId) => {
  if (!token) throw new Error('Missing license token');
  await SecureStorage.setItem(
    branchLicenseTokenStorageKey(branchId),
    token,
    ACCESSIBLE.WHEN_UNLOCKED,
  );
};

export const removeLicenseToken = async branchId => {
  await removeSecureItem(branchLicenseTokenStorageKey(branchId));
};

// ============================================================================
// Status read (used by react-query)
// ============================================================================

export const getLicenseStatus = async ({queryKey} = {queryKey: ['licenseStatus', {}]}) => {
  try {
    const [, {returnCompleteKey = false} = {}] = queryKey;

    const currentBranchId = await readDesignatedBranchId();
    let licenseKey = await readBranchLicenseKey(currentBranchId);
    const licenseToken = await readBranchLicenseToken(currentBranchId);
    const currentDeviceId = await readSecureItem(rnStorageKeys.cloudV2DeviceId);

    let appConfigFromLicense = null;
    let metadata = {};
    let isLicenseExpired = true;
    let allowedDeviceIds = [];
    let allowedBranchIds = [];
    let maxDevices = 0;
    let maxBranches = 0;
    let plan = null;

    if (licenseToken) {
      let payload = null;
      let appConfig = null;
      let strictOk = false;

      try {
        ({payload, appConfig} = verifyLicenseToken(licenseToken));
        strictOk = true;
      } catch (verifyErr) {
        // Strict verify failed — try unsafe decode so the screen can show
        // an "expired" state instead of a generic error. Tampered or
        // foreign-key tokens still end up here and stay marked expired.
        try {
          ({payload} = decodeLicenseTokenUnsafe(licenseToken));
        } catch {
          payload = null;
        }
      }

      if (payload) {
        const expSec = payload.exp;
        const expirationDate = expSec ? new Date(expSec * 1000) : null;

        metadata = {
          expirationDateInMs: expSec ? expSec * 1000 : null,
          expirationDate,
        };

        if (strictOk && expirationDate && expirationDate > new Date()) {
          isLicenseExpired = false;
        }

        appConfigFromLicense = appConfig ?? null;
        allowedDeviceIds = payload.allowed_device_ids ?? [];
        allowedBranchIds = payload.allowed_branch_ids ?? [];
        maxDevices = payload.max_devices ?? 0;
        maxBranches = payload.max_branches ?? 0;
        plan = payload.plan ?? null;
      }
    }

    if (licenseKey && !returnCompleteKey) {
      licenseKey = maskLicenseKey(licenseKey);
    }

    // Entitlement is PER-DEVICE *and* PER-BRANCH: a valid, non-expired token
    // only grants full (licensed) access when BOTH the current device is in
    // the license's device allowlist AND the current branch is in its branch
    // allowlist. On any unlicensed device or branch the app falls back to the
    // free tier and the license gate is prompted — even though a token exists.
    // The user is free to sign in/out, switch accounts, create and switch
    // branches; they activate the license per device (up to maxDevices) and
    // per branch (up to maxBranches).
    const tokenUsable = !!licenseToken && !isLicenseExpired;
    const isCurrentDeviceLicensed =
      tokenUsable && !!currentDeviceId && allowedDeviceIds.includes(currentDeviceId);
    const isCurrentBranchLicensed =
      tokenUsable && !!currentBranchId && allowedBranchIds.includes(currentBranchId);
    const isCurrentlyLicensed =
      isCurrentDeviceLicensed && isCurrentBranchLicensed;

    return {
      result: {
        hasLicenseKey: !!licenseKey,
        licenseKey,
        hasLicenseToken: !!licenseToken,
        licenseToken,
        isLicenseExpired,
        appConfigFromLicense,
        metadata,
        allowedDeviceIds,
        allowedBranchIds,
        maxDevices,
        maxBranches,
        plan,
        currentBranchId,
        currentDeviceId,
        isCurrentDeviceLicensed,
        isCurrentBranchLicensed,
        isCurrentlyLicensed,
      },
    };
  } catch (error) {
    console.debug(error);
    throw new Error('Failed to get license status.');
  }
};

// ============================================================================
// Mutations against the FCMS API
// ============================================================================

const unwrapApiError = error => {
  const apiMessage = error?.response?.data?.message;
  return apiMessage ? new Error(apiMessage) : error;
};

const requireDeviceAndBranch = async () => {
  const deviceId = await readSecureItem(rnStorageKeys.cloudV2DeviceId);
  if (!deviceId) {
    throw new Error('Device is not registered. Sign in and register the device first.');
  }

  const branchId = await readDesignatedBranchId();
  if (!branchId) {
    throw new Error('No designated branch. Select a branch first.');
  }

  return {deviceId, branchId};
};

export const activateLicense = async ({values}) => {
  const licenseKey = values?.license_key;
  if (!licenseKey) throw new Error('License key is required.');

  const {deviceId, branchId} = await requireDeviceAndBranch();

  let response;
  try {
    response = await activateLicenseApi({
      license_key: licenseKey,
      device_id: deviceId,
      branch_id: branchId,
    });
  } catch (error) {
    throw unwrapApiError(error);
  }

  const token = response?.data?.token;
  if (!token) throw new Error('Activation succeeded but no token was returned.');

  // Local sanity check: confirm the issued token verifies under the bundled
  // public key. If this throws, the client and server keypairs are mismatched
  // — surface that early instead of letting it look like a generic gate failure.
  verifyLicenseToken(token);

  // Store under the branch this key was activated for. Activating a different
  // key on this same branch replaces this branch's stored key/token; other
  // branches' slots are untouched.
  await saveLicenseKey(licenseKey, branchId);
  await saveLicenseToken(token, branchId);

  return response.data;
};

export const refreshLicense = async () => {
  const deviceId = await readSecureItem(rnStorageKeys.cloudV2DeviceId);
  if (!deviceId) throw new Error('Device is not registered.');

  const branchId = await readDesignatedBranchId();

  let response;
  try {
    response = await refreshLicenseApi({device_id: deviceId, branch_id: branchId});
  } catch (error) {
    throw unwrapApiError(error);
  }

  const token = response?.data?.token;
  if (token) {
    verifyLicenseToken(token);
    await saveLicenseToken(token, branchId);
  }
  return response.data;
};

export const addLicenseDevice = async () => {
  const deviceId = await readSecureItem(rnStorageKeys.cloudV2DeviceId);
  if (!deviceId) throw new Error('Device is not registered.');

  const branchId = await readDesignatedBranchId();

  let response;
  try {
    response = await addLicenseDeviceApi({device_id: deviceId});
  } catch (error) {
    throw unwrapApiError(error);
  }

  const token = response?.data?.token;
  if (token) {
    verifyLicenseToken(token);
    await saveLicenseToken(token, branchId);
  }
  return response.data;
};

export const addLicenseBranch = async ({branchId} = {}) => {
  const deviceId = await readSecureItem(rnStorageKeys.cloudV2DeviceId);
  if (!deviceId) throw new Error('Device is not registered.');

  const targetBranch = branchId ?? (await readDesignatedBranchId());
  if (!targetBranch) throw new Error('No branch specified.');

  let response;
  try {
    response = await addLicenseBranchApi({
      branch_id: targetBranch,
      device_id: deviceId,
    });
  } catch (error) {
    throw unwrapApiError(error);
  }

  const token = response?.data?.token;
  if (token) {
    verifyLicenseToken(token);
    await saveLicenseToken(token, targetBranch);
  }
  return response.data;
};
