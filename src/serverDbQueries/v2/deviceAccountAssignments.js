import cloudApiV2 from '../../api/cloudApiV2';
import SecureStorage from 'react-native-fast-secure-storage';
import {rnStorageKeys} from '../../constants/rnSecureStorageKeys';

const getAuthHeaders = async () => {
  try {
    const hasToken = await SecureStorage.hasItem(rnStorageKeys.cloudV2AuthToken);
    if (!hasToken) return {};
    const token = await SecureStorage.getItem(rnStorageKeys.cloudV2AuthToken);
    return {Authorization: `Bearer ${token}`};
  } catch {
    return {};
  }
};

export const getCloudDeviceAccountAssignments = async (params = {}) => {
  const {data} = await cloudApiV2.get('/api/v2/device-account-assignments', {
    params,
    headers: await getAuthHeaders(),
  });
  return data;
};

export const createCloudDeviceAccountAssignment = async ({device_id, account_id}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/device-account-assignments',
    {device_id, account_id},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const batchAssignDeviceAccounts = async ({device_id, account_ids}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/device-account-assignments/batch',
    {device_id, account_ids},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const deleteCloudDeviceAccountAssignment = async id => {
  const {data} = await cloudApiV2.delete(`/api/v2/device-account-assignments/${id}`, {
    headers: await getAuthHeaders(),
  });
  return data;
};

/**
 * Reconcile an account's device assignments to exactly `device_ids`: fetches the
 * current assignments, creates the ones that are newly selected, and deletes the
 * ones that were unselected. Works for both newly created accounts (no current
 * assignments → creates all) and existing accounts (applies the delta).
 */
export const syncCloudDeviceAccountAssignments = async ({
  account_id,
  device_ids = [],
}) => {
  const desired = new Set(device_ids);
  const response = await getCloudDeviceAccountAssignments({account_id});
  const current = response?.data ?? [];
  const currentDeviceIds = new Set(current.map(a => a.device_id));

  const toAdd = [...desired].filter(deviceId => !currentDeviceIds.has(deviceId));
  const toRemove = current.filter(a => !desired.has(a.device_id));

  await Promise.all([
    ...toAdd.map(device_id =>
      createCloudDeviceAccountAssignment({device_id, account_id}),
    ),
    ...toRemove.map(a => deleteCloudDeviceAccountAssignment(a.id)),
  ]);
};
