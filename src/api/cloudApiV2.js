import axios from 'axios';

import {cloudApiV2BaseUrl} from '../config/env';

const cloudApiV2 = axios.create({
  baseURL: cloudApiV2BaseUrl,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

// Handler invoked when an authenticated request comes back 401 (token revoked
// or invalidated server-side). Registered by CloudAuthContextProvider so the
// app can surface a "session expired" prompt and drop to sign-in instead of
// silently 401-ing on every subsequent call. The handler itself guards against
// 401s that are NOT from an authenticated session (e.g. a wrong password on the
// sign-in screen), so it's safe to fire for every 401.
let onUnauthorized = null;
export const setOnUnauthorized = handler => {
  onUnauthorized = handler;
};

cloudApiV2.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401 && typeof onUnauthorized === 'function') {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export default cloudApiV2;
