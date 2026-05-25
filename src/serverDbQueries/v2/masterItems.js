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
 * Root-only. Updates editable fields on a master item by id. Changing sku,
 * description, or any of the 5 variant-defining fields (barcode, uom_abbrev,
 * uom_abbrev_per_piece, qty_per_piece, packaging_type) mirrors the new value
 * to every linked items row in the company via the server's update mirror.
 * Server returns 403 for non-root, 409 on SKU collision.
 */
export const updateMasterItem = async ({
  id,
  sku,
  description,
  barcode,
  uom_abbrev,
  uom_abbrev_per_piece,
  qty_per_piece,
  packaging_type,
}) => {
  const body = {};
  if (sku !== undefined) body.sku = sku;
  if (description !== undefined) body.description = description;
  if (barcode !== undefined) body.barcode = barcode;
  if (uom_abbrev !== undefined) body.uom_abbrev = uom_abbrev;
  if (uom_abbrev_per_piece !== undefined)
    body.uom_abbrev_per_piece = uom_abbrev_per_piece;
  if (qty_per_piece !== undefined) body.qty_per_piece = qty_per_piece;
  if (packaging_type !== undefined) body.packaging_type = packaging_type;
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
