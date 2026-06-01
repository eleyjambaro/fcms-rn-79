import React, {useState, useEffect} from 'react';
import {View, StyleSheet, Pressable, ToastAndroid} from 'react-native';
import {
  Text,
  Button,
  Badge,
  TextInput,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import routes from '../constants/routes';
import {getCloudCompany} from '../serverDbQueries/v2/companies';
import {getBranches} from '../serverDbQueries/v2/branches';
import {getCloudSyncParams} from '../localDb';
import {getOrCreateDraftBatchTransferGroup} from '../localDbQueries/batchTransfer';
import BranchPickerSheet from '../components/branchPicker/BranchPickerSheet';

const OUT_BADGE_COLOR = '#E53935';
const IN_BADGE_COLOR = '#1E88E5';

/**
 * Branch picker UI for creating a new Batch Transfer Request.
 *
 * Two directions:
 *   - 'in' (default): current branch is the destination — Destination is locked
 *     to current, Origin is picked. The current branch is asking the
 *     counterparty to send items. Initiator (= dest = current) creates the
 *     draft; the source counterparty reviews and accepts. This is the more
 *     common case, so it's the default.
 *   - 'out': current branch is the source — Origin is locked to current,
 *     Destination is picked from the sheet. The current branch will dispatch
 *     items to the counterparty.
 *
 * The swap icon flips direction and keeps the picked counterparty so the user
 * doesn't have to re-pick the branch after a swap.
 */
const BatchTransferRequestForm = ({navigation}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();

  const [currentBranchId, setCurrentBranchId] = useState(null);
  const [counterparty, setCounterparty] = useState(null);
  const [direction, setDirection] = useState('in');
  const [showPicker, setShowPicker] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const {data: companyData} = useQuery(['cloudCompany'], getCloudCompany);
  const {data: branchesData, status: branchesStatus} = useQuery(
    ['branches', {per_page: 100}],
    () => getBranches({per_page: 100}),
  );

  const currentBranch = (() => {
    const rows = branchesData?.data?.data ?? branchesData?.data ?? [];
    return rows.find(b => b.id === currentBranchId);
  })();

  const createDraftMutation = useMutation(getOrCreateDraftBatchTransferGroup, {
    onSuccess: group => {
      queryClient.invalidateQueries(['batchTransferRequests']);
      // Derive direction from the returned group rather than closure state —
      // if the user swapped after pressing Next, the draft we got back is the
      // source of truth for which side current branch is on.
      const isOut = group.source_branch_id === currentBranchId;
      navigation.replace(routes.batchTransferItemSelection(), {
        groupId: group.id,
        counterpartyBranchId: isOut
          ? group.destination_branch_id
          : group.source_branch_id,
        direction: isOut ? 'out' : 'in',
      });
    },
    onError: err => {
      ToastAndroid.show(
        err?.message || 'Failed to create draft.',
        ToastAndroid.LONG,
      );
      setCreating(false);
    },
  });

  const handleNext = async () => {
    if (!counterparty?.id) return;
    setCreating(true);
    createDraftMutation.mutate({
      direction,
      counterpartyBranchId: counterparty.id,
    });
  };

  const handleSwap = () => {
    setDirection(prev => (prev === 'out' ? 'in' : 'out'));
  };

  if (!currentBranchId || branchesStatus === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const isReady = Boolean(counterparty?.id);
  const isOut = direction === 'out';
  const directionBadgeLabel = isOut ? 'Batch Transfer Out' : 'Batch Transfer In';
  const directionBadgeColor = isOut ? OUT_BADGE_COLOR : IN_BADGE_COLOR;
  const currentBranchLabel =
    currentBranch?.display_name ||
    currentBranch?.name ||
    'Current branch';
  const counterpartyLabel =
    counterparty?.display_name || counterparty?.name || '';
  const counterpartyPickerLabel = isOut
    ? 'Destination branch'
    : 'Origin (source) branch';

  return (
    <View style={styles.container}>
      {/* Company header */}
      {companyData?.data?.name ? (
        <Text style={styles.companyName}>
          {companyData.data.name}
        </Text>
      ) : null}

      {/* Origin / Destination card */}
      <View style={[styles.routeCard, {backgroundColor: colors.surface}]}>
        <View style={styles.routeRow}>
          <View style={styles.pins}>
            <MaterialCommunityIcons
              name="map-marker"
              size={26}
              color={OUT_BADGE_COLOR}
            />
            <View style={styles.dottedLine} />
            <MaterialCommunityIcons
              name="map-marker"
              size={26}
              color={IN_BADGE_COLOR}
            />
          </View>

          <View style={{flex: 1}}>
            {isOut ? (
              <>
                <View style={styles.inputRow}>
                  <Text style={styles.sideLabel}>From:</Text>
                  <View style={{flex: 1}}>
                    <TextInput
                      label="Origin (your branch)"
                      value={currentBranchLabel}
                      editable={false}
                      dense
                      mode="flat"
                      style={styles.input}
                    />
                  </View>
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.sideLabel}>To:</Text>
                  <Pressable
                    onPress={() => setShowPicker(true)}
                    style={{flex: 1}}>
                    <View pointerEvents="none">
                      <TextInput
                        label={counterpartyPickerLabel}
                        value={counterpartyLabel}
                        placeholder="Tap to choose…"
                        editable={false}
                        dense
                        mode="flat"
                        style={styles.input}
                      />
                    </View>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={styles.inputRow}>
                  <Text style={styles.sideLabel}>From:</Text>
                  <Pressable
                    onPress={() => setShowPicker(true)}
                    style={{flex: 1}}>
                    <View pointerEvents="none">
                      <TextInput
                        label={counterpartyPickerLabel}
                        value={counterpartyLabel}
                        placeholder="Tap to choose…"
                        editable={false}
                        dense
                        mode="flat"
                        style={styles.input}
                      />
                    </View>
                  </Pressable>
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.sideLabel}>To:</Text>
                  <View style={{flex: 1}}>
                    <TextInput
                      label="Destination (your branch)"
                      value={currentBranchLabel}
                      editable={false}
                      dense
                      mode="flat"
                      style={styles.input}
                    />
                  </View>
                </View>
              </>
            )}
          </View>

          <Pressable onPress={handleSwap} style={styles.swapBtn}>
            <MaterialCommunityIcons
              name="swap-vertical"
              size={26}
              color={colors.text}
            />
          </Pressable>
        </View>

        <View style={styles.badgeRow}>
          <Badge
            style={[styles.directionBadge, {backgroundColor: directionBadgeColor}]}>
            {directionBadgeLabel}
          </Badge>
        </View>

        <View style={styles.noteCard}>
          <MaterialCommunityIcons
            name="information-outline"
            size={16}
            color="#1E88E5"
            style={{marginTop: 1}}
          />
          <Text style={styles.noteCardText}>
            {isOut
              ? "You'll pick items and quantities in the next step. The destination branch will review your request and confirm "
              : "You'll pick the items you want to request in the next step. The source branch will review your request and confirm "}
            <Text style={styles.noteCardTextBold}>before any stock changes.</Text>
          </Text>
        </View>
      </View>

      <Button
        mode="contained"
        disabled={!isReady || creating}
        loading={creating}
        onPress={handleNext}
        style={styles.nextBtn}>
        Next
      </Button>

      <BranchPickerSheet
        visible={showPicker}
        onDismiss={() => setShowPicker(false)}
        onSelect={branch => setCounterparty(branch)}
        excludeBranchId={currentBranchId}
        title={isOut ? 'Select destination branch' : 'Select source branch'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  companyName: {fontSize: 14, opacity: 0.7, marginBottom: 12},
  routeCard: {
    padding: 14,
    borderRadius: 12,
    elevation: 2,
    marginBottom: 14,
  },
  routeRow: {flexDirection: 'row', alignItems: 'center'},
  pins: {alignItems: 'center', marginRight: 8},
  dottedLine: {
    width: 2,
    height: 26,
    backgroundColor: '#bbb',
    marginVertical: 4,
  },
  input: {backgroundColor: 'transparent', marginBottom: 4},
  inputRow: {flexDirection: 'row', alignItems: 'center'},
  sideLabel: {
    fontWeight: 'bold',
    fontSize: 13,
    width: 44,
    marginRight: 4,
  },
  swapBtn: {padding: 8, marginLeft: 4},
  badgeRow: {flexDirection: 'row', justifyContent: 'center', marginTop: 8},
  directionBadge: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    fontSize: 12,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  noteCardText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#1565C0',
  },
  noteCardTextBold: {
    fontWeight: 'bold',
    color: '#1565C0',
  },
  nextBtn: {marginTop: 'auto'},
});

export default BatchTransferRequestForm;
