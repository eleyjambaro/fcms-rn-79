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

export const registerDevice = async ({device_name, physical_device_id, device_fingerprint}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/devices/register',
    {device_name, physical_device_id, device_fingerprint},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const assignBranch = async ({device_id, branch_id, force_reassign = false}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/devices/assign-branch',
    {device_id, branch_id, force_reassign},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const getDeviceMe = async () => {
  const {data} = await cloudApiV2.get('/api/v2/devices/me', {
    headers: await getAuthHeaders(),
  });
  return data;
};

export const lookupBranch = async device_id => {
  const {data} = await cloudApiV2.get('/api/v2/devices/lookup-branch', {
    params: {device_id},
    headers: await getAuthHeaders(),
  });
  return data;
};
