/**
 * Module-AWARE access helpers for *visibility* gates (Home tiles, MainTab tabs,
 * Account sections, drawer items).
 *
 * ## Why this exists
 *
 * `hasPermission(config, key)` only walks dot-ancestry UPWARD — a child key's
 * ancestors include its parent module, so `can('spoilage.view')` is true when
 * the whole `spoilage` module is granted. The reverse is NOT true: a role with
 * a partial grant serializes to `{ enable: ['spoilage.view'] }`, and
 * `ancestors('spoilage')` is just `['spoilage']`, so `can('spoilage')` returns
 * FALSE. Every visibility gate that passes a bare MODULE key therefore hid the
 * whole feature from view-only / partial-grant roles.
 *
 * The serializer ([serializeRoleConfig.js](src/permissions/serializeRoleConfig.js))
 * is intentionally NOT changed: it must only emit the bare module key when every
 * action is granted (emitting it for a partial grant would silently grant all
 * actions). The fix belongs here, at the read/gate layer.
 *
 * Use these for *visibility* ("can the user reach any part of this module?").
 * Keep `hasPermission` / `can(actionKey)` for *capability* checks on individual
 * mutations (create / edit / delete / confirm / …).
 */

import {hasPermission, tabAccessState} from './hasPermission';
import {PERMISSION_DOMAINS} from '../constants/rolePermissions';

/** moduleKey -> [action keys], precomputed once so gates don't scan per render. */
const ACTION_KEYS_BY_MODULE = new Map(
  PERMISSION_DOMAINS.map(domain => [
    domain.moduleKey,
    domain.actions.map(action => action.key),
  ]),
);

/**
 * True if the user can reach ANY part of `moduleKey` — the bare module key is
 * granted, or any single action under it is. This is the correct test for
 * showing a tile / tab / section.
 */
export function canAccessModule(roleConfig, moduleKey, options = {}) {
  const {isRoot = false} = options;

  if (isRoot) return true;
  if (!moduleKey) return false;

  // Whole module granted (or '*'), and not denied.
  if (hasPermission(roleConfig, moduleKey, {isRoot})) return true;

  // Any individual action under the module grants visibility.
  const actionKeys = ACTION_KEYS_BY_MODULE.get(moduleKey) || [];
  return actionKeys.some(key => hasPermission(roleConfig, key, {isRoot}));
}

/**
 * Module-aware three-way state for tab/section screens that distinguish
 * "show an Unauthorized screen" from "hide entirely".
 *
 * Returns 'allow' | 'unauthorized' | 'hidden'.
 *
 * If the user can access any part of the module -> 'allow'. Otherwise the
 * 'unauthorized' vs 'hidden' decision is delegated to `tabAccessState`, which
 * already implements the claim/deny logic — so seeded roles (e.g. Encoder, with
 * `{ enable: ['*'], disable: ['settings', ...] }`) keep resolving disabled tabs
 * to 'unauthorized' exactly as before.
 */
export function moduleAccessState(roleConfig, moduleKey, options = {}) {
  if (canAccessModule(roleConfig, moduleKey, options)) return 'allow';
  return tabAccessState(roleConfig, moduleKey, options);
}

export default canAccessModule;
