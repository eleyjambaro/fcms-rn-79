import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, Checkbox, ActivityIndicator, useTheme} from 'react-native-paper';

/**
 * Presentational multi-select checkbox list used to grant a sub-account access
 * to branches / devices while creating the user. Selection is controlled by the
 * parent (Formik) via `selectedIds` + `onToggle`; nothing is persisted here.
 *
 * `currentId` highlights the active branch / device with a `(currentLabel)` hint
 * so the admin can see which one is selected by default.
 */
const AccessCheckboxList = ({
  items = [],
  isLoading = false,
  selectedIds = [],
  onToggle,
  currentId = null,
  currentLabel = 'Current',
  emptyText = 'No items found.',
}) => {
  const {colors} = useTheme();
  const selectedSet = new Set(selectedIds);

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} />;
  }

  if (!items.length) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  return (
    <View>
      {items.map(item => {
        const isChecked = selectedSet.has(item.id);
        const isCurrent = currentId != null && item.id === currentId;

        return (
          <View key={item.id} style={styles.row}>
            <Checkbox.Android
              status={isChecked ? 'checked' : 'unchecked'}
              onPress={() => onToggle(item.id)}
              color={colors.primary}
            />
            <Text style={styles.name}>
              {item.name}
              {isCurrent ? (
                <Text style={[styles.currentHint, {color: colors.primary}]}>
                  {`  (${currentLabel})`}
                </Text>
              ) : null}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  loader: {
    marginVertical: 16,
  },
  empty: {
    textAlign: 'center',
    opacity: 0.5,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  name: {
    fontSize: 15,
    marginLeft: 8,
    flex: 1,
  },
  currentHint: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});

export default AccessCheckboxList;
