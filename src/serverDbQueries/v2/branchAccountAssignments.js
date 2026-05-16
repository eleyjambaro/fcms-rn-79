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

export const getCloudBranchAccountAssignments = async (params = {}) => {
  const {data} = await cloudApiV2.get('/api/v2/branch-account-assignments', {
    params,
    headers: await getAuthHeaders(),
  });
  return data;
};

export const createCloudBranchAccountAssignment = async ({branch_id, account_id}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/branch-account-assignments',
    {branch_id, account_id},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const deleteCloudBranchAccountAssignment = async id => {
  const {data} = await cloudApiV2.delete(`/api/v2/branch-account-assignments/${id}`, {
    headers: await getAuthHeaders(),
  });
  return data;
};
