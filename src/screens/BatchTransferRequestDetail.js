import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ToastAndroid,
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
import {CommonActions} from '@react-navigation/native';
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
  updateDraftBatchTransferEntry,
  resolveMissingSourceItemIdsForGroup,
} from '../localDbQueries/batchTransfer';
import TransferStatusBadge, {
  STATUS_COLORS,
} from '../components/batchTransfer/TransferStatusBadge';
import TransferStatusTimeline from '../components/batchTransfer/TransferStatusTimeline';
import {
  formatTransferUOMAbbrev,
  formatBatchTransferRefNo,
} from '../utils/stringHelpers';
import useRoleAccess from '../hooks/useRoleAccess';
import {TRANSFER_PERMISSIONS} from '../constants/transferPermissions';

const OUT_BADGE_COLOR = '#E53935';
const IN_BADGE_COLOR = '#1E88E5';

const STATUS = {
  DRAFT: 'draft',
  REQUESTED: 'requested',
  ACCEPTED: 'accepted',
  TRANSFERRING: 'transferring',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

// SQLite's CURRENT_TIMESTAMP returns 'YYYY-MM-DD HH:MM:SS' in UTC. JS's Date
// parses that space-separated form as LOCAL time on most engines, which makes
// the rendered time wrong by the local timezone offset. Force-ISO it with a
// 'T' and a trailing 'Z' so the conversion to local for display is correct.
const formatDate = raw => {
  if (!raw) return '';
  try {
    const str = String(raw);
    const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str)
      ? str.replace(' ', 'T') + 'Z'
      : str;
    return new Date(iso).toLocaleString();
  } catch {
    return String(raw);
  }
};

// Batch Transfer UOM display rule lives in stringHelpers (single source).
const formatUOM = formatTransferUOMAbbrev;

const EntryRow = ({
  entry,
  group,
  isSource,
  isDest,
  isInitiator,
  isCounterparty,
  canEdit = true,
  onEdit,
  onRemove,
}) => {
  const {colors} = useTheme();
  const status = group?.status;
  const isDraft = status === STATUS.DRAFT;
  // Counterparty reviews entries at REQUESTED (dest for Out, source for In).
  const canCounterpartyReview = isCounterparty && status === STATUS.REQUESTED;
  // Source physically dispatches at ACCEPTED regardless of who initiated.
  const canSourceAdjust = isSource && status === STATUS.ACCEPTED;

  const primaryQty = (() => {
    if (status === STATUS.RECEIVED) return entry.received_qty;
    if (status === STATUS.TRANSFERRING)
      return entry.adjusted_qty ?? entry.accepted_qty;
    if (status === STATUS.ACCEPTED)
      return entry.adjusted_qty ?? entry.accepted_qty;
    if (status === STATUS.REQUESTED)
      return entry.accepted_qty ?? entry.requested_qty;
    return entry.requested_qty;
  })();

  const editable =
    canEdit &&
    ((isDraft && isInitiator) || canCounterpartyReview || canSourceAdjust);

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
          {primaryQty != null
            ? `${parseFloat(primaryQty)} ${formatUOM(entry.item_uom_abbrev)}`
            : '—'}
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
            {formatUOM(entry.item_uom_abbrev)}
          </Text>
        ) : null}
        {entry.accepted_qty != null ? (
          <Text style={styles.detailLine}>
            Accepted: {parseFloat(entry.accepted_qty)}{' '}
            {formatUOM(entry.item_uom_abbrev)}
          </Text>
        ) : null}
        {entry.adjusted_qty != null ? (
          <Text style={styles.detailLine}>
            Transferring: {parseFloat(entry.adjusted_qty)}{' '}
            {formatUOM(entry.item_uom_abbrev)}
          </Text>
        ) : null}
        {entry.received_qty != null && status === STATUS.RECEIVED ? (
          <Text style={[styles.detailLine, {color: '#43A047'}]}>
            Received: {parseFloat(entry.received_qty)}{' '}
            {formatUOM(entry.item_uom_abbrev)}
          </Text>
        ) : null}
      </View>

      {entry.source_remarks ? (
        <Text style={styles.remarkLine}>• Source: {entry.source_remarks}</Text>
      ) : null}
      {entry.dest_remarks ? (
        <Text style={styles.remarkLine}>
          • Destination: {entry.dest_remarks}
        </Text>
      ) : null}

      {isDraft && isInitiator && onRemove ? (
        <Pressable onPress={() => onRemove(entry)} style={styles.removeBtn}>
          <Text style={{color: colors.error, fontSize: 12}}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const BatchTransferRequestDetail = ({navigation, route}) => {
  const {colors} = useTheme();
  const {can} = useRoleAccess();
  const canCreateTransfer = can(TRANSFER_PERMISSIONS.CREATE);
  const canReviewTransfer = can(TRANSFER_PERMISSIONS.REVIEW);
  const canTransferOut = can(TRANSFER_PERMISSIONS.TRANSFER_OUT);
  const canReceiveTransfer = can(TRANSFER_PERMISSIONS.RECEIVE);
  const queryClient = useQueryClient();
  const groupId = route.params?.groupId;

  const [currentBranchId, setCurrentBranchId] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [editValues, setEditValues] = useState({qty: '', remarks: ''});
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  // Generic confirmation dialog (replaces native Alert.alert so confirmations
  // match the app's Paper dialog styling). Shape:
  // {title, message, confirmLabel, cancelLabel, destructive, onConfirm}
  const [confirm, setConfirm] = useState(null);

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
  const {data: branchesData} = useQuery(['branches', {per_page: 100}], () =>
    getBranches({per_page: 100}),
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

  // In-mode: the destination (initiator) created entries without knowing the
  // source's local item ids. When the source counterparty opens a REQUESTED
  // group, walk the entries and try to resolve source_item_id via the
  // master_item_id bridge so the source-adjust + materialize paths can write
  // the stock_transfer_out log later. Idempotent — entries with no master
  // match stay NULL and the editor locks qty to 0.
  useEffect(() => {
    if (!groupId || !group) return;
    if (
      group.status === STATUS.REQUESTED &&
      group.source_branch_id === currentBranchId &&
      group.destination_branch_id !== currentBranchId
    ) {
      resolveMissingSourceItemIdsForGroup({groupId}).then(count => {
        if (count > 0) {
          queryClient.invalidateQueries(['batchTransferEntries', {groupId}]);
        }
      });
    }
  }, [groupId, group, currentBranchId, queryClient]);

  const isSource = group?.source_branch_id === currentBranchId;
  const isDest = group?.destination_branch_id === currentBranchId;
  // Initiator is whoever created the request (Out: source = current;
  // In: destination = current). Fall back to source_branch_id for any legacy
  // row that survived the alterTables backfill with a NULL value.
  const initiatorBranchId =
    group?.initiator_branch_id ?? group?.source_branch_id;
  const isInitiator = initiatorBranchId === currentBranchId;
  const isCounterparty = !!group && !isInitiator;
  // Direction (In/Out) is from the current branch's perspective: Out if we
  // dispatch (source), In if we receive (destination).
  const directionForCurrent = isSource ? 'out' : isDest ? 'in' : null;

  const invalidateAll = () => {
    queryClient.invalidateQueries(['batchTransferRequest', {groupId}]);
    queryClient.invalidateQueries(['batchTransferEntries', {groupId}]);
    queryClient.invalidateQueries(['batchTransferRequests']);
    queryClient.invalidateQueries(['batchTransferUnreadCount']);
  };

  const handleErr = err =>
    ToastAndroid.show(err?.message || 'Action failed.', ToastAndroid.LONG);

  const submitMut = useMutation(submitBatchTransferRequest, {
    onSuccess: () => {
      invalidateAll();
      // The draft-creation flow stacks ItemSelection ("Select Items to
      // Transfer") below this Detail screen. Once the request is submitted that
      // screen is stale, so drop it from the stack — the back gesture should
      // return to the Batch Transfer Requests list, not the item picker.
      const navState = navigation.getState();
      const itemSelectionName = routes.batchTransferItemSelection();
      const filtered = navState.routes.filter(
        r => r.name !== itemSelectionName,
      );
      if (filtered.length !== navState.routes.length) {
        navigation.dispatch(
          CommonActions.reset({
            ...navState,
            routes: filtered,
            index: filtered.length - 1,
          }),
        );
      }
    },
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
  const draftEntryMut = useMutation(updateDraftBatchTransferEntry, {
    onSuccess: () => {
      invalidateAll();
      setEditEntry(null);
    },
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

  // Counterparty's remark column on review: dest_remarks if I'm the dest
  // (Out-mode), source_remarks if I'm the source (In-mode).
  const counterpartyRemarksCol = isSource ? 'source_remarks' : 'dest_remarks';
  const counterpartyActorRole = isSource ? 'source' : 'dest';

  // For In-mode REQUESTED, the source counterparty can't fulfill an entry
  // whose master_item_id has no match in their local items table (or whose
  // master_item_id is NULL altogether — local-only item picked by dest). In
  // that case the editor locks qty to 0.
  const editEntryIsUnfulfillable =
    !!editEntry &&
    group?.status === STATUS.REQUESTED &&
    isSource &&
    isCounterparty &&
    (!editEntry.master_item_id || !editEntry.source_item_id);

  const openEditor = entry => {
    setEditEntry(entry);
    if (group.status === STATUS.REQUESTED && isCounterparty) {
      setEditValues({
        qty:
          entry.accepted_qty != null
            ? String(parseFloat(entry.accepted_qty))
            : String(parseFloat(entry.requested_qty || 0)),
        remarks: entry[counterpartyRemarksCol] || '',
      });
    } else if (group.status === STATUS.ACCEPTED && isSource) {
      setEditValues({
        qty:
          entry.adjusted_qty != null
            ? String(parseFloat(entry.adjusted_qty))
            : String(parseFloat(entry.accepted_qty || 0)),
        remarks: entry.source_remarks || '',
      });
    } else if (group.status === STATUS.DRAFT && isInitiator) {
      // Initiator's remark lives in source_remarks (Out) or dest_remarks (In).
      const draftRemarksCol =
        directionForCurrent === 'in' ? 'dest_remarks' : 'source_remarks';
      setEditValues({
        qty:
          entry.requested_qty != null
            ? String(parseFloat(entry.requested_qty))
            : '',
        remarks: entry[draftRemarksCol] || '',
      });
    } else {
      setEditValues({qty: '', remarks: ''});
    }
  };

  const saveEditor = () => {
    if (!editEntry) return;
    if (group.status === STATUS.REQUESTED && isCounterparty) {
      // Force qty=0 for unfulfillable entries even if user typed something.
      const qty = editEntryIsUnfulfillable ? '0' : editValues.qty;
      destReviewMut.mutate({
        entryId: editEntry.id,
        acceptedQty: qty,
        remarks: editValues.remarks || null,
        actorRole: counterpartyActorRole,
      });
    } else if (group.status === STATUS.ACCEPTED && isSource) {
      sourceAdjustMut.mutate({
        entryId: editEntry.id,
        adjustedQty: editValues.qty,
        sourceRemarks: editValues.remarks || null,
      });
    } else if (group.status === STATUS.DRAFT && isInitiator) {
      draftEntryMut.mutate({
        entryId: editEntry.id,
        qty: editValues.qty,
        remarks: editValues.remarks || null,
        direction: directionForCurrent,
      });
    }
  };

  const confirmCancelRequest = () =>
    setConfirm({
      title: 'Cancel this request?',
      message:
        'The other branch will be notified that the request was cancelled. No inventory will change.',
      confirmLabel: 'Cancel Request',
      cancelLabel: 'Keep Request',
      destructive: true,
      onConfirm: () => cancelMut.mutate({groupId}),
    });

  const confirmSubmitRequest = () => {
    const counterpartyBranch =
      directionForCurrent === 'out' ? destBranch : sourceBranch;
    const counterpartyName =
      counterpartyBranch?.display_name ||
      counterpartyBranch?.name ||
      'the other branch';
    setConfirm({
      title: 'Submit this request?',
      message: `${counterpartyName} will be notified to review and accept the requested items. You can still cancel it before they accept.`,
      confirmLabel: 'Submit Request',
      cancelLabel: 'Keep Editing',
      onConfirm: () => submitMut.mutate({groupId}),
    });
  };

  // Footer action buttons per (status, role).
  //   - Draft / Submit / Discard belong to the initiator.
  //   - Accept / Reject belong to the counterparty (dest for Out, source for In).
  //   - Transfer (physical dispatch) belongs to source regardless of direction.
  //   - Receive (physical receipt) belongs to dest regardless of direction.
  //   - Cancel before TRANSFERRING is allowed for initiator and, once accepted,
  //     also for source (in case they can't actually fulfill anymore).
  const renderActions = () => {
    const status = group.status;
    const buttons = [];

    if (status === STATUS.DRAFT && isInitiator && canCreateTransfer) {
      buttons.push(
        <Button
          key="submit"
          mode="contained"
          loading={submitMut.isLoading}
          disabled={entries.length === 0 || submitMut.isLoading}
          onPress={confirmSubmitRequest}>
          Submit Request
        </Button>,
      );
      buttons.push(
        <Button
          key="edit"
          mode="outlined"
          onPress={() =>
            navigation.navigate(routes.batchTransferItemSelection(), {
              groupId,
              counterpartyBranchId:
                directionForCurrent === 'out'
                  ? group.destination_branch_id
                  : group.source_branch_id,
              direction: directionForCurrent,
            })
          }>
          Edit Item Selection
        </Button>,
      );
      buttons.push(
        <Button
          key="discard"
          color={colors.error}
          onPress={() =>
            setConfirm({
              title: 'Discard draft?',
              message: 'This cannot be undone.',
              confirmLabel: 'Discard',
              destructive: true,
              onConfirm: () => cancelDraftMut.mutate({groupId}),
            })
          }>
          Discard
        </Button>,
      );
    } else if (status === STATUS.REQUESTED && isInitiator) {
      // Out-mode initiator (the source) can skip waiting for the destination
      // to accept and dispatch right away — useful when both branches have
      // already coordinated out-of-band (phone, text, email). Only the source
      // can physically dispatch, so gate on isSource (i.e. the Out direction);
      // an In-mode initiator (the destination) just waits and only sees Cancel.
      if (isSource && canTransferOut) {
        buttons.push(
          <View
            key="transfer-now-notice"
            style={[
              styles.readyNotice,
              {backgroundColor: colors.primary + '14'},
            ]}>
            <Text style={styles.readyNoticeHint}>
              Already coordinated with{' '}
              {destBranch?.display_name ||
                destBranch?.name ||
                'the destination branch'}{' '}
              by phone, text, or email?
            </Text>
            <Text style={styles.readyNoticeTitle}>
              Transfer now without waiting for them to accept? Tap "Transfer
              Now".
            </Text>
          </View>,
        );
        buttons.push(
          <Button
            key="transfer"
            mode="contained"
            loading={transferOutMut.isLoading}
            onPress={() =>
              setConfirm({
                title: 'Transfer now?',
                message: `Transfer to ${
                  destBranch?.display_name ||
                  destBranch?.name ||
                  'the destination branch'
                } now without waiting for them to accept? They'll be notified that the items are now transferring (in transit).`,
                confirmLabel: 'Transfer Now',
                onConfirm: () => transferOutMut.mutate({groupId}),
              })
            }>
            Transfer Now
          </Button>,
        );
      }
      if (canCreateTransfer) {
        buttons.push(
          <Button
            key="cancel"
            mode="outlined"
            color={colors.error}
            loading={cancelMut.isLoading}
            onPress={confirmCancelRequest}>
            Cancel Request
          </Button>,
        );
      }
    } else if (
      status === STATUS.REQUESTED &&
      isCounterparty &&
      canReviewTransfer
    ) {
      buttons.push(
        <Button
          key="accept"
          mode="contained"
          loading={acceptMut.isLoading}
          onPress={() => acceptMut.mutate({groupId})}>
          Accept Request
        </Button>,
      );
      buttons.push(
        <Button
          key="reject"
          mode="outlined"
          color={colors.error}
          onPress={() => setRejectVisible(true)}>
          Reject
        </Button>,
      );
    } else if (status === STATUS.ACCEPTED) {
      if ((isSource || isInitiator) && canCreateTransfer) {
        buttons.push(
          <Button
            key="cancel"
            mode="outlined"
            color={colors.error}
            loading={cancelMut.isLoading}
            onPress={confirmCancelRequest}>
            Cancel Request
          </Button>,
        );
      }
      if (isSource && canTransferOut) {
        buttons.unshift(
          <Button
            key="transfer"
            mode="contained"
            loading={transferOutMut.isLoading}
            onPress={() =>
              setConfirm({
                title: 'Confirm transfer-out',
                message:
                  'Mark this request as physically dispatched? The destination will be notified.',
                confirmLabel: 'Transfer Now',
                onConfirm: () => transferOutMut.mutate({groupId}),
              })
            }>
            Transfer Now
          </Button>,
        );
        buttons.unshift(
          <View
            key="ready-notice"
            style={[
              styles.readyNotice,
              {backgroundColor: colors.primary + '14'},
            ]}>
            <Text style={styles.readyNoticeHint}>
              Not ready to transfer yet? You can come back here anytime to start
              the transfer.
            </Text>
            <Text style={styles.readyNoticeTitle}>
              Are all items ready? Tap "Transfer Now".
            </Text>
          </View>,
        );
        buttons.push(
          <Button key="back" mode="text" onPress={() => navigation.goBack()}>
            Back
          </Button>,
        );
      }
    } else if (status === STATUS.TRANSFERRING && isDest && canReceiveTransfer) {
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
            <View style={styles.headerBadges}>
              <TransferStatusBadge status={group.status} />
              {directionForCurrent ? (
                <View
                  style={[
                    styles.directionChip,
                    {
                      backgroundColor:
                        directionForCurrent === 'out'
                          ? OUT_BADGE_COLOR
                          : IN_BADGE_COLOR,
                    },
                  ]}>
                  <Text style={styles.directionChipText}>
                    {directionForCurrent === 'out' ? 'OUT' : 'IN'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.uuid} numberOfLines={1}>
              #{formatBatchTransferRefNo(group.id)}
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
              <Text
                style={[
                  styles.yourBranchLabel,
                  {opacity: group.source_branch_id === currentBranchId ? 1 : 0},
                ]}>
                (Your branch)
              </Text>
            </View>
            <View style={styles.arrowBetween}>
              <MaterialCommunityIcons
                name="arrow-right-bold"
                size={28}
                color={colors.primary}
              />
            </View>
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
              <Text
                style={[
                  styles.yourBranchLabel,
                  {
                    opacity:
                      group.destination_branch_id === currentBranchId ? 1 : 0,
                  },
                ]}>
                (Your branch)
              </Text>
            </View>
          </View>

          <TransferStatusTimeline
            steps={[
              {
                key: 'requested',
                label: 'Requested',
                date: group.date_requested,
                color: STATUS_COLORS.requested,
              },
              {
                key: 'accepted',
                label: 'Accepted',
                date: group.date_accepted,
                color: STATUS_COLORS.accepted,
              },
              {
                key: 'transferring',
                label: 'Transferring',
                date: group.date_transferring,
                color: STATUS_COLORS.transferring,
              },
              {
                key: 'received',
                label: 'Received',
                date: group.date_received,
                color: STATUS_COLORS.received,
              },
            ]}
            formatDate={formatDate}
          />
          {group.date_cancelled ? (
            <Text style={[styles.timestamp, {color: STATUS_COLORS.cancelled}]}>
              Cancelled {formatDate(group.date_cancelled)}
            </Text>
          ) : null}
          {group.date_rejected ? (
            <Text style={[styles.timestamp, {color: STATUS_COLORS.rejected}]}>
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

        {/* Status-contextual note card.
            Counterparty sees a prompt to act; initiator sees a waiting state.
            For Out-mode the counterparty is the dest (receiving an incoming
            request); for In-mode the counterparty is the source (someone is
            asking them to send items). */}
        {group.status === STATUS.REQUESTED ? (
          <View style={[styles.noteCard, {backgroundColor: '#FFF3E0'}]}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color="#E65100"
              style={{marginTop: 1}}
            />
            <Text style={[styles.noteCardText, {color: '#BF360C'}]}>
              {isCounterparty
                ? isSource
                  ? `${
                      destBranch?.display_name || destBranch?.name || 'A branch'
                    } is requesting items from your branch. Review the items below and tap "Accept" to proceed or "Reject" to decline.`
                  : `${
                      sourceBranch?.display_name ||
                      sourceBranch?.name ||
                      'A branch'
                    } has sent you a Batch Transfer Request. Review the items below and tap "Accept" to proceed or "Reject" to decline.`
                : isInitiator && isSource
                ? `Your Batch Transfer Request has been sent to ${
                    destBranch?.display_name ||
                    destBranch?.name ||
                    'the destination branch'
                  }. You'll be notified once they accept or reject it.`
                : `Your Batch Transfer Request has been sent to ${
                    sourceBranch?.display_name ||
                    sourceBranch?.name ||
                    'the source branch'
                  }. You'll be notified once they accept or reject it.`}
            </Text>
          </View>
        ) : null}

        {/* ACCEPTED / TRANSFERRING messages are keyed on the physical role
            (source dispatches, dest receives) — that role is what determines
            the next action regardless of who initiated. */}
        {group.status === STATUS.ACCEPTED ? (
          <View style={styles.noteCard}>
            <MaterialCommunityIcons
              name="information-outline"
              size={16}
              color="#1E88E5"
              style={{marginTop: 1}}
            />
            <Text style={[styles.noteCardText, {color: '#1565C0'}]}>
              {isSource
                ? `You have accepted this request. You can now start transferring the items by tapping Transfer Now. ${
                    destBranch?.display_name ||
                    destBranch?.name ||
                    'The destination branch'
                  } will be notified once the item transfer begins.`
                : `This request has been accepted. You'll be notified once ${
                    sourceBranch?.display_name ||
                    sourceBranch?.name ||
                    'the source branch'
                  } starts transferring the items.`}
            </Text>
          </View>
        ) : null}

        {group.status === STATUS.TRANSFERRING ? (
          <View style={[styles.noteCard, {backgroundColor: '#F3E5F5'}]}>
            <MaterialCommunityIcons
              name="truck-delivery-outline"
              size={16}
              color="#6A1B9A"
              style={{marginTop: 1}}
            />
            <Text style={[styles.noteCardText, {color: '#4A148C'}]}>
              {isDest
                ? `${
                    sourceBranch?.display_name ||
                    sourceBranch?.name ||
                    'The source branch'
                  } has started transferring the items. Tap "Mark Transfer Received" once they arrive.`
                : `You've dispatched the items to ${
                    destBranch?.display_name ||
                    destBranch?.name ||
                    'the destination branch'
                  }. You'll be notified once they confirm receipt.`}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionHeading}>Items ({entries.length})</Text>

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
              isInitiator={isInitiator}
              isCounterparty={isCounterparty}
              canEdit={
                group.status === STATUS.DRAFT
                  ? canCreateTransfer
                  : group.status === STATUS.REQUESTED
                  ? canReviewTransfer
                  : group.status === STATUS.ACCEPTED
                  ? canTransferOut
                  : false
              }
              onEdit={openEditor}
              onRemove={
                group.status === STATUS.DRAFT && canCreateTransfer
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
          onDismiss={() => setEditEntry(null)}
          // Keep the dialog above the keyboard so multiline remarks stays visible.
          style={styles.keyboardAwareDialog}>
          <Dialog.Title numberOfLines={1} style={styles.dialogTitle}>
            {editEntry?.item_display_name}
          </Dialog.Title>
          <Dialog.Content>
            {group.status === STATUS.REQUESTED && isCounterparty ? (
              <Text style={[styles.dialogHelper, {color: colors.neutralTint1}]}>
                {`Set the qty you can accept (0 = decline this item). Requested: ${parseFloat(
                  editEntry?.requested_qty || 0,
                )} ${formatUOM(editEntry?.item_uom_abbrev)}`}
              </Text>
            ) : group.status === STATUS.ACCEPTED && isSource ? (
              <Text style={[styles.dialogHelper, {color: colors.neutralTint1}]}>
                {`Adjust the qty you'll actually send. Accepted: ${parseFloat(
                  editEntry?.accepted_qty || 0,
                )} ${formatUOM(editEntry?.item_uom_abbrev)}`}
              </Text>
            ) : null}
            {editEntryIsUnfulfillable ? (
              <Text style={[styles.dialogHelper, {color: colors.error}]}>
                Item not in your catalog — you can't fulfill this line. Qty is
                locked to 0. You can still leave a remark.
              </Text>
            ) : null}
            <TextInput
              mode="outlined"
              label={`Qty (${formatUOM(editEntry?.item_uom_abbrev)})`}
              value={editEntryIsUnfulfillable ? '0' : editValues.qty}
              onChangeText={v => setEditValues(s => ({...s, qty: v}))}
              keyboardType="decimal-pad"
              autoFocus={!editEntryIsUnfulfillable}
              disabled={editEntryIsUnfulfillable}
              style={styles.dialogInput}
            />
            <TextInput
              mode="outlined"
              label="Remarks (optional)"
              value={editValues.remarks}
              onChangeText={v => setEditValues(s => ({...s, remarks: v}))}
              multiline
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setEditEntry(null)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={saveEditor}
              loading={
                destReviewMut.isLoading ||
                sourceAdjustMut.isLoading ||
                draftEntryMut.isLoading
              }>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={rejectVisible}
          onDismiss={() => setRejectVisible(false)}
          style={styles.keyboardAwareDialog}>
          <Dialog.Title style={styles.dialogTitle}>
            Reject this request?
          </Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogHelper, {color: colors.neutralTint1}]}>
              The initiating branch will be notified. No inventory will change.
            </Text>
            <TextInput
              mode="outlined"
              label="Reason (optional)"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
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

        {/* Generic confirmation dialog (app-styled replacement for Alert.alert) */}
        <Dialog
          visible={!!confirm}
          onDismiss={() => setConfirm(null)}
          style={styles.confirmDialog}>
          <Dialog.Title style={styles.dialogTitle}>
            {confirm?.title}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogHelper, {color: colors.neutralTint1}]}>
              {confirm?.message}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setConfirm(null)}>
              {confirm?.cancelLabel || 'Cancel'}
            </Button>
            <Button
              mode="contained"
              color={confirm?.destructive ? colors.error : undefined}
              onPress={() => {
                const action = confirm?.onConfirm;
                setConfirm(null);
                action && action();
              }}>
              {confirm?.confirmLabel || 'Confirm'}
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
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  directionChip: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  directionChipText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  uuid: {fontSize: 11, fontWeight: '600', opacity: 0.6, maxWidth: 110},
  branchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  branchCol: {flex: 1, alignItems: 'center'},
  arrowBetween: {
    paddingHorizontal: 4,
  },
  branchLabel: {fontSize: 11, opacity: 0.65, marginTop: 2},
  branchName: {fontSize: 13, fontWeight: '600', textAlign: 'center'},
  yourBranchLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E88E5',
    fontStyle: 'italic',
    marginTop: 2,
    textAlign: 'center',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  noteCardText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
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
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readyNotice: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 2,
  },
  readyNoticeHint: {
    fontSize: 11,
    opacity: 0.7,
    marginBottom: 4,
  },
  readyNoticeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Shift the dialog upward so its multiline TextInput (remarks) is never
  // hidden behind the soft keyboard. Paper's Dialog is flex-centered, so a
  // bottom margin moves the whole dialog up by half its value. Rounded corners
  // and a white surface keep it consistent with the app's card styling.
  keyboardAwareDialog: {
    marginBottom: 260,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  confirmDialog: {borderRadius: 12, backgroundColor: 'white'},
  dialogTitle: {fontSize: 18},
  dialogHelper: {marginBottom: 14, fontSize: 13, lineHeight: 18},
  dialogInput: {marginBottom: 10, backgroundColor: 'white'},
  dialogActions: {paddingHorizontal: 12, paddingBottom: 8},
});

export default BatchTransferRequestDetail;
