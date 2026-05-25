import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, View, FlatList} from 'react-native';
import {
  Searchbar,
  List,
  Divider,
  Text,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import {useInfiniteQuery} from '@tanstack/react-query';

import routes from '../constants/routes';
import {getLocalMastersAvailableForBranch} from '../localDbQueries/masterItems';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';

const SelectMasterItem = ({navigation, route}) => {
  const {colors} = useTheme();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

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

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator animating color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text variant="titleMedium" style={{color: colors.neutralTint3}}>
            {debouncedQuery
              ? 'No master items match your search.'
              : 'No new master items available for this branch. Tap back and choose "Register new item" instead, or sync to pull the latest catalog.'}
          </Text>
        </View>
      ) : (
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
});
