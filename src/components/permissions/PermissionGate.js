import useRoleAccess from '../../hooks/useRoleAccess';

/**
 * Renders `children` only when the current user may perform `permission`.
 * Otherwise renders `fallback` (default: nothing).
 *
 *   <PermissionGate permission="recipes.yield">
 *     <Button>Yield Now</Button>
 *   </PermissionGate>
 *
 * For list/array building (e.g. filtering menu options) prefer the `can`
 * function from `useRoleAccess` directly.
 */
const PermissionGate = ({permission, fallback = null, children}) => {
  const {can} = useRoleAccess();

  if (!permission) return children;

  return can(permission) ? children : fallback;
};

export default PermissionGate;
