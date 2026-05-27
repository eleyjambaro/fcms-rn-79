import React, {useEffect, useState, useMemo} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  FAB,
  useTheme,
} from 'react-native-paper';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';

import routes from '../constants/routes';
import {getBranches} from '../serverDbQueries/v2/branches';
import {getBatchTransferRequests} from '../localDbQueries/batchTransfer';
import {getCloudSyncParams} from '../localDb';
import TransferStatusBadge from '../components/batchTransfer/TransferStatusBadge';

const TopTab = createMaterialTopTabNavigator();

const formatDate = iso => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
};

const RequestRow = ({item, branchById, currentBranchId, onPress}) => {
  const {colors} = useTheme();
  const counterBranchId =
    item.source_branch_id === currentBranchId
      ? item.destination_branch_id
      : item.source_branch_id;
  const counterBranch = branchById?.[counterBranchId];
  const counterName =
    counterBranch?.display_name || counterBranch?.name || '—';
  const directionPrefix = item.perspective === 'out' ? 'To:' : 'From:';

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({pressed}) => [
        styles.row,
        pressed && {backgroundColor: colors.surface},
      ]}>
      <View style={styles.rowMain}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            <Text style={{fontWeight: 'bold'}}>{directionPrefix}</Text>
            {' '}{counterName}
          </Text>
          {item.is_unread ? (
            <View
              style={[styles.unreadDot, {backgroundColor: colors.accent}]}
            />
          ) : null}
        </View>
        <Text style={styles.rowSubtitle}>
          {item.entry_count} item{item.entry_count === 1 ? '' : 's'} •
          {' '}{formatDate(item.updated_at || item.date_created)}
        </Text>
      </View>
      <TransferStatusBadge status={item.status} />
    </Pressable>
  );
};

const TabContent = ({tab, navigation}) => {
  const {colors} = useTheme();
  const [currentBranchId, setCurrentBranchId] = useState(null);

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

  const {
    data,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    status,
  } = useInfiniteQuery(
    ['batchTransferRequests', {tab}],
    getBatchTransferRequests,
    {
      getNextPageParam: lastPage =>
        lastPage?.hasMore ? lastPage.page + 1 : undefined,
      enabled: !!currentBranchId,
    },
  );

  const rows = useMemo(() => {
    const pages = data?.pages ?? [];
    return pages.flatMap(p => p.result || []);
  }, [data]);

  if (status === 'loading' || !currentBranchId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={item => item.id}
      renderItem={({item}) => (
        <RequestRow
          item={item}
          branchById={branchById}
          currentBranchId={currentBranchId}
          onPress={r =>
            navigation.navigate(routes.batchTransferRequestDetail(), {
              groupId: r.id,
            })
          }
        />
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <MaterialCommunityIcons
            name="package-variant"
            size={48}
            color={colors.disabled}
          />
          <Text style={styles.emptyText}>No transfer requests here yet.</Text>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={refetch} />
      }
      onEndReached={() => hasNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
      contentContainerStyle={rows.length === 0 ? {flexGrow: 1} : null}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={{margin: 16}} />
        ) : null
      }
    />
  );
};

const BatchTransferRequestList = ({navigation}) => {
  return (
    <View style={{flex: 1}}>
      <TopTab.Navigator
        screenOptions={{
          tabBarLabelStyle: {fontSize: 12, fontWeight: '600'},
          tabBarScrollEnabled: true,
        }}>
        <TopTab.Screen name="All">
          {props => <TabContent {...props} tab="all" navigation={navigation} />}
        </TopTab.Screen>
        <TopTab.Screen name="Incoming">
          {props => (
            <TabContent {...props} tab="incoming" navigation={navigation} />
          )}
        </TopTab.Screen>
        <TopTab.Screen name="Outgoing">
          {props => (
            <TabContent {...props} tab="outgoing" navigation={navigation} />
          )}
        </TopTab.Screen>
        <TopTab.Screen name="Drafts">
          {props => (
            <TabContent {...props} tab="drafts" navigation={navigation} />
          )}
        </TopTab.Screen>
        <TopTab.Screen name="History">
          {props => (
            <TabContent {...props} tab="history" navigation={navigation} />
          )}
        </TopTab.Screen>
      </TopTab.Navigator>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate(routes.batchTransferRequestForm())}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  rowMain: {flex: 1, marginRight: 12},
  rowTitleLine: {flexDirection: 'row', alignItems: 'center'},
  rowTitle: {fontSize: 15, fontWeight: '500', flex: 1},
  rowSubtitle: {fontSize: 12, opacity: 0.65, marginTop: 4},
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  emptyText: {marginTop: 12, opacity: 0.7},
  fab: {position: 'absolute', right: 16, bottom: 16},
});

export default BatchTransferRequestList;
