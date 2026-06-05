import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ToastAndroid,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  TextInput,
  Divider,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {
  getBatchTransferRequest,
  getBatchTransferEntries,
  confirmTransferReceived,
  updateEntryReceivedQty,
} from '../localDbQueries/batchTransfer';
import {formatTransferUOMAbbrev} from '../utils/stringHelpers';
import useRoleAccess from '../hooks/useRoleAccess';
import {TRANSFER_PERMISSIONS} from '../constants/transferPermissions';

const BatchTransferReceive = ({navigation, route}) => {
  const {colors} = useTheme();
  const {can} = useRoleAccess();
  const canReceiveTransfer = can(TRANSFER_PERMISSIONS.RECEIVE);
  const queryClient = useQueryClient();
  const groupId = route.params?.groupId;
  const [localQty, setLocalQty] = useState({});

  const {data: group, status: groupStatus} = useQuery(
    ['batchTransferRequest', {groupId}],
    getBatchTransferRequest,
    {enabled: !!groupId},
  );
  const {data: entries = []} = useQuery(
    ['batchTransferEntries', {groupId}],
    getBatchTransferEntries,
    {enabled: !!groupId},
  );

  // Default each entry's received-input to its adjusted_qty (or accepted_qty).
  useEffect(() => {
    if (!entries.length) return;
    setLocalQty(prev => {
      const next = {...prev};
      for (const e of entries) {
        if (next[e.id] === undefined) {
          const defaultQty = e.received_qty ?? e.adjusted_qty ?? e.accepted_qty;
          next[e.id] = defaultQty != null ? String(parseFloat(defaultQty)) : '';
        }
      }
      return next;
    });
  }, [entries]);

  const persistQtyMut = useMutation(updateEntryReceivedQty);
  const confirmMut = useMutation(confirmTransferReceived, {
    onSuccess: () => {
      queryClient.invalidateQueries(['batchTransferRequest', {groupId}]);
      queryClient.invalidateQueries(['batchTransferEntries', {groupId}]);
      queryClient.invalidateQueries(['batchTransferRequests']);
      queryClient.invalidateQueries(['items']);
      queryClient.invalidateQueries(['inventoryLogs']);
      ToastAndroid.show(
        'Transfer received. Inventory updated.',
        ToastAndroid.LONG,
      );
      navigation.goBack();
    },
    onError: err =>
      ToastAndroid.show(err?.message || 'Failed.', ToastAndroid.LONG),
  });

  const handleConfirm = async () => {
    // Persist every entry's received_qty first so confirmTransferReceived sees
    // the latest values. We await each so SQLite stays consistent.
    for (const e of entries) {
      const raw = localQty[e.id];
      const num = parseFloat(raw);
      const next = Number.isFinite(num) ? num : 0;
      // Skip if unchanged
      if (parseFloat(e.received_qty) === next) continue;
      await persistQtyMut.mutateAsync({entryId: e.id, receivedQty: next});
    }
    confirmMut.mutate({groupId});
  };

  const summary = useMemo(() => {
    let lines = 0;
    let totalQty = 0;
    for (const e of entries) {
      const raw = localQty[e.id];
      const num = parseFloat(raw);
      if (Number.isFinite(num) && num > 0) {
        lines += 1;
        totalQty += num;
      }
    }
    return {lines, totalQty};
  }, [entries, localQty]);

  if (groupStatus === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!group) {
    return (
      <View style={styles.center}>
        <Text>Request not found.</Text>
      </View>
    );
  }
  if (group.status !== 'transferring') {
    return (
      <View style={styles.center}>
        <Text>This transfer is not ready to receive.</Text>
        <Text style={{opacity: 0.7, marginTop: 6}}>
          Current status: {group.status}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={entries}
        keyExtractor={e => e.id}
        ListHeaderComponent={
          <Text style={styles.intro}>
            Verify what physically arrived and adjust each item's received
            quantity. Default is the qty the source agreed to send.
          </Text>
        }
        renderItem={({item: entry}) => (
          <View style={styles.row}>
            <View style={{flex: 1}}>
              <Text style={styles.name} numberOfLines={2}>
                {entry.item_display_name}
              </Text>
              <Text style={styles.meta}>
                Source agreed:{' '}
                {parseFloat(entry.adjusted_qty ?? entry.accepted_qty ?? 0)}{' '}
                {formatTransferUOMAbbrev(entry.item_uom_abbrev)}
              </Text>
            </View>
            <TextInput
              label={`Received (${formatTransferUOMAbbrev(
                entry.item_uom_abbrev,
              )})`}
              value={localQty[entry.id] ?? ''}
              onChangeText={v =>
                setLocalQty(s => ({...s, [entry.id]: v}))
              }
              keyboardType="decimal-pad"
              dense
              style={styles.qtyInput}
            />
          </View>
        )}
        contentContainerStyle={{paddingBottom: 12}}
      />

      <Divider />
      <View style={[styles.footer, {backgroundColor: colors.surface}]}>
        <Text style={styles.footerSummary}>
          {summary.lines} of {entries.length} items will be recorded.
        </Text>
        <Button
          mode="contained"
          onPress={handleConfirm}
          loading={confirmMut.isLoading || persistQtyMut.isLoading}
          disabled={
            !canReceiveTransfer ||
            confirmMut.isLoading ||
            persistQtyMut.isLoading
          }>
          Confirm Received
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  intro: {fontSize: 13, opacity: 0.75, padding: 16},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  name: {fontSize: 14, fontWeight: '500'},
  meta: {fontSize: 11, opacity: 0.65, marginTop: 2},
  qtyInput: {width: 130, marginLeft: 12, backgroundColor: 'transparent'},
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  footerSummary: {fontSize: 12, opacity: 0.75, marginBottom: 6},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
});

export default BatchTransferReceive;
