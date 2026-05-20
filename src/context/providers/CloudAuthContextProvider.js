import React, {useState, useEffect, useReducer, useMemo} from 'react';
import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';

import {CloudAuthContext} from '../types';
import {rnStorageKeys} from '../../constants/rnSecureStorageKeys';
import {
  invalidateCloudSyncParamsCache,
  setActiveCompanyDb,
  getActiveCompanyId,
} from '../../localDb';
import {queryClient} from '../../queryClient';
import {setDefaultUnits} from '../../localData/units';
import {createDefaultSettings} from '../../localDbQueries/settings';
import {scheduleSyncSoon} from '../../services/syncService';
import {getCloudCompany} from '../../serverDbQueries/v2/companies';
import {getDeviceCompanyInfo} from '../../serverDbQueries/v2/devices';

const {
  cloudV2AuthToken,
  cloudV2AuthUser,
  cloudV2DeviceId,
  cloudV2DeviceToken,
  cloudV2DeviceCompanyId,
  cloudV2DesignatedBranch,
  cloudV2DeviceCompanyInfo,
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
  await saveItem(cloudV2DeviceCompanyInfo, null);
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
        deviceCompanyInfo: action.deviceCompanyInfo,
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
          ? {deviceId: null, deviceToken: null, designatedBranch: null, deviceCompanyInfo: null}
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
        deviceCompanyInfo: null,
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
        deviceCompanyInfo: action.deviceCompanyInfo ?? prevState.deviceCompanyInfo,
      };
    case 'REFRESH_COMPANY':
      return {
        ...prevState,
        authUser: prevState.authUser
          ? {...prevState.authUser, company: action.company}
          : prevState.authUser,
      };
    case 'SET_DEVICE_COMPANY_INFO':
      return {
        ...prevState,
        deviceCompanyInfo: action.deviceCompanyInfo,
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
  deviceCompanyInfo: null,
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
        const deviceCompanyInfo = await loadItem(cloudV2DeviceCompanyInfo, true);

        // Activate the company+branch-scoped DB and seed defaults
        // before any component reads local data (isLoading stays true until done)
        await setActiveCompanyDb(
          authUser?.company?.id ?? null,
          designatedBranch?.id ?? null,
        );
        if (authUser?.company?.id) {
          await setDefaultUnits();
          await createDefaultSettings();
        }

        dispatch({
          type: 'RESTORE',
          authToken,
          authUser,
          deviceId,
          deviceToken,
          designatedBranch,
          deviceCompanyInfo,
        });

        // Fire-and-forget: refresh company info via device token so existing
        // devices and reinstalls always show the current logo/name.
        if (deviceId && deviceToken) {
          getDeviceCompanyInfo({device_id: deviceId, device_token: deviceToken})
            .then(async response => {
              const info = response?.data ?? null;
              if (info) {
                await saveItem(cloudV2DeviceCompanyInfo, info);
                dispatch({type: 'SET_DEVICE_COMPANY_INFO', deviceCompanyInfo: info});
              }
            })
            .catch(() => {});
        }
      } catch (error) {
        console.debug('[CloudAuthContextProvider] restore error:', error);
        await setActiveCompanyDb(null);
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

        // Switch to this company+branch isolated DB file and seed defaults.
        // If clearDevice=true the branch was just erased; otherwise it's still in storage.
        const signInBranch = clearDevice
          ? null
          : await loadItem(cloudV2DesignatedBranch, true);
        await setActiveCompanyDb(
          user?.company?.id ?? null,
          signInBranch?.id ?? null,
        );
        // Seed defaults only when a branch is already known — if there's no
        // branch yet, setDesignatedBranch will seed after branch selection,
        // avoiding a wasted init on a file that becomes an orphan immediately.
        if (user?.company?.id && signInBranch?.id) {
          await setDefaultUnits();
          await createDefaultSettings();
        }

        dispatch({
          type: 'SIGN_IN',
          authToken: token,
          authUser: user,
          clearDevice,
        });
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
        // Switch to the new company's isolated DB file (no branch yet — branch
        // is assigned during device registration which follows sign-up)
        // No branch during sign-up (assigned at device registration); defer
        // seeding to setDesignatedBranch to avoid orphaning this DB file.
        await setActiveCompanyDb(user?.company?.id ?? null, null);
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

        // Switch to this company+branch isolated DB file and seed defaults.
        const verifyBranch = clearDevice
          ? null
          : await loadItem(cloudV2DesignatedBranch, true);
        await setActiveCompanyDb(
          user?.company?.id ?? null,
          verifyBranch?.id ?? null,
        );
        // Same deferred-seeding logic as signIn — only seed when branch is known.
        if (user?.company?.id && verifyBranch?.id) {
          await setDefaultUnits();
          await createDefaultSettings();
        }

        dispatch({
          type: 'SIGN_IN',
          authToken: token,
          authUser: user,
          clearDevice,
        });
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
        // Clear cached query results so the next user never sees stale data
        queryClient.clear();
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
        // Snapshot company display info so it survives sign-out and is visible
        // on the sign-in screen for team members picking up the device.
        const currentUser = await loadItem(cloudV2AuthUser, true);
        const deviceCompanyInfo = currentUser?.company
          ? {
              name: currentUser.company.name ?? null,
              display_name: currentUser.company.display_name ?? null,
              logo_url: currentUser.company.logo_url ?? null,
            }
          : null;
        await saveItem(cloudV2DeviceCompanyInfo, deviceCompanyInfo);
        await saveItem(cloudV2DesignatedBranch, branch);
        invalidateCloudSyncParamsCache();
        // Switch to the company+branch-scoped DB and ensure it is initialised.
        await setActiveCompanyDb(getActiveCompanyId(), branch?.id ?? null);
        await setDefaultUnits();
        await createDefaultSettings();
        scheduleSyncSoon(500);
        dispatch({type: 'SET_DESIGNATED_BRANCH', designatedBranch: branch, deviceCompanyInfo});
      },

      refreshCloudAuthCompany: async () => {
        try {
          const response = await getCloudCompany();
          const company = response?.data ?? null;
          if (!company) return;

          // Merge updated company into the persisted authUser so it survives restarts
          const currentUser = await loadItem(cloudV2AuthUser, true);
          if (currentUser) {
            await saveItem(cloudV2AuthUser, {...currentUser, company});
          }
          dispatch({type: 'REFRESH_COMPANY', company});
        } catch (error) {
          console.debug('[CloudAuthContextProvider] refreshCloudAuthCompany error:', error);
        }
      },

      switchUser: async () => {
        try {
          await saveItem(cloudV2AuthToken, null);
          await saveItem(cloudV2AuthUser, null);
        } catch (error) {
          console.debug('[CloudAuthContextProvider] switchUser error:', error);
        }
        queryClient.clear();
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
