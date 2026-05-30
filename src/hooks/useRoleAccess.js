import {useCallback, useMemo} from 'react';

import useCurrentUser from './useCurrentUser';
import {hasPermission, tabAccessState} from '../permissions/hasPermission';

/**
 * Role-based access for the currently signed-in user.
 *
 * NOTE: This is distinct from `usePermissions` (which deals with device storage
 * permissions). Use this hook for role/feature gating.
 *
 * Returns:
 *   - can(key)            -> boolean, true if the user may perform `key`
 *   - tabState(key)       -> 'allow' | 'unauthorized' | 'hidden'
 *   - isRoot              -> the user is the root account (bypasses all checks)
 *   - roleConfig          -> the raw { enable, disable } config (or undefined)
 */
export default function useRoleAccess() {
  const [{authUser}] = useCurrentUser();
  const isRoot = !!authUser?.is_root_account;
  const roleConfig = authUser?.role_config;

  const can = useCallback(
    key => hasPermission(roleConfig, key, {isRoot}),
    [roleConfig, isRoot],
  );

  const tabState = useCallback(
    key => tabAccessState(roleConfig, key, {isRoot}),
    [roleConfig, isRoot],
  );

  return useMemo(
    () => ({can, tabState, isRoot, roleConfig}),
    [can, tabState, isRoot, roleConfig],
  );
}
