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

export const signUp = async values => {
  const {data} = await cloudApiV2.post('/api/v2/auth/signup', values);
  return data;
};

export const signIn = async values => {
  const {data} = await cloudApiV2.post('/api/v2/auth/signin', values);
  return data;
};

export const requestOtp = async email => {
  const {data} = await cloudApiV2.post('/api/v2/auth/request-otp', {email});
  return data;
};

export const verifyOtp = async ({email, otp, request_id}) => {
  const {data} = await cloudApiV2.post('/api/v2/auth/verify-otp', {
    email,
    otp,
    request_id,
  });
  return data;
};

export const getMe = async () => {
  const {data} = await cloudApiV2.get('/api/v2/auth/me', {
    headers: await getAuthHeaders(),
  });
  return data;
};

export const logout = async () => {
  const {data} = await cloudApiV2.post(
    '/api/v2/auth/logout',
    {},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const deleteMyCloudAccount = async ({password}) => {
  const {data} = await cloudApiV2.delete('/api/v2/auth/delete-account', {
    headers: await getAuthHeaders(),
    data: {password},
  });
  return data;
};
