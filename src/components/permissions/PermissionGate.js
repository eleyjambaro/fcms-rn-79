import useRoleAccess from '../../hooks/useRoleAccess';

/**
 * Renders `children` only when the current user is allowed; otherwise renders
 * `fallback` (default: nothing).
 *
 * Two mutually-exclusive modes:
 *
 *   - `permission` — an ACTION key, gated by `can()`. Use for individual
 *     mutations (create / edit / delete / confirm / …):
 *
 *         <PermissionGate permission="recipes.yield">
 *           <Button>Yield Now</Button>
 *         </PermissionGate>
 *
 *   - `module` — a MODULE key, gated by `canAccessModule()` ("can reach any part
 *     of this module"). Use for *visibility* of a whole section/tile:
 *
 *         <PermissionGate module="settings">
 *           <Drawer.Item label="Settings" ... />
 *         </PermissionGate>
 *
 * For list/array building (e.g. filtering menu options) prefer the `can` /
 * `canAccessModule` functions from `useRoleAccess` directly.
 */
const PermissionGate = ({permission, module, fallback = null, children}) => {
  const {can, canAccessModule} = useRoleAccess();

  if (module) {
    return canAccessModule(module) ? children : fallback;
  }

  if (!permission) return children;

  return can(permission) ? children : fallback;
};

export default PermissionGate;
