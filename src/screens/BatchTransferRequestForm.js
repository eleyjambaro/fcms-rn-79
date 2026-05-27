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

/**
 * Branch picker UI for creating a new Batch Transfer Request.
 *
 * Origin = current branch (always, in v1). Destination is picked via
 * BranchPickerSheet. The swap icon is reserved for v1.5 (inbound requests,
 * where origin is another branch and dest is current) and is disabled in v1
 * because inbound flows need a different item-selection strategy than the
 * source's local items table.
 */
const BatchTransferRequestForm = ({navigation}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();

  const [currentBranchId, setCurrentBranchId] = useState(null);
  const [destination, setDestination] = useState(null);
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
      navigation.replace(routes.batchTransferItemSelection(), {
        groupId: group.id,
        destinationBranchId: group.destination_branch_id,
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
    if (!destination?.id) return;
    setCreating(true);
    createDraftMutation.mutate({destinationBranchId: destination.id});
  };

  const handleSwap = () => {
    ToastAndroid.show(
      'Inbound transfer requests are coming soon. For now, the source (origin) is always your branch.',
      ToastAndroid.LONG,
    );
  };

  if (!currentBranchId || branchesStatus === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const isReady = Boolean(destination?.id);
  const directionBadgeLabel = 'Batch Transfer Out';

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
              color="#E53935"
            />
            <View style={styles.dottedLine} />
            <MaterialCommunityIcons
              name="map-marker"
              size={26}
              color="#1E88E5"
            />
          </View>

          <View style={{flex: 1}}>
            <TextInput
              label="Origin (your branch)"
              value={
                currentBranch?.display_name ||
                currentBranch?.name ||
                'Current branch'
              }
              editable={false}
              dense
              mode="flat"
              style={styles.input}
            />
            <Pressable onPress={() => setShowPicker(true)}>
              <View pointerEvents="none">
                <TextInput
                  label="Destination branch"
                  value={destination?.display_name || destination?.name || ''}
                  placeholder="Tap to choose…"
                  editable={false}
                  dense
                  mode="flat"
                  style={styles.input}
                />
              </View>
            </Pressable>
          </View>

          <Pressable onPress={handleSwap} style={styles.swapBtn}>
            <MaterialCommunityIcons
              name="swap-vertical"
              size={26}
              color={colors.disabled}
            />
          </Pressable>
        </View>

        <View style={styles.badgeRow}>
          <Badge style={[styles.directionBadge, {backgroundColor: '#E53935'}]}>
            {directionBadgeLabel}
          </Badge>
        </View>
      </View>

      <Text style={styles.helperText}>
        You'll pick items and quantities in the next step. The destination
        branch will review your request and confirm before any stock changes.
      </Text>

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
        onSelect={branch => setDestination(branch)}
        excludeBranchId={currentBranchId}
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
  swapBtn: {padding: 8, marginLeft: 4},
  badgeRow: {flexDirection: 'row', marginTop: 8},
  directionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    fontSize: 12,
  },
  helperText: {fontSize: 12, opacity: 0.7, marginBottom: 24},
  nextBtn: {marginTop: 'auto'},
});

export default BatchTransferRequestForm;
