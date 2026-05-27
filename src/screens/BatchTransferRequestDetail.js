import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ToastAndroid,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  Dialog,
  Portal,
  TextInput,
  ActivityIndicator,
  Divider,
  useTheme,
} from 'react-native-paper';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import routes from '../constants/routes';
import {getBranches} from '../serverDbQueries/v2/branches';
import {getCloudSyncParams} from '../localDb';
import {
  getBatchTransferRequest,
  getBatchTransferEntries,
  submitBatchTransferRequest,
  cancelDraftBatchTransfer,
  cancelBatchTransferRequest,
  acceptBatchTransferRequest,
  rejectBatchTransferRequest,
  confirmTransferOut,
  updateEntryDestReview,
  updateEntrySourceAdjustment,
  markBatchTransferViewed,
  removeBatchTransferEntry,
} from '../localDbQueries/batchTransfer';
import TransferStatusBadge from '../components/batchTransfer/TransferStatusBadge';

const STATUS = {
  DRAFT: 'draft',
  REQUESTED: 'requested',
  ACCEPTED: 'accepted',
  TRANSFERRING: 'transferring',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

const formatDate = iso => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
};

const EntryRow = ({entry, group, isSource, isDest, onEdit, onRemove}) => {
  const {colors} = useTheme();
  const status = group?.status;
  const isDraft = status === STATUS.DRAFT;
  const canDestReview = isDest && status === STATUS.REQUESTED;
  const canSourceAdjust = isSource && status === STATUS.ACCEPTED;

  const primaryQty = (() => {
    if (status === STATUS.RECEIVED) return entry.received_qty;
    if (status === STATUS.TRANSFERRING) return entry.adjusted_qty ?? entry.accepted_qty;
    if (status === STATUS.ACCEPTED) return entry.adjusted_qty ?? entry.accepted_qty;
    if (status === STATUS.REQUESTED) return entry.accepted_qty ?? entry.requested_qty;
    return entry.requested_qty;
  })();

  const editable = isDraft && isSource || canDestReview || canSourceAdjust;

  return (
    <View style={styles.entry}>
      <View style={styles.entryHeader}>
        <View style={{flex: 1}}>
          <Text style={styles.entryName} numberOfLines={2}>
            {entry.item_display_name}
          </Text>
          {entry.item_display_sku ? (
            <Text style={styles.entryMeta}>SKU {entry.item_display_sku}</Text>
          ) : null}
        </View>
        <Text style={styles.entryQty}>
          {primaryQty != null ? `${parseFloat(primaryQty)} ${entry.item_uom_abbrev || ''}` : '—'}
        </Text>
        {editable ? (
          <Pressable onPress={() => onEdit(entry)} style={styles.editBtn}>
            <MaterialCommunityIcons
              name="pencil"
              size={20}
              color={colors.primary}
            />
          </Pressable>
        ) : null}
      </View>

      {/* Per-status detail lines */}
      <View style={styles.entryDetailLines}>
        {entry.requested_qty != null && status !== STATUS.DRAFT ? (
          <Text style={styles.detailLine}>
            Requested: {parseFloat(entry.requested_qty)}{' '}
            {entry.item_uom_abbrev || ''}
          </Text>
        ) : null}
        {entry.accepted_qty != null ? (
          <Text style={styles.detailLine}>
            Accepted: {parseFloat(entry.accepted_qty)}{' '}
            {entry.item_uom_abbrev || ''}
          </Text>
        ) : null}
        {entry.adjusted_qty != null ? (
          <Text style={styles.detailLine}>
            Adjusted: {parseFloat(entry.adjusted_qty)}{' '}
            {entry.item_uom_abbrev || ''}
          </Text>
        ) : null}
        {entry.received_qty != null && status === STATUS.RECEIVED ? (
          <Text style={[styles.detailLine, {color: '#43A047'}]}>
            Received: {parseFloat(entry.received_qty)}{' '}
            {entry.item_uom_abbrev || ''}
          </Text>
        ) : null}
      </View>

      {entry.source_remarks ? (
        <Text style={styles.remarkLine}>
          • Source: {entry.source_remarks}
        </Text>
      ) : null}
      {entry.dest_remarks ? (
        <Text style={styles.remarkLine}>
          • Destination: {entry.dest_remarks}
        </Text>
      ) : null}

      {isDraft && isSource && onRemove ? (
        <Pressable onPress={() => onRemove(entry)} style={styles.removeBtn}>
          <Text style={{color: colors.error, fontSize: 12}}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const BatchTransferRequestDetail = ({navigation, route}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const groupId = route.params?.groupId;

  const [currentBranchId, setCurrentBranchId] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [editValues, setEditValues] = useState({qty: '', remarks: ''});
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {branchId} = await getCloudSyncParams();
      if (!cancelled) setCurrentBranchId(branchId);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const {data: branchesData} = useQuery(
    ['branches', {per_page: 100}],
    () => getBranches({per_page: 100}),
  );

  const branchById = useMemo(() => {
    const rows = branchesData?.data?.data ?? branchesData?.data ?? [];
    const map = {};
    for (const b of rows) map[b.id] = b;
    return map;
  }, [branchesData]);

  // Mark as viewed once we know our role
  useEffect(() => {
    if (groupId && currentBranchId) {
      markBatchTransferViewed({groupId}).then(() => {
        queryClient.invalidateQueries(['batchTransferRequests']);
        queryClient.invalidateQueries(['batchTransferUnreadCount']);
      });
    }
  }, [groupId, currentBranchId, queryClient]);

  const isSource = group?.source_branch_id === currentBranchId;
  const isDest = group?.destination_branch_id === currentBranchId;

  const invalidateAll = () => {
    queryClient.invalidateQueries(['batchTransferRequest', {groupId}]);
    queryClient.invalidateQueries(['batchTransferEntries', {groupId}]);
    queryClient.invalidateQueries(['batchTransferRequests']);
    queryClient.invalidateQueries(['batchTransferUnreadCount']);
  };

  const handleErr = err =>
    ToastAndroid.show(err?.message || 'Action failed.', ToastAndroid.LONG);

  const submitMut = useMutation(submitBatchTransferRequest, {
    onSuccess: invalidateAll,
    onError: handleErr,
  });
  const cancelDraftMut = useMutation(cancelDraftBatchTransfer, {
    onSuccess: () => {
      invalidateAll();
      navigation.goBack();
    },
    onError: handleErr,
  });
  const cancelMut = useMutation(cancelBatchTransferRequest, {
    onSuccess: invalidateAll,
    onError: handleErr,
  });
  const acceptMut = useMutation(acceptBatchTransferRequest, {
    onSuccess: invalidateAll,
    onError: handleErr,
  });
  const rejectMut = useMutation(rejectBatchTransferRequest, {
    onSuccess: () => {
      invalidateAll();
      setRejectVisible(false);
      setRejectReason('');
    },
    onError: handleErr,
  });
  const transferOutMut = useMutation(confirmTransferOut, {
    onSuccess: invalidateAll,
    onError: handleErr,
  });
  const destReviewMut = useMutation(updateEntryDestReview, {
    onSuccess: () => {
      invalidateAll();
      setEditEntry(null);
    },
    onError: handleErr,
  });
  const sourceAdjustMut = useMutation(updateEntrySourceAdjustment, {
    onSuccess: () => {
      invalidateAll();
      setEditEntry(null);
    },
    onError: handleErr,
  });
  const removeEntryMut = useMutation(removeBatchTransferEntry, {
    onSuccess: invalidateAll,
    onError: handleErr,
  });

  if (groupStatus === 'loading' || !currentBranchId) {
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

  const sourceBranch = branchById[group.source_branch_id];
  const destBranch = branchById[group.destination_branch_id];

  const openEditor = entry => {
    setEditEntry(entry);
    if (group.status === STATUS.REQUESTED && isDest) {
      setEditValues({
        qty: entry.accepted_qty != null
          ? String(parseFloat(entry.accepted_qty))
          : String(parseFloat(entry.requested_qty || 0)),
        remarks: entry.dest_remarks || '',
      });
    } else if (group.status === STATUS.ACCEPTED && isSource) {
      setEditValues({
        qty: entry.adjusted_qty != null
          ? String(parseFloat(entry.adjusted_qty))
          : String(parseFloat(entry.accepted_qty || 0)),
        remarks: entry.source_remarks || '',
      });
    } else {
      setEditValues({qty: '', remarks: ''});
    }
  };

  const saveEditor = () => {
    if (!editEntry) return;
    if (group.status === STATUS.REQUESTED && isDest) {
      destReviewMut.mutate({
        entryId: editEntry.id,
        acceptedQty: editValues.qty,
        destRemarks: editValues.remarks || null,
      });
    } else if (group.status === STATUS.ACCEPTED && isSource) {
      sourceAdjustMut.mutate({
        entryId: editEntry.id,
        adjustedQty: editValues.qty,
        sourceRemarks: editValues.remarks || null,
      });
    }
  };

  // Footer action buttons per (status, role)
  const renderActions = () => {
    const status = group.status;
    const buttons = [];

    if (status === STATUS.DRAFT && isSource) {
      buttons.push(
        <Button
          key="edit"
          mode="outlined"
          onPress={() =>
            navigation.navigate(routes.batchTransferItemSelection(), {
              groupId,
              destinationBranchId: group.destination_branch_id,
            })
          }>
          Edit Items
        </Button>,
      );
      buttons.push(
        <Button
          key="discard"
          color={colors.error}
          onPress={() =>
            Alert.alert('Discard draft?', 'This cannot be undone.', [
              {text: 'Cancel'},
              {
                text: 'Discard',
                style: 'destructive',
                onPress: () => cancelDraftMut.mutate({groupId}),
              },
            ])
          }>
          Discard
        </Button>,
      );
      buttons.push(
        <Button
          key="submit"
          mode="contained"
          loading={submitMut.isLoading}
          disabled={entries.length === 0 || submitMut.isLoading}
          onPress={() => submitMut.mutate({groupId})}>
          Submit Request
        </Button>,
      );
    } else if (status === STATUS.REQUESTED && isSource) {
      buttons.push(
        <Button
          key="cancel"
          mode="outlined"
          color={colors.error}
          loading={cancelMut.isLoading}
          onPress={() => cancelMut.mutate({groupId})}>
          Cancel Request
        </Button>,
      );
    } else if (status === STATUS.REQUESTED && isDest) {
      buttons.push(
        <Button
          key="reject"
          mode="outlined"
          color={colors.error}
          onPress={() => setRejectVisible(true)}>
          Reject
        </Button>,
      );
      buttons.push(
        <Button
          key="accept"
          mode="contained"
          loading={acceptMut.isLoading}
          onPress={() => acceptMut.mutate({groupId})}>
          Accept Transfer In Request
        </Button>,
      );
    } else if (status === STATUS.ACCEPTED && isSource) {
      buttons.push(
        <Button
          key="cancel"
          mode="outlined"
          color={colors.error}
          loading={cancelMut.isLoading}
          onPress={() => cancelMut.mutate({groupId})}>
          Cancel
        </Button>,
      );
      buttons.push(
        <Button
          key="transfer"
          mode="contained"
          loading={transferOutMut.isLoading}
          onPress={() =>
            Alert.alert(
              'Confirm transfer-out',
              'Mark this request as physically dispatched? The destination will be notified.',
              [
                {text: 'Cancel'},
                {
                  text: 'Transfer',
                  onPress: () => transferOutMut.mutate({groupId}),
                },
              ],
            )
          }>
          Transfer
        </Button>,
      );
    } else if (status === STATUS.TRANSFERRING && isDest) {
      buttons.push(
        <Button
          key="receive"
          mode="contained"
          onPress={() =>
            navigation.navigate(routes.batchTransferReceive(), {groupId})
          }>
          Mark Transfer Received
        </Button>,
      );
    }

    return buttons;
  };

  return (
    <View style={{flex: 1}}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <TransferStatusBadge status={group.status} />
            <Text style={styles.uuid} numberOfLines={1}>
              #{String(group.id).slice(0, 8)}
            </Text>
          </View>

          <View style={styles.branchesRow}>
            <View style={styles.branchCol}>
              <MaterialCommunityIcons
                name="map-marker"
                size={18}
                color="#E53935"
              />
              <Text style={styles.branchLabel}>Origin</Text>
              <Text style={styles.branchName} numberOfLines={2}>
                {sourceBranch?.display_name || sourceBranch?.name || '—'}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="arrow-right-bold"
              size={20}
              color={colors.disabled}
            />
            <View style={styles.branchCol}>
              <MaterialCommunityIcons
                name="map-marker"
                size={18}
                color="#1E88E5"
              />
              <Text style={styles.branchLabel}>Destination</Text>
              <Text style={styles.branchName} numberOfLines={2}>
                {destBranch?.display_name || destBranch?.name || '—'}
              </Text>
            </View>
          </View>

          {group.date_requested ? (
            <Text style={styles.timestamp}>
              Requested {formatDate(group.date_requested)}
            </Text>
          ) : null}
          {group.date_accepted ? (
            <Text style={styles.timestamp}>
              Accepted {formatDate(group.date_accepted)}
            </Text>
          ) : null}
          {group.date_transferring ? (
            <Text style={styles.timestamp}>
              Transferring {formatDate(group.date_transferring)}
            </Text>
          ) : null}
          {group.date_received ? (
            <Text style={styles.timestamp}>
              Received {formatDate(group.date_received)}
            </Text>
          ) : null}
          {group.date_cancelled ? (
            <Text style={styles.timestamp}>
              Cancelled {formatDate(group.date_cancelled)}
            </Text>
          ) : null}
          {group.date_rejected ? (
            <Text style={styles.timestamp}>
              Rejected {formatDate(group.date_rejected)}
            </Text>
          ) : null}

          {group.source_remarks ? (
            <Text style={styles.remarkLine}>
              Source note: {group.source_remarks}
            </Text>
          ) : null}
          {group.dest_remarks ? (
            <Text style={styles.remarkLine}>
              Destination note: {group.dest_remarks}
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionHeading}>
          Items ({entries.length})
        </Text>

        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{opacity: 0.7}}>No items yet.</Text>
          </View>
        ) : (
          entries.map(entry => (
            <EntryRow
              key={entry.id}
              entry={entry}
              group={group}
              isSource={isSource}
              isDest={isDest}
              onEdit={openEditor}
              onRemove={
                group.status === STATUS.DRAFT
                  ? e => removeEntryMut.mutate({entryId: e.id})
                  : null
              }
            />
          ))
        )}
      </ScrollView>

      <Divider />
      <View style={[styles.footerBar, {backgroundColor: colors.surface}]}>
        {renderActions()}
      </View>

      {/* Edit-entry dialog (per-entry adjust/review) */}
      <Portal>
        <Dialog
          visible={!!editEntry}
          onDismiss={() => setEditEntry(null)}>
          <Dialog.Title numberOfLines={1}>
            {editEntry?.item_display_name}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{marginBottom: 8, opacity: 0.7}}>
              {group.status === STATUS.REQUESTED && isDest
                ? `Set the qty you can accept (0 = decline this item). Requested: ${parseFloat(editEntry?.requested_qty || 0)} ${editEntry?.item_uom_abbrev || ''}`
                : group.status === STATUS.ACCEPTED && isSource
                ? `Adjust the qty you'll actually send. Accepted: ${parseFloat(editEntry?.accepted_qty || 0)} ${editEntry?.item_uom_abbrev || ''}`
                : ''}
            </Text>
            <TextInput
              label={`Qty (${editEntry?.item_uom_abbrev || ''})`}
              value={editValues.qty}
              onChangeText={v =>
                setEditValues(s => ({...s, qty: v}))
              }
              keyboardType="decimal-pad"
              dense
              autoFocus
              style={{marginBottom: 8}}
            />
            <TextInput
              label="Remarks (optional)"
              value={editValues.remarks}
              onChangeText={v =>
                setEditValues(s => ({...s, remarks: v}))
              }
              dense
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditEntry(null)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={saveEditor}
              loading={destReviewMut.isLoading || sourceAdjustMut.isLoading}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={rejectVisible}
          onDismiss={() => setRejectVisible(false)}>
          <Dialog.Title>Reject this request?</Dialog.Title>
          <Dialog.Content>
            <Text style={{marginBottom: 8, opacity: 0.7}}>
              The source branch will be notified. No inventory will change.
            </Text>
            <TextInput
              label="Reason (optional)"
              value={rejectReason}
              onChangeText={setRejectReason}
              dense
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRejectVisible(false)}>Cancel</Button>
            <Button
              mode="contained"
              color={colors.error}
              onPress={() =>
                rejectMut.mutate({groupId, reason: rejectReason || null})
              }
              loading={rejectMut.isLoading}>
              Reject
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {padding: 12, paddingBottom: 80},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  headerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  uuid: {fontSize: 11, fontWeight: '600', opacity: 0.6, maxWidth: 110},
  branchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  branchCol: {flex: 1, alignItems: 'center'},
  branchLabel: {fontSize: 11, opacity: 0.65, marginTop: 2},
  branchName: {fontSize: 13, fontWeight: '600', textAlign: 'center'},
  timestamp: {fontSize: 11, opacity: 0.7, marginTop: 2},
  remarkLine: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.85,
    marginTop: 6,
  },
  sectionHeading: {fontSize: 14, fontWeight: '600', marginBottom: 6},
  entry: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    elevation: 0.5,
  },
  entryHeader: {flexDirection: 'row', alignItems: 'center'},
  entryName: {fontSize: 15, fontWeight: '500'},
  entryMeta: {fontSize: 11, opacity: 0.6, marginTop: 2},
  entryQty: {fontSize: 14, fontWeight: '600', marginHorizontal: 8},
  editBtn: {padding: 4},
  entryDetailLines: {marginTop: 4, paddingLeft: 2},
  detailLine: {fontSize: 11, opacity: 0.75, marginTop: 1},
  removeBtn: {marginTop: 6, alignSelf: 'flex-end'},
  empty: {padding: 20, alignItems: 'center'},
  footerBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'flex-end',
  },
});

export default BatchTransferRequestDetail;
