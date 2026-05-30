/**
 * Bridges the checkbox editor and the on-disk role config `{ enable, disable }`.
 *
 * LOAD  (config -> checked action keys): defined entirely by `hasPermission`, so
 *       loading uses the SAME semantics as runtime enforcement — there is no
 *       second interpretation that could drift.
 *
 * SAVE  (checked action keys -> config): emits a minimal, predictable
 *       grant-list. `disable` stays empty for editor-produced configs; granted
 *       whole modules collapse to their bare module key (so legacy module gates
 *       keep working), partially-granted modules list their individual action
 *       keys, and fully-granted-everything collapses to `['*']`.
 *
 * Two safety rails:
 *   - **Unknown-key passthrough.** Any stored key the registry does not know is
 *     carried forward verbatim, never silently dropped.
 *   - **Round-trip guard.** If an edit did not actually change the effective
 *     permission set, the original config is re-emitted byte-for-byte (so e.g.
 *     opening and saving the built-in Encoder role without changes preserves
 *     its deny-list form exactly).
 */

import {hasPermission} from './hasPermission';
import {
  PERMISSION_DOMAINS,
  ALL_ACTION_KEYS,
  KNOWN_PERMISSION_KEYS,
} from '../constants/rolePermissions';

function normalizeConfig(config) {
  return {
    enable: Array.isArray(config?.enable) ? config.enable : [],
    disable: Array.isArray(config?.disable) ? config.disable : [],
  };
}

/**
 * config -> Set of checked action keys (only keys present in the registry).
 */
export function loadCheckedSet(config) {
  const checked = new Set();
  for (const key of ALL_ACTION_KEYS) {
    if (hasPermission(config, key, {isRoot: false})) {
      checked.add(key);
    }
  }
  return checked;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

/**
 * checked action keys (Set or array) + the originally-loaded config
 * -> a new `{ enable, disable }` config.
 */
export function serializeRoleConfig(checked, originalConfig) {
  const checkedSet = checked instanceof Set ? checked : new Set(checked || []);
  const original = normalizeConfig(originalConfig);

  // --- build the grant-list from the checkbox state ---
  const allChecked = ALL_ACTION_KEYS.every(key => checkedSet.has(key));
  const enable = [];

  if (allChecked) {
    enable.push('*');
  } else {
    for (const domain of PERMISSION_DOMAINS) {
      const everyActionChecked = domain.actions.every(action =>
        checkedSet.has(action.key),
      );

      if (everyActionChecked && domain.actions.length > 0) {
        enable.push(domain.moduleKey);
      } else {
        for (const action of domain.actions) {
          if (checkedSet.has(action.key)) {
            enable.push(action.key);
          }
        }
      }
    }
  }

  const disable = [];

  // --- carry forward any keys the registry does not recognize ---
  const unknownEnable = original.enable.filter(
    key => key !== '*' && !KNOWN_PERMISSION_KEYS.has(key),
  );
  const unknownDisable = original.disable.filter(
    key => !KNOWN_PERMISSION_KEYS.has(key),
  );
  enable.push(...unknownEnable);
  disable.push(...unknownDisable);

  const newConfig = {enable, disable};

  // --- round-trip guard: no effective change -> keep the original verbatim ---
  if (setsEqual(loadCheckedSet(newConfig), loadCheckedSet(original))) {
    return original;
  }

  return newConfig;
}

export default serializeRoleConfig;
