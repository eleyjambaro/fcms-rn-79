import {useCallback, useMemo} from 'react';

import useCurrentUser from './useCurrentUser';
import {hasPermission, tabAccessState} from '../permissions/hasPermission';
import {canAccessModule, moduleAccessState} from '../permissions/moduleAccess';

/**
 * Role-based access for the currently signed-in user.
 *
 * NOTE: This is distinct from `usePermissions` (which deals with device storage
 * permissions). Use this hook for role/feature gating.
 *
 * Returns:
 *   - can(key)             -> boolean, true if the user may perform action `key`
 *                             (use for individual mutations: create/edit/delete)
 *   - canAccessModule(key) -> boolean, true if the user can reach ANY part of a
 *                             module (use for *visibility* of tiles/sections)
 *   - tabState(key)        -> 'allow' | 'unauthorized' | 'hidden' (exact key)
 *   - moduleState(key)     -> module-aware 'allow' | 'unauthorized' | 'hidden'
 *                             (use for *visibility* of tab screens)
 *   - isRoot               -> the user is the root account (bypasses all checks)
 *   - roleConfig           -> the raw { enable, disable } config (or undefined)
 */
export default function useRoleAccess() {
  const [{authUser}] = useCurrentUser();
  const isRoot = !!authUser?.is_root_account;
  const roleConfig = authUser?.role_config;

  const can = useCallback(
    key => hasPermission(roleConfig, key, {isRoot}),
    [roleConfig, isRoot],
  );

  const canAccessModuleFn = useCallback(
    key => canAccessModule(roleConfig, key, {isRoot}),
    [roleConfig, isRoot],
  );

  const tabState = useCallback(
    key => tabAccessState(roleConfig, key, {isRoot}),
    [roleConfig, isRoot],
  );

  const moduleState = useCallback(
    key => moduleAccessState(roleConfig, key, {isRoot}),
    [roleConfig, isRoot],
  );

  return useMemo(
    () => ({
      can,
      canAccessModule: canAccessModuleFn,
      tabState,
      moduleState,
      isRoot,
      roleConfig,
    }),
    [can, canAccessModuleFn, tabState, moduleState, isRoot, roleConfig],
  );
}
