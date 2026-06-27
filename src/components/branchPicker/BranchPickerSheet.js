import React, {useMemo, useState} from 'react';
import {View, FlatList, StyleSheet, Pressable} from 'react-native';
import {
  Modal,
  Portal,
  Searchbar,
  Text,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import {useQuery} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {getBranches} from '../../serverDbQueries/v2/branches';

/**
 * Bottom-sheet style branch autocomplete used by BatchTransferRequestForm.
 *
 * Props:
 *   visible          — show/hide
 *   onDismiss        — close handler
 *   onSelect(branch) — fired when the user picks a branch
 *   excludeBranchId  — typically the current branch
 *   title            — header text
 */
const BranchPickerSheet = ({
  visible,
  onDismiss,
  onSelect,
  excludeBranchId,
  title = 'Select destination branch',
}) => {
  const {colors} = useTheme();
  const [search, setSearch] = useState('');

  // Counterparty picker: list ALL company branches, not just the ones this user
  // is assigned to operate in — a transfer Source/Destination can be any branch.
  const {data, status} = useQuery(
    ['branches', {per_page: 100, all: true}],
    () => getBranches({per_page: 100, all: true}),
    {enabled: visible},
  );

  const branches = useMemo(() => {
    const rows = data?.data?.data ?? data?.data ?? [];
    const lowered = search.trim().toLowerCase();
    return rows
      .filter(b => b.id !== excludeBranchId)
      .filter(b => {
        if (!lowered) return true;
        return (
          (b.name || '').toLowerCase().includes(lowered) ||
          (b.display_name || '').toLowerCase().includes(lowered) ||
          (b.address || '').toLowerCase().includes(lowered)
        );
      });
  }, [data, search, excludeBranchId]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          {backgroundColor: colors.surface},
        ]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onDismiss}>
            <MaterialCommunityIcons name="close" size={22} color={colors.dark} />
          </Pressable>
        </View>

        <Searchbar
          placeholder="Search branches"
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />

        {status === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : status === 'error' ? (
          <View style={styles.center}>
            <Text>Failed to load branches.</Text>
          </View>
        ) : branches.length === 0 ? (
          <View style={styles.center}>
            <Text>No other branches available.</Text>
          </View>
        ) : (
          <FlatList
            data={branches}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({item}) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onDismiss();
                }}
                style={({pressed}) => [
                  styles.row,
                  pressed && {backgroundColor: colors.surface},
                ]}>
                <MaterialCommunityIcons
                  name="map-marker-radius"
                  size={22}
                  color={colors.primary}
                  style={{marginRight: 10}}
                />
                <View style={{flex: 1}}>
                  <Text style={styles.rowTitle}>
                    {item.display_name || item.name}
                  </Text>
                  {item.address ? (
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {item.address}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    marginHorizontal: 16,
    marginVertical: 60,
    borderRadius: 12,
    paddingTop: 12,
    paddingBottom: 8,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {fontSize: 16, fontWeight: '600'},
  search: {marginHorizontal: 12, marginBottom: 8},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowTitle: {fontSize: 15, fontWeight: '500'},
  rowSubtitle: {fontSize: 12, opacity: 0.7, marginTop: 2},
  center: {paddingVertical: 30, alignItems: 'center'},
});

export default BranchPickerSheet;
