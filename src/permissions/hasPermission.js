/**
 * Central role-permission check. This is the SINGLE place that interprets a
 * role config; the editor's load step and every runtime gate go through it, so
 * there is exactly one definition of "what does this config allow".
 *
 * Role config shape (legacy, backward compatible):
 *
 *     { enable: ['*'] | [keys...], disable: [keys...] }
 *
 * Keys are dot-notation strings with two levels — a bare module key
 * (`recipes`) and action keys under it (`recipes.yield`). See
 * [src/constants/rolePermissions.js](src/constants/rolePermissions.js).
 *
 * Resolution order for `hasPermission(config, key, { isRoot })`:
 *   1. Root accounts are always allowed (matches existing app behavior).
 *   2. If the key OR any of its ancestors is in `disable` → DENY.
 *      (disable wins, and denying a module denies all its actions.)
 *   3. If `enable` contains `'*'` → ALLOW.
 *   4. If the key OR any of its ancestors is in `enable` → ALLOW.
 *      (enabling a module enables all its actions.)
 *   5. Otherwise → DENY (the legacy `else { hide }` branch).
 *
 * This reproduces today's behavior for every currently-stored role:
 *   - Admin  `{enable:['*'],disable:[]}`        → everything allowed.
 *   - Encoder `{enable:['*'],disable:[...]}`     → disabled modules (and their
 *     actions) denied, everything else allowed.
 *   - Bare module gates map to a single-element ancestor chain.
 */

/**
 * Returns the key plus all of its dot-ancestors, broadest last.
 * 'recipes.yield' -> ['recipes.yield', 'recipes']
 */
export function ancestors(key) {
  if (!key || typeof key !== 'string') return [];
  const parts = key.split('.');
  const chain = [];
  for (let i = parts.length; i >= 1; i--) {
    chain.push(parts.slice(0, i).join('.'));
  }
  return chain;
}

export function hasPermission(roleConfig, key, options = {}) {
  const {isRoot = false} = options;

  if (isRoot) return true;
  if (!key) return false;

  const enable = Array.isArray(roleConfig?.enable) ? roleConfig.enable : [];
  const disable = Array.isArray(roleConfig?.disable) ? roleConfig.disable : [];

  const chain = ancestors(key);

  // disable overrides everything, at the exact key or any ancestor module.
  if (chain.some(k => disable.includes(k))) return false;

  if (enable.includes('*')) return true;

  // exact key or an enabled ancestor module grants access.
  if (chain.some(k => enable.includes(k))) return true;

  return false;
}

/**
 * Three-way access state for tab/section screens that must distinguish between
 * "show an Unauthorized screen" (the user has a claim to the feature but it was
 * explicitly disabled) and "hide entirely" (the user has no claim at all).
 *
 * Returns 'allow' | 'unauthorized' | 'hidden'. This preserves the exact
 * behavior of the original inline blocks in MainTab/Account, generalized to
 * dot-ancestry.
 */
export function tabAccessState(roleConfig, key, options = {}) {
  const {isRoot = false} = options;

  if (isRoot) return 'allow';
  if (!key) return 'hidden';

  const enable = Array.isArray(roleConfig?.enable) ? roleConfig.enable : [];
  const disable = Array.isArray(roleConfig?.disable) ? roleConfig.disable : [];
  const chain = ancestors(key);

  const claimed = enable.includes('*') || chain.some(k => enable.includes(k));
  if (!claimed) return 'hidden';

  const denied = chain.some(k => disable.includes(k));
  if (denied) return 'unauthorized';

  return 'allow';
}

export default hasPermission;
