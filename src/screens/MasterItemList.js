import React, {useMemo, useState} from 'react';
import {StyleSheet, View, FlatList, RefreshControl} from 'react-native';
import {
  List,
  Text,
  Searchbar,
  ActivityIndicator,
  Divider,
  useTheme,
} from 'react-native-paper';
import {useInfiniteQuery} from '@tanstack/react-query';

import {getMasterItems} from '../serverDbQueries/v2/masterItems';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';

const MasterItemList = () => {
  const {colors} = useTheme();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search input by 300ms so we don't issue a request on every
  // keystroke. The local input state stays responsive while the React Query
  // key only flips when the user pauses typing.
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery(
    ['masterItems', {q: debouncedQuery, perPage: 20}],
    getMasterItems,
    {
      getNextPageParam: lastPage => {
        const {current_page, total_pages} = lastPage?.pagination ?? {};
        if (!current_page || !total_pages) return undefined;
        return current_page < total_pages ? current_page + 1 : undefined;
      },
    },
  );

  const items = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(p => p?.data ?? []);
  }, [data]);

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

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator animating color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="titleMedium" style={{color: colors.neutralTint3}}>
            {debouncedQuery
              ? 'No master items match your search.'
              : 'No master items yet. Register a new item to populate this list.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={mi => mi.sync_id ?? mi.id}
          renderItem={({item: mi}) => <MasterItemAccordion masterItem={mi} />}
          ItemSeparatorComponent={Divider}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              colors={[colors.primary]}
            />
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

const MasterItemAccordion = ({masterItem}) => {
  const {colors} = useTheme();
  const branchItems = masterItem?.branch_items ?? [];

  return (
    <List.Accordion
      title={
        <View>
          <Text style={styles.skuText}>{`SKU: ${masterItem.sku ?? ''}`}</Text>
          <Text style={styles.descriptionText} numberOfLines={2}>
            {masterItem.description ?? ''}
          </Text>
        </View>
      }
      titleStyle={{color: colors.dark}}
      style={{backgroundColor: colors.surface}}>
      {branchItems.length === 0 ? (
        <List.Item
          title={<Text style={{fontStyle: 'italic'}}>No branch items</Text>}
        />
      ) : (
        branchItems.map(bi => (
          <List.Item
            key={bi.sync_id}
            title={bi.name}
            description={bi.branch_display_name || bi.branch_name || ''}
            left={() => <List.Icon icon="source-branch" />}
          />
        ))
      )}
    </List.Accordion>
  );
};

export default MasterItemList;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    margin: 12,
    elevation: 0,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  skuText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  descriptionText: {
    fontSize: 13,
    marginTop: 2,
  },
});
