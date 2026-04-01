import useCloudAuthContext from './useCloudAuthContext';

/**
 * Drop-in replacement for useAuthContext using FCMS Cloud v2 auth.
 *
 * Returns the same [state, authActions, otherState, otherActions] shape so
 * all existing consumers work without structural changes.
 *
 * authUser shape:
 *   { ...account fields from cloud API, is_root_account: true }
 *
 * is_root_account is always true because cloud signup creates the owner
 * account — there are no sub-accounts (admin/encoder) in cloud v2 yet.
 */
const useCurrentUser = () => {
  const [cloudState, cloudActions, otherState, otherActions] =
    useCloudAuthContext();

  const authUser = cloudState.authUser
    ? {
        ...cloudState.authUser.account,
        is_root_account: true,
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
