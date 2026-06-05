import React, {useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {List, Checkbox, Chip, Caption, Divider, useTheme} from 'react-native-paper';

import {
  PERMISSION_DOMAINS,
  ROLE_PRESETS,
} from '../../constants/rolePermissions';
import {loadCheckedSet} from '../../permissions/serializeRoleConfig';

const sameSet = (a, b) => {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
};

// Precompute each preset's checked-key set so the active-preset highlight is a
// cheap comparison instead of re-deriving on every render.
const PRESET_CHECKED_SETS = ROLE_PRESETS.map(preset => ({
  id: preset.id,
  checked: loadCheckedSet(preset.config),
}));

/**
 * Granular, checkbox-based role permission editor.
 *
 * Replaces the raw-JSON text field. Manages a Set of checked action keys
 * internally (seeded from `initialConfig` via the shared `loadCheckedSet`) and
 * reports the current Set up through `onChange` so the parent can serialize it
 * back to a `{ enable, disable }` config on submit.
 *
 * Props:
 *   - initialConfig : the role config to seed checkboxes from. Pass a stable
 *                     `key` on this component (e.g. the role id) when switching
 *                     between roles so it re-seeds.
 *   - onChange(Set) : called with the current checked-key Set on mount and on
 *                     every change.
 */
const RolePermissionEditor = ({initialConfig, onChange}) => {
  const {colors} = useTheme();
  const [checked, setChecked] = useState(() => loadCheckedSet(initialConfig));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Report the initial set once so the parent has state before any edit.
  useEffect(() => {
    onChangeRef.current?.(checked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which template (if any) the current selection exactly matches — used to
  // highlight the active preset chip. Recomputed only when the selection changes.
  const activePresetId = useMemo(() => {
    const match = PRESET_CHECKED_SETS.find(preset =>
      sameSet(preset.checked, checked),
    );
    return match ? match.id : null;
  }, [checked]);

  const update = nextSet => {
    setChecked(nextSet);
    onChangeRef.current?.(nextSet);
  };

  const toggleAction = key => {
    const next = new Set(checked);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    update(next);
  };

  const setDomainChecked = (domain, shouldCheck) => {
    const next = new Set(checked);
    domain.actions.forEach(action => {
      if (shouldCheck) {
        next.add(action.key);
      } else {
        next.delete(action.key);
      }
    });
    update(next);
  };

  const applyPreset = preset => {
    update(loadCheckedSet(preset.config));
  };

  const domainState = domain => {
    const total = domain.actions.length;
    const count = domain.actions.filter(a => checked.has(a.key)).length;
    if (count === 0) return {status: 'unchecked', count, total};
    if (count === total) return {status: 'checked', count, total};
    return {status: 'indeterminate', count, total};
  };

  return (
    <View>
      <Caption style={styles.presetLabel}>Start from a template:</Caption>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetRow}>
        {ROLE_PRESETS.map(preset => {
          const isActive = activePresetId === preset.id;

          return (
            <Chip
              key={preset.id}
              icon={isActive ? 'check' : 'account-key-outline'}
              selectedColor={isActive ? '#ffffff' : undefined}
              style={[
                styles.presetChip,
                isActive && {backgroundColor: colors.primary},
              ]}
              onPress={() => applyPreset(preset)}>
              {preset.label}
            </Chip>
          );
        })}
      </ScrollView>

      <Divider style={styles.divider} />

      {PERMISSION_DOMAINS.map(domain => {
        const {status, count, total} = domainState(domain);

        return (
          <List.Accordion
            key={domain.moduleKey}
            title={domain.label}
            description={`${count} of ${total} allowed`}
            left={props => (
              <List.Icon {...props} icon={domain.icon} style={styles.domainIcon} />
            )}
            titleStyle={styles.domainTitle}
            style={[styles.accordion, {backgroundColor: colors.surface}]}>
            <Checkbox.Item
              label="Select all"
              position="leading"
              labelStyle={[styles.selectAllLabel, {color: colors.primary}]}
              style={styles.actionItem}
              status={status}
              onPress={() => setDomainChecked(domain, status !== 'checked')}
            />
            {domain.actions.map(action => (
              <Checkbox.Item
                key={action.key}
                label={action.label}
                position="leading"
                labelStyle={styles.actionLabel}
                status={checked.has(action.key) ? 'checked' : 'unchecked'}
                onPress={() => toggleAction(action.key)}
                style={styles.actionItem}
              />
            ))}
          </List.Accordion>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  presetLabel: {
    marginTop: 4,
    marginBottom: 2,
  },
  presetRow: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  presetChip: {
    marginRight: 8,
  },
  divider: {
    marginVertical: 8,
  },
  accordion: {
    paddingVertical: 2,
  },
  domainIcon: {
    marginRight: 0,
  },
  domainTitle: {
    fontWeight: '600',
  },
  selectAllLabel: {
    fontWeight: 'bold',
    textAlign: 'left',
  },
  actionLabel: {
    textAlign: 'left',
  },
  actionItem: {
    paddingLeft: 24,
  },
});

// Memoized: this editor lives inside Formik's render-prop tree, so without this
// it would re-render its ~26-accordion subtree on every keystroke in the role
// name field (making typing laggy and swallowing taps on Cancel/Create). Its
// props (initialConfig, onChange) are referentially stable during an open
// session, so memoizing skips those unrelated re-renders entirely.
export default React.memo(RolePermissionEditor);
