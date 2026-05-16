import React, {useState, useEffect, useReducer, useMemo} from 'react';
import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';

import {CloudAuthContext} from '../types';
import {rnStorageKeys} from '../../constants/rnSecureStorageKeys';
import {invalidateCloudSyncParamsCache, setActiveCompanyDb} from '../../localDb';
import {scheduleSyncSoon} from '../../services/syncService';

const {
  cloudV2AuthToken,
  cloudV2AuthUser,
  cloudV2DeviceId,
  cloudV2DeviceToken,
  cloudV2DeviceCompanyId,
  cloudV2DesignatedBranch,
} = rnStorageKeys;

const saveItem = async (key, value) => {
  if (value === null || value === undefined) {
    const has = await SecureStorage.hasItem(key);
    if (has) await SecureStorage.removeItem(key);
    return;
  }
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  await SecureStorage.setItem(key, serialized, ACCESSIBLE.WHEN_UNLOCKED);
};

const loadItem = async (key, parse = false) => {
  const has = await SecureStorage.hasItem(key);
  if (!has) return null;
  const raw = await SecureStorage.getItem(key);
  if (!raw) return null;
  if (parse) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
};

const clearDeviceFromStorage = async () => {
  await saveItem(cloudV2DeviceId, null);
  await saveItem(cloudV2DeviceToken, null);
  await saveItem(cloudV2DeviceCompanyId, null);
  await saveItem(cloudV2DesignatedBranch, null);
};

const reducer = (prevState, action) => {
  switch (action.type) {
    case 'RESTORE':
      return {
        ...prevState,
        isLoading: false,
        authToken: action.authToken,
        authUser: action.authUser,
        deviceId: action.deviceId,
        deviceToken: action.deviceToken,
        designatedBranch: action.designatedBranch,
      };
    case 'SIGN_IN':
      return {
        ...prevState,
        isLoading: false,
        isSignout: false,
        authToken: action.authToken,
        authUser: action.authUser,
        // clearDevice: root account signing in under a different company
        ...(action.clearDevice
          ? {deviceId: null, deviceToken: null, designatedBranch: null}
          : {}),
      };
    case 'SIGN_UP':
      return {
        ...prevState,
        isLoading: false,
        isSignout: false,
        authToken: action.authToken,
        authUser: action.authUser,
        // New company account — always start fresh device registration
        deviceId: null,
        deviceToken: null,
        designatedBranch: null,
      };
    case 'SIGN_OUT':
      return {
        ...prevState,
        isLoading: false,
        isSignout: true,
        authToken: null,
        authUser: null,
        // deviceId, deviceToken, designatedBranch preserved — device is a
        // company asset; signing out of a personal session must not deregister it
      };
    case 'SWITCH_USER':
      return {
        ...prevState,
        isLoading: false,
        isSignout: true,
        authToken: null,
        authUser: null,
        // deviceId, deviceToken, designatedBranch preserved for sub-account sign-in
      };
    case 'SET_DEVICE_CREDENTIALS':
      return {
        ...prevState,
        deviceId: action.deviceId,
        deviceToken: action.deviceToken,
      };
    case 'SET_DESIGNATED_BRANCH':
      return {
        ...prevState,
        designatedBranch: action.designatedBranch,
      };
  }
};

const initialState = {
  isLoading: true,
  isSignout: false,
  authToken: null,
  authUser: null,
  deviceId: null,
  deviceToken: null,
  designatedBranch: null,
};

const CloudAuthContextProvider = ({children}) => {
  const [expiredAuthTokenDialogVisible, setExpiredAuthTokenDialogVisible] =
    useState(false);

  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const restore = async () => {
      try {
        const authToken = await loadItem(cloudV2AuthToken);
        const authUser = await loadItem(cloudV2AuthUser, true);
        const deviceId = await loadItem(cloudV2DeviceId);
        const deviceToken = await loadItem(cloudV2DeviceToken);
        const designatedBranch = await loadItem(cloudV2DesignatedBranch, true);

        // Activate the company-scoped DB before any component reads local data
        setActiveCompanyDb(authUser?.company?.id ?? null);

        dispatch({
          type: 'RESTORE',
          authToken,
          authUser,
          deviceId,
          deviceToken,
          designatedBranch,
        });
      } catch (error) {
        console.debug('[CloudAuthContextProvider] restore error:', error);
        setActiveCompanyDb(null);
        dispatch({
          type: 'RESTORE',
          authToken: null,
          authUser: null,
          deviceId: null,
          deviceToken: null,
          designatedBranch: null,
        });
      }
    };

    restore();
  }, []);

  const authActions = useMemo(
    () => ({
      signIn: async data => {
        const token = data?.data?.token ?? null;
        const user = data?.data
          ? {account: data.data.account, company: data.data.company}
          : null;
        await saveItem(cloudV2AuthToken, token);
        await saveItem(cloudV2AuthUser, user);

        // Root account sign-in: clear device credentials if the company changed.
        // This forces device registration for a new company while preserving
        // credentials when the same owner signs back in.
        // Sub-account sign-in always preserves device credentials.
        let clearDevice = false;
        if (user?.account?.is_root_account) {
          const storedCompanyId = await loadItem(cloudV2DeviceCompanyId);
          if (storedCompanyId !== user.company?.id) {
            await clearDeviceFromStorage();
            clearDevice = true;
          }
        }

        // Switch to this company's isolated DB file
        setActiveCompanyDb(user?.company?.id ?? null);

        dispatch({type: 'SIGN_IN', authToken: token, authUser: user, clearDevice});
      },

      signUp: async data => {
        const token = data?.data?.token ?? null;
        const user = data?.data
          ? {account: data.data.account, company: data.data.company}
          : null;
        await saveItem(cloudV2AuthToken, token);
        await saveItem(cloudV2AuthUser, user);
        // New company account — always clear any existing device credentials
        await clearDeviceFromStorage();
        // Switch to the new company's isolated DB file
        setActiveCompanyDb(user?.company?.id ?? null);
        dispatch({type: 'SIGN_UP', authToken: token, authUser: user});
      },

      // Called after OTP verify — same shape as signIn, always a root account
      setAuthFromVerify: async data => {
        const token = data?.data?.token ?? null;
        const user = data?.data
          ? {account: data.data.account, company: data.data.company}
          : null;
        await saveItem(cloudV2AuthToken, token);
        await saveItem(cloudV2AuthUser, user);

        const storedCompanyId = await loadItem(cloudV2DeviceCompanyId);
        let clearDevice = false;
        if (storedCompanyId !== user?.company?.id) {
          await clearDeviceFromStorage();
          clearDevice = true;
        }

        // Switch to this company's isolated DB file
        setActiveCompanyDb(user?.company?.id ?? null);

        dispatch({type: 'SIGN_IN', authToken: token, authUser: user, clearDevice});
      },

      signOut: async () => {
        try {
          await saveItem(cloudV2AuthToken, null);
          await saveItem(cloudV2AuthUser, null);
          // deviceId, deviceToken, deviceCompanyId, designatedBranch intentionally
          // preserved so sub-accounts can still sign in on this device after the
          // owner signs out
        } catch (error) {
          console.debug('[CloudAuthContextProvider] signOut error:', error);
        }
        invalidateCloudSyncParamsCache();
        dispatch({type: 'SIGN_OUT'});
      },

      setDeviceCredentials: async ({deviceId, deviceToken, companyId}) => {
        await saveItem(cloudV2DeviceId, deviceId);
        await saveItem(cloudV2DeviceToken, deviceToken);
        await saveItem(cloudV2DeviceCompanyId, companyId ?? null);
        invalidateCloudSyncParamsCache();
        dispatch({
          type: 'SET_DEVICE_CREDENTIALS',
          deviceId,
          deviceToken,
        });
      },

      setDesignatedBranch: async branch => {
        await saveItem(cloudV2DesignatedBranch, branch);
        invalidateCloudSyncParamsCache();
        scheduleSyncSoon(500);
        dispatch({type: 'SET_DESIGNATED_BRANCH', designatedBranch: branch});
      },

      switchUser: async () => {
        try {
          await saveItem(cloudV2AuthToken, null);
          await saveItem(cloudV2AuthUser, null);
        } catch (error) {
          console.debug('[CloudAuthContextProvider] switchUser error:', error);
        }
        dispatch({type: 'SWITCH_USER'});
      },

      setExpiredAuthTokenDialogVisible,
    }),
    [],
  );

  const otherState = {expiredAuthTokenDialogVisible};
  const otherActions = useMemo(() => ({setExpiredAuthTokenDialogVisible}), []);

  return (
    <CloudAuthContext.Provider
      value={[state, authActions, otherState, otherActions]}>
      {children}
    </CloudAuthContext.Provider>
  );
};

export default CloudAuthContextProvider;
