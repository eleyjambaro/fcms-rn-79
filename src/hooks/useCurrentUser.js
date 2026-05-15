import useCloudAuthContext from './useCloudAuthContext';

/**
 * Drop-in replacement for useAuthContext using FCMS Cloud v2 auth.
 *
 * Returns the same [state, authActions, otherState, otherActions] shape so
 * all existing consumers work without structural changes.
 *
 * authUser shape mirrors the cloud API account response:
 *   { id, email, first_name, last_name, is_root_account, role_id, role_config, ... }
 *
 * is_root_account and role_config come directly from the API and are stored
 * in cloudV2AuthUser SecureStorage — no client-side override needed.
 */
const useCurrentUser = () => {
  const [cloudState, cloudActions, otherState, otherActions] =
    useCloudAuthContext();

  const authUser = cloudState.authUser
    ? {
        ...cloudState.authUser.account,
      }
    : null;

  const state = {
    isLoading: cloudState.isLoading,
    isSignout: cloudState.isSignout,
    authToken: cloudState.authToken,
    authUser,
    showPostSignupScreen: false,
  };

  return [state, cloudActions, otherState, otherActions];
};

export default useCurrentUser;
