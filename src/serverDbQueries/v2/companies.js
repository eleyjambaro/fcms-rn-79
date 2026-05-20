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

export const getCloudCompany = async () => {
  const {data} = await cloudApiV2.get('/api/v2/company', {
    headers: await getAuthHeaders(),
  });
  return data;
};

export const updateCloudCompany = async values => {
  const {data} = await cloudApiV2.put('/api/v2/company', values, {
    headers: await getAuthHeaders(),
  });
  return data;
};

export const uploadCloudCompanyLogo = async ({fileUri, fileName, mimeType}) => {
  const authHeaders = await getAuthHeaders();
  const formData = new FormData();
  formData.append('logo', {
    uri: fileUri,
    name: fileName || 'logo.jpg',
    type: mimeType || 'image/jpeg',
  });

  const {data} = await cloudApiV2.post('/api/v2/company/logo', formData, {
    headers: {
      ...authHeaders,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};
