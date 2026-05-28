import cloudApiV2 from '../../api/cloudApiV2';
import SecureStorage from 'react-native-fast-secure-storage';
import {rnStorageKeys} from '../../constants/rnSecureStorageKeys';

const getAuthHeaders = async () => {
  try {
    const hasToken = await SecureStorage.hasItem(rnStorageKeys.cloudV2AuthToken);
    if (!hasToken) {return {};}
    const token = await SecureStorage.getItem(rnStorageKeys.cloudV2AuthToken);
    return {Authorization: `Bearer ${token}`};
  } catch {
    return {};
  }
};

export const activateLicense = async ({license_key, device_id, branch_id}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/licenses/activate',
    {license_key, device_id, branch_id},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const getLicenseMe = async ({device_id}) => {
  const {data} = await cloudApiV2.get('/api/v2/licenses/me', {
    params: {device_id},
    headers: await getAuthHeaders(),
  });
  return data;
};

export const addLicenseDevice = async ({device_id}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/licenses/add-device',
    {device_id},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const addLicenseBranch = async ({branch_id, device_id}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/licenses/add-branch',
    {branch_id, device_id},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const refreshLicense = async ({device_id}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/licenses/refresh',
    {device_id},
    {headers: await getAuthHeaders()},
  );
  return data;
};
