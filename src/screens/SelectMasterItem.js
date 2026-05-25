import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, View, FlatList, RefreshControl} from 'react-native';
import {
  Searchbar,
  List,
  Divider,
  Text,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import {useInfiniteQuery, useQueryClient} from '@tanstack/react-query';

import routes from '../constants/routes';
import {getLocalMastersAvailableForBranch} from '../localDbQueries/masterItems';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {runSync} from '../services/syncService';

const SelectMasterItem = ({navigation, route}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery(
    ['masterItems_localAvailable', {q: debouncedQuery, perPage: 20}],
    getLocalMastersAvailableForBranch,
    {
      getNextPageParam: lastPage => {
        const {current_page, total_pages} = lastPage?.pagination ?? {};
        if (!current_page || !total_pages) return undefined;
        return current_page < total_pages ? current_page + 1 : undefined;
      },
    },
  );

  // Pull the latest master_items down from the server before showing the
  // picker. This covers the case where the user just switched branches and
  // the previous branch's master_items haven't propagated to this branch's
  // local DB yet (or a different branch on the same device created masters
  // that need to be re-pulled into this branch's SQLite file).
  //
  // runSync() returns immediately when another sync is already in flight
  // (the 15s interval from useAppLifecycle, or the branch-switch sync from
  // setDesignatedBranch). In that case our refetch would race the in-flight
  // sync's apply phase and return stale data. To handle that we poll a few
  // times — between polls the in-flight sync has a chance to land its writes
  // before we re-query the local DB.
  const syncAndRefetch = React.useCallback(async () => {
    setIsSyncing(true);
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    try {
      const result = await runSync();
      const wasSkipped = (result?.errors ?? []).some(e =>
        String(e).includes('Sync already in progress'),
      );
      if (wasSkipped) {
        // Give the in-flight sync up to ~6s to finish, polling every 1s and
        // refetching after each poll. The picker reads from local SQLite, so
        // as soon as the in-flight sync applies its records the next refetch
        // will surface them.
        for (let i = 0; i < 6; i++) {
          await sleep(1000);
          await queryClient.invalidateQueries(['masterItems_localAvailable']);
          const r = await refetch();
          const pages = r?.data?.pages ?? [];
          const total = pages.reduce((n, p) => n + (p?.data?.length ?? 0), 0);
          if (total > 0) break;
        }
      } else {
        await queryClient.invalidateQueries(['masterItems_localAvailable']);
        await refetch();
      }
    } catch (e) {
      // Sync errors are non-fatal here — the picker still shows whatever the
      // local DB has. The user can pull-to-refresh to retry.
      console.debug('[SelectMasterItem] sync error:', e?.message ?? e);
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient, refetch]);

  useEffect(() => {
    syncAndRefetch();
    // Intentionally only on mount — debouncedQuery refetches are handled by
    // useInfiniteQuery's queryKey change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(p => p?.data ?? []);
  }, [data]);

  const forwardParams = route.params ?? {};

  const handleSelect = mi => {
    navigation.replace(routes.addItem(), {
      ...forwardParams,
      masterItem: {
        sync_id: mi.sync_id,
        sku: mi.sku,
        description: mi.description,
        barcode: mi.barcode,
        uom_abbrev: mi.uom_abbrev,
        uom_abbrev_per_piece: mi.uom_abbrev_per_piece,
        qty_per_piece: mi.qty_per_piece,
        packaging_type: mi.packaging_type,
      },
    });
  };

  if (isError) {
    return <DefaultErrorScreen errorMessage={error?.message} />;
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      <Searchbar
        placeholder="Search SKU or description"
        value={searchInput}
        onChangeText={setSearchInput}
        style={styles.searchbar}
      />

      {isLoading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator animating color={colors.primary} />
          {isSyncing ? (
            <Text variant="bodySmall" style={styles.syncingText}>
              Syncing master items…
            </Text>
          ) : null}
        </View>
      ) : (
        // Always render the FlatList — even when empty — so the user can
        // pull-to-refresh to trigger a sync. ListEmptyComponent fills the
        // viewport when items.length === 0.
        <FlatList
          data={items}
          keyExtractor={mi => mi.sync_id ?? String(mi.id)}
          renderItem={({item: mi}) => (
            <List.Item
              title={mi.sku ?? ''}
              titleStyle={styles.skuText}
              description={mi.description ?? ''}
              descriptionNumberOfLines={2}
              onPress={() => handleSelect(mi)}
              left={() => <List.Icon icon="package-variant" />}
            />
          )}
          ItemSeparatorComponent={Divider}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          contentContainerStyle={items.length === 0 ? styles.emptyContent : undefined}
          refreshControl={
            <RefreshControl
              refreshing={isSyncing}
              onRefresh={syncAndRefetch}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text variant="titleMedium" style={{color: colors.neutralTint3, textAlign: 'center'}}>
                {debouncedQuery
                  ? 'No master items match your search.'
                  : 'No new master items available for this branch. Pull down to sync the latest catalog, or tap back and choose "Register new item" instead.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{padding: 16}}>
                <ActivityIndicator animating color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

export default SelectMasterItem;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    margin: 12,
    elevation: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  skuText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  syncingText: {
    marginTop: 8,
    opacity: 0.7,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
