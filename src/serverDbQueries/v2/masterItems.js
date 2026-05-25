import cloudApiV2 from '../../api/cloudApiV2';
import SecureStorage from 'react-native-fast-secure-storage';
import {rnStorageKeys} from '../../constants/rnSecureStorageKeys';

const getAuthHeaders = async () => {
  try {
    const hasToken = await SecureStorage.hasItem(
      rnStorageKeys.cloudV2AuthToken,
    );
    if (!hasToken) return {};
    const token = await SecureStorage.getItem(rnStorageKeys.cloudV2AuthToken);
    return {Authorization: `Bearer ${token}`};
  } catch {
    return {};
  }
};

/**
 * Paginated master item list. React Query useInfiniteQuery passes `pageParam`;
 * the caller's `getNextPageParam` should derive next-page from `pagination`.
 *
 * Returns the raw envelope `{status, data, pagination}` so callers can use
 * both `data.data` (list) and `data.pagination`.
 */
export const getMasterItems = async ({pageParam = 1, queryKey}) => {
  const [, {q = '', perPage = 20} = {}] = queryKey ?? [];
  const {data} = await cloudApiV2.get('/api/v2/master-items', {
    params: {
      page: pageParam,
      per_page: perPage,
      ...(q ? {q} : {}),
    },
    headers: await getAuthHeaders(),
  });
  return data;
};

/**
 * Root-only. Updates SKU and/or description on a master item by id.
 * Server returns 403 for non-root, 409 on SKU collision.
 */
export const updateMasterItem = async ({id, sku, description}) => {
  const body = {};
  if (sku !== undefined) body.sku = sku;
  if (description !== undefined) body.description = description;
  const {data} = await cloudApiV2.put(`/api/v2/master-items/${id}`, body, {
    headers: await getAuthHeaders(),
  });
  return data;
};

/**
 * Root-only soft-delete. Server returns 403 for non-root and 409 if any
 * non-deleted branch item still references the SKU (referencing_count in
 * the error body).
 */
export const deleteMasterItem = async id => {
  const {data} = await cloudApiV2.delete(`/api/v2/master-items/${id}`, {
    headers: await getAuthHeaders(),
  });
  return data;
};
