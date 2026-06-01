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
import {createDefaultInventoryOperations} from '../../localDbQueries/operations';
import {createDefaultTaxes} from '../../localDbQueries/taxes';
import {appVersion} from '../../constants/appConfig';
import {
  runSync,
  scheduleSyncSoon,
  flushPendingSync,
} from '../../services/syncService';
import {getCloudCompany} from '../../serverDbQueries/v2/companies';
import {getDeviceCompanyInfo} from '../../serverDbQueries/v2/devices';
import {getMe} from '../../serverDbQueries/v2/auth';
import {
  addLicenseBranch,
  getLicenseStatus,
} from '../../localDbQueries/license';

const {
  cloudV2AuthToken,
  cloudV2AuthUser,
  cloudV2DeviceId,
  cloudV2DeviceToken,
  cloudV2DeviceCompanyId,
  cloudV2DesignatedBranch,
  cloudV2DeviceCompanyInfo,
  cloudV2LastSignInAccountType,
} = rnStorageKeys;

// Maps an authUser to the account-type marker we persist so the auth stack can
// default to the matching sign-in screen ('root' → Company Owner, 'sub' → Team
// Member) the next time the device returns to the unauthenticated state.
const accountTypeOf = user =>
  user?.account?.is_root_account ? 'root' : 'sub';

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
        lastSignInAccountType: action.lastSignInAccountType ?? null,
      };
    case 'SIGN_IN':
      return {
        ...prevState,
        isLoading: false,
        isSignout: false,
        authToken: action.authToken,
        authUser: action.authUser,
        lastSignInAccountType: action.lastSignInAccountType,
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
        // New company account — owner, so default to the owner sign-in screen
        lastSignInAccountType: 'root',
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
        isSwitchingBranch: false,
      };
    case 'BEGIN_SWITCH_BRANCH':
      return {
        ...prevState,
        isSwitchingBranch: true,
      };
    case 'END_SWITCH_BRANCH':
      return {
        ...prevState,
        isSwitchingBranch: false,
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
    case 'SET_AUTH_USER':
      return {
        ...prevState,
        authUser: action.authUser,
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
  // 'root' | 'sub' | null — account type of the last successful sign-in, used
  // to pick which sign-in screen the unauthenticated auth stack defaults to.
  lastSignInAccountType: null,
  // True while setDesignatedBranch is preparing the new branch DB and running
  // its initial pull. App.js shows Splash for the duration so the user never
  // sees an empty Items / Recipes screen mid-switch.
  isSwitchingBranch: false,
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
        const lastSignInAccountType = await loadItem(
          cloudV2LastSignInAccountType,
        );

        // Activate the company+branch-scoped DB and seed defaults
        // before any component reads local data (isLoading stays true until done)
        await setActiveCompanyDb(
          authUser?.company?.id ?? null,
          designatedBranch?.id ?? null,
        );
        if (authUser?.company?.id) {
          await setDefaultUnits();
          await createDefaultSettings();
          await createDefaultInventoryOperations(appVersion);
          await createDefaultTaxes();
        }

        dispatch({
          type: 'RESTORE',
          authToken,
          authUser,
          deviceId,
          deviceToken,
          designatedBranch,
          deviceCompanyInfo,
          lastSignInAccountType,
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

        // Fire-and-forget: refresh the signed-in account via /auth/me so
        // server-side changes (role name, role_config/permissions, etc.) made
        // since the last sign-in propagate without requiring a re-login.
        if (authToken && authUser?.account) {
          getMe()
            .then(async response => {
              const account = response?.data?.account ?? null;
              if (!account) return;
              const nextAuthUser = {...authUser, account};
              await saveItem(cloudV2AuthUser, nextAuthUser);
              dispatch({type: 'SET_AUTH_USER', authUser: nextAuthUser});
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

        // Remember the account type so the next unauthenticated session defaults
        // to the matching sign-in screen (Company Owner vs Team Member).
        const accountType = accountTypeOf(user);
        await saveItem(cloudV2LastSignInAccountType, accountType);

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
          await createDefaultInventoryOperations(appVersion);
          await createDefaultTaxes();
        }

        dispatch({
          type: 'SIGN_IN',
          authToken: token,
          authUser: user,
          clearDevice,
          lastSignInAccountType: accountType,
        });
      },

      signUp: async data => {
        const token = data?.data?.token ?? null;
        const user = data?.data
          ? {account: data.data.account, company: data.data.company}
          : null;
        await saveItem(cloudV2AuthToken, token);
        await saveItem(cloudV2AuthUser, user);
        // New company account is always an owner — default to owner sign-in next.
        await saveItem(cloudV2LastSignInAccountType, 'root');
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

        // OTP verify is the owner flow, but derive the marker from the account
        // anyway so it stays correct if that ever changes.
        const accountType = accountTypeOf(user);
        await saveItem(cloudV2LastSignInAccountType, accountType);

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
          await createDefaultInventoryOperations(appVersion);
          await createDefaultTaxes();
        }

        dispatch({
          type: 'SIGN_IN',
          authToken: token,
          authUser: user,
          clearDevice,
          lastSignInAccountType: accountType,
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

      patchDesignatedBranch: async updates => {
        const current = await loadItem(cloudV2DesignatedBranch, true);
        if (!current) return;
        const updated = {...current, ...updates};
        await saveItem(cloudV2DesignatedBranch, updated);
        dispatch({type: 'SET_DESIGNATED_BRANCH', designatedBranch: updated});
      },

      setDesignatedBranch: async branch => {
        // License branch-switch gate. Runs BEFORE BEGIN_SWITCH_BRANCH so
        // a blocked switch leaves the UI untouched (no Splash flash).
        //   - No license / expired → free tier, no gating
        //   - Active license, branch already in allowlist → pass through
        //   - Active license, branch not in allowlist + under cap → auto add
        //     (server reissues the JWT with the expanded list)
        //   - Active license, branch not in allowlist + at cap → block
        try {
          const licenseStatus = (await getLicenseStatus()).result;
          if (licenseStatus.hasLicenseToken && !licenseStatus.isLicenseExpired) {
            const allowed = licenseStatus.allowedBranchIds ?? [];
            const cap = licenseStatus.maxBranches ?? 0;
            const targetId = branch?.id;
            if (targetId && !allowed.includes(targetId)) {
              if (cap > 0 && allowed.length >= cap) {
                throw new Error(
                  `Branch limit reached for your license (${cap}). Upgrade to add more branches.`,
                );
              }
              await addLicenseBranch({branchId: targetId});
            }
          }
        } catch (gateError) {
          console.debug('[CloudAuthContextProvider] branch gate:', gateError);
          throw gateError;
        }

        // Flag a switch-in-progress so App.js holds on Splash until we finish.
        // Without this the user briefly sees the previous branch's stale UI
        // (queries from queryClient.clear() are mid-flight) and then an empty
        // Items / Recipes screen until the first pull lands — looks like
        // "data missing" even though sync is just behind.
        dispatch({type: 'BEGIN_SWITCH_BRANCH'});
        try {
          // Snapshot company display info so it survives sign-out and is
          // visible on the sign-in screen for team members picking up the
          // device.
          const currentUser = await loadItem(cloudV2AuthUser, true);
          const deviceCompanyInfo = currentUser?.company
            ? {
                name: currentUser.company.name ?? null,
                display_name: currentUser.company.display_name ?? null,
                logo_url: currentUser.company.logo_url ?? null,
              }
            : null;
          await saveItem(cloudV2DeviceCompanyInfo, deviceCompanyInfo);
          // Push any unsynced rows from the CURRENT branch's DB before we
          // swap the active DB pointer. Without this, debounced or interval
          // syncs that fire after the swap run against the new branch's DB
          // and the previous branch's pending mutations sit in its SQLite
          // file forever (and are lost on a reinstall). Wrapped in try/catch
          // so an offline switch still proceeds — the rows stay unsynced and
          // will push on the next online sync attempt on that branch.
          try {
            await flushPendingSync();
          } catch (flushErr) {
            console.debug(
              '[CloudAuthContextProvider] flushPendingSync before branch switch failed:',
              flushErr,
            );
          }
          await saveItem(cloudV2DesignatedBranch, branch);
          invalidateCloudSyncParamsCache();
          // Switch to the company+branch-scoped DB and ensure it is initialised.
          await setActiveCompanyDb(getActiveCompanyId(), branch?.id ?? null);
          await setDefaultUnits();
          await createDefaultSettings();
          await createDefaultInventoryOperations(appVersion);
          await createDefaultTaxes();
          // Clear the React Query cache so every query re-runs against the new
          // branch's DB instead of returning stale data from the previous
          // branch.
          queryClient.clear();
          // Run the first pull synchronously instead of via scheduleSyncSoon —
          // returning before the data lands is exactly what made fresh
          // installs and branch switches look "empty". Wrapped in try/catch
          // so an offline switch still completes the UI transition.
          try {
            await runSync();
          } catch (syncErr) {
            console.debug(
              '[CloudAuthContextProvider] initial sync after branch switch failed:',
              syncErr,
            );
          }
          // Subsequent pulls run on the 15s interval (useAppLifecycle); this
          // soon-call covers the case where the server data was created
          // between our pull starting and ending.
          scheduleSyncSoon(2000);
          dispatch({
            type: 'SET_DESIGNATED_BRANCH',
            designatedBranch: branch,
            deviceCompanyInfo,
          });
        } catch (err) {
          dispatch({type: 'END_SWITCH_BRANCH'});
          throw err;
        }
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
