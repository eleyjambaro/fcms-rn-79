import React, {useState, useEffect, useReducer, useMemo} from 'react';
import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';

import {CloudAuthContext} from '../types';
import {rnStorageKeys} from '../../constants/rnSecureStorageKeys';
import {invalidateCloudSyncParamsCache} from '../../localDb';
import {scheduleSyncSoon} from '../../services/syncService';

const {
  cloudV2AuthToken,
  cloudV2AuthUser,
  cloudV2DeviceId,
  cloudV2DeviceToken,
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
      };
    case 'SIGN_UP':
      return {
        ...prevState,
        isLoading: false,
        isSignout: false,
        authToken: action.authToken,
        authUser: action.authUser,
      };
    case 'SIGN_OUT':
      return {
        ...prevState,
        isLoading: false,
        isSignout: true,
        authToken: null,
        authUser: null,
        deviceId: null,
        deviceToken: null,
        designatedBranch: null,
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
        dispatch({type: 'SIGN_IN', authToken: token, authUser: user});
      },

      signUp: async data => {
        const token = data?.data?.token ?? null;
        const user = data?.data
          ? {account: data.data.account, company: data.data.company}
          : null;
        await saveItem(cloudV2AuthToken, token);
        await saveItem(cloudV2AuthUser, user);
        dispatch({type: 'SIGN_UP', authToken: token, authUser: user});
      },

      // Called after OTP verify — same shape as signIn
      setAuthFromVerify: async data => {
        const token = data?.data?.token ?? null;
        const user = data?.data
          ? {account: data.data.account, company: data.data.company}
          : null;
        await saveItem(cloudV2AuthToken, token);
        await saveItem(cloudV2AuthUser, user);
        dispatch({type: 'SIGN_IN', authToken: token, authUser: user});
      },

      signOut: async () => {
        try {
          await saveItem(cloudV2AuthToken, null);
          await saveItem(cloudV2AuthUser, null);
          await saveItem(cloudV2DeviceId, null);
          await saveItem(cloudV2DeviceToken, null);
          await saveItem(cloudV2DesignatedBranch, null);
        } catch (error) {
          console.debug('[CloudAuthContextProvider] signOut error:', error);
        }
        invalidateCloudSyncParamsCache();
        dispatch({type: 'SIGN_OUT'});
      },

      setDeviceCredentials: async ({deviceId, deviceToken}) => {
        await saveItem(cloudV2DeviceId, deviceId);
        await saveItem(cloudV2DeviceToken, deviceToken);
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
