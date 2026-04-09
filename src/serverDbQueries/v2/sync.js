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

/**
 * Push a delta payload to the server.
 *
 * @param {Object} payload
 * @param {string} payload.device_id   - Cloud device UUID
 * @param {string} payload.branch_id   - Cloud branch UUID
 * @param {string} payload.pushed_at   - ISO8601 timestamp
 * @param {Object} payload.delta       - { entityKey: [records...], ... }
 * @returns {Promise<Object>}          - { accepted, conflicts, synced_at }
 */
export const pushDelta = async ({device_id, branch_id, pushed_at, delta}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/sync/push',
    {device_id, branch_id, pushed_at, delta},
    {headers: await getAuthHeaders()},
  );
  return data;
};

/**
 * Pull delta from the server for Group A master data.
 *
 * @param {Object} params
 * @param {string} params.since      - ISO8601 watermark (last_pulled_at)
 * @param {string} params.branch_id  - Cloud branch UUID
 * @param {string} params.device_id  - Cloud device UUID (sent as header to suppress echo)
 * @returns {Promise<Object>}        - { pulled_at, delta }
 */
export const pullDelta = async ({since, branch_id, device_id}) => {
  const headers = {
    ...(await getAuthHeaders()),
    ...(device_id ? {'X-Device-Id': device_id} : {}),
  };
  const {data} = await cloudApiV2.get('/api/v2/sync/pull', {
    params: {since, branch_id},
    headers,
  });
  return data;
};

/**
 * Get server-side record counts per entity for a branch (debug/health-check).
 *
 * @param {string} branch_id
 * @returns {Promise<Object>}  - { branch_id, counts, as_of }
 */
export const getSyncStatus = async branch_id => {
  const {data} = await cloudApiV2.get('/api/v2/sync/status', {
    params: {branch_id},
    headers: await getAuthHeaders(),
  });
  return data;
};
