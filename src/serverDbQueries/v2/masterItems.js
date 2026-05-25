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
