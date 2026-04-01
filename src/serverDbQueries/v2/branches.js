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

export const getBranches = async ({page = 1, per_page = 50} = {}) => {
  const {data} = await cloudApiV2.get('/api/v2/branches', {
    params: {page, per_page},
    headers: await getAuthHeaders(),
  });
  return data;
};

export const createBranch = async ({name, address}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/branches',
    {name, address},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const getBranch = async id => {
  const {data} = await cloudApiV2.get(`/api/v2/branches/${id}`, {
    headers: await getAuthHeaders(),
  });
  return data;
};
