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

// Pass `all: true` to bypass branch-assignment scoping and list EVERY branch in
// the company. This is for counterparty pickers (e.g. Batch Transfer Source /
// Destination) where any branch is a valid send/receive target regardless of
// which branches the caller operates in. The default (scoped) list is what the
// post-login "which branch do I operate in" picker uses.
export const getBranches = async ({page = 1, per_page = 50, all = false} = {}) => {
  const {data} = await cloudApiV2.get('/api/v2/branches', {
    params: {page, per_page, ...(all ? {all: true} : {})},
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

export const updateBranch = async ({id, ...values}) => {
  const {data} = await cloudApiV2.put(`/api/v2/branches/${id}`, values, {
    headers: await getAuthHeaders(),
  });
  return data;
};

// Password-gated OTP send for branch deletion. The server verifies the password
// and emails a fresh code (so a wrong password never sends one); deleteBranch
// below re-checks both password + OTP. Mirrors the account-deletion flow.
export const requestBranchDeleteOtp = async ({id, password}) => {
  const {data} = await cloudApiV2.post(
    `/api/v2/branches/${id}/delete/send-otp`,
    {password},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const deleteBranch = async ({id, password, otp, request_id}) => {
  const {data} = await cloudApiV2.delete(`/api/v2/branches/${id}`, {
    headers: await getAuthHeaders(),
    data: {password, otp, request_id},
  });
  return data;
};
