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

/**
 * Reconcile an account's branch assignments to exactly `branch_ids`: fetches the
 * current assignments, creates the ones that are newly selected, and deletes the
 * ones that were unselected. Works for both newly created accounts (no current
 * assignments → creates all) and existing accounts (applies the delta).
 */
export const syncCloudBranchAccountAssignments = async ({
  account_id,
  branch_ids = [],
}) => {
  const desired = new Set(branch_ids);
  const response = await getCloudBranchAccountAssignments({account_id});
  const current = response?.data ?? [];
  const currentBranchIds = new Set(current.map(a => a.branch_id));

  const toAdd = [...desired].filter(branchId => !currentBranchIds.has(branchId));
  const toRemove = current.filter(a => !desired.has(a.branch_id));

  await Promise.all([
    ...toAdd.map(branch_id =>
      createCloudBranchAccountAssignment({branch_id, account_id}),
    ),
    ...toRemove.map(a => deleteCloudBranchAccountAssignment(a.id)),
  ]);
};
