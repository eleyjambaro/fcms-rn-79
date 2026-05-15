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

export const getCloudSubAccounts = async () => {
  const {data} = await cloudApiV2.get('/api/v2/accounts', {
    headers: await getAuthHeaders(),
  });
  return data;
};

export const createCloudSubAccount = async values => {
  const {data} = await cloudApiV2.post('/api/v2/accounts', values, {
    headers: await getAuthHeaders(),
  });
  return data;
};

export const updateCloudSubAccount = async ({id, ...values}) => {
  const {data} = await cloudApiV2.put(`/api/v2/accounts/${id}`, values, {
    headers: await getAuthHeaders(),
  });
  return data;
};

export const deleteCloudSubAccount = async id => {
  const {data} = await cloudApiV2.delete(`/api/v2/accounts/${id}`, {
    headers: await getAuthHeaders(),
  });
  return data;
};
