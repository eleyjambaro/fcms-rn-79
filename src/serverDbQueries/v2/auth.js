import cloudApiV2 from '../../api/cloudApiV2';
import SecureStorage from 'react-native-fast-secure-storage';
import {rnStorageKeys} from '../../constants/rnSecureStorageKeys';
import deviceInfo from '../../lib/deviceInfo';

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

// Stable per-install client identifier sent on auth requests. The server uses it
// as the Sanctum token name and rotates only THIS client's token on sign-in, so
// the mobile app and the web app (and other devices) keep independent sessions
// instead of logging each other out. Derived from the physical device id, which
// is available even before device registration. Best-effort: when unavailable
// the field is omitted and the server falls back to a shared token name.
const getClientId = async () => {
  try {
    const physicalId = await deviceInfo.getPhysicalDeviceId();
    return physicalId ? `mobile:${physicalId}` : undefined;
  } catch {
    return undefined;
  }
};

export const signUp = async values => {
  const client_id = await getClientId();
  const {data} = await cloudApiV2.post('/api/v2/auth/signup', {...values, client_id});
  return data;
};

export const signIn = async values => {
  const client_id = await getClientId();
  const {data} = await cloudApiV2.post('/api/v2/auth/signin', {...values, client_id});
  return data;
};

export const requestOtp = async email => {
  const {data} = await cloudApiV2.post('/api/v2/auth/request-otp', {email});
  return data;
};

export const verifyOtp = async ({email, otp, request_id}) => {
  const client_id = await getClientId();
  const {data} = await cloudApiV2.post('/api/v2/auth/verify-otp', {
    email,
    otp,
    request_id,
    client_id,
  });
  return data;
};

// First-login onboarding (owner-created accounts: team members + executives).
// Screen 1 — verify the email OTP for an account still pending its first login.
// The account isn't authenticated yet, so email/otp/request_id go in the body
// (no bearer). Returns a short-lived grant_token that unlocks set-password only.
export const onboardingVerifyOtp = async ({email, otp, request_id}) => {
  const {data} = await cloudApiV2.post('/api/v2/auth/onboarding/verify-otp', {
    email,
    otp,
    request_id,
  });
  return data;
};

// Screen 2 — set the member's own password, authenticated by the grant token
// from screen 1 (passed as the bearer, never stored). On success the server
// clears the pending flag and returns a real client token, so the caller can
// establish the session exactly like OTP verify does.
export const onboardingSetPassword = async ({
  grant_token,
  password,
  password_confirmation,
}) => {
  const client_id = await getClientId();
  const {data} = await cloudApiV2.post(
    '/api/v2/auth/onboarding/set-password',
    {password, password_confirmation, client_id},
    {headers: {Authorization: `Bearer ${grant_token}`}},
  );
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

export const requestDeleteAccountOtp = async ({password}) => {
  const {data} = await cloudApiV2.post(
    '/api/v2/auth/delete-account/send-otp',
    {password},
    {headers: await getAuthHeaders()},
  );
  return data;
};

export const deleteMyCloudAccount = async ({password, otp, request_id}) => {
  const {data} = await cloudApiV2.delete('/api/v2/auth/delete-account', {
    headers: await getAuthHeaders(),
    data: {password, otp, request_id},
  });
  return data;
};
