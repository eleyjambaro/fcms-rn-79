import React from 'react';
import {useRoute} from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import {Button, useTheme, DataTable, Modal, Portal} from 'react-native-paper';
import commaNumber from 'comma-number';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import {items} from '../__dummyData';
import GrandTotal from '../components/purchases/GrandTotal';
import StockUsageHistoryDetails from '../components/purchases/StockUsageHistoryDetails';
import {
  getBatchStockUsageGroup,
  getBatchStockUsageGroupItems,
  getBatchStockUsageGroupGrandTotal,
} from '../localDbQueries/batchStockUsage';
import ListLoadingFooter from '../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import useCurrencySymbol from '../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../utils/stringHelpers';

const StockUsageHistoryView = () => {
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const route = useRoute();
  const stockUsageList = route.params?.stockUsageList;
  const batchStockUsageGroupId = route.params?.batch_stock_usage_group_id;

  if (!stockUsageList) return null;
  if (!batchStockUsageGroupId) return null;

  const {status: batchStockUsageGroupStatus, data: batchStockUsageGroupData} =
    useQuery(
      ['batchStockUsageGroup', {id: batchStockUsageGroupId}],
      getBatchStockUsageGroup,
    );
  const {
    status: batchStockUsageGroupsGrandTotalStatus,
    data: batchStockUsageGroupsGrandTotalData,
  } = useQuery(
    ['batchStockUsageGroupsGrandTotal', {id: batchStockUsageGroupId}],
    getBatchStockUsageGroupGrandTotal,
  );
  const {
    data: batchStockUsageGroupItemsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: batchStockUsageGroupItemsStatus,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(
    ['batchStockUsageGroupItems', {filter: {}, batchStockUsageGroupId}],
    getBatchStockUsageGroupItems,
    {
      getNextPageParam: (lastPage, pages) => {
        let pagesResult = [];

        for (let page of pages) {
          pagesResult.push(...page.result);
        }

        if (pagesResult.length < lastPage.totalCount) {
          return lastPage.page + 1;
        }
      },
      networkMode: 'always',
    },
  );

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (batchStockUsageGroupItemsData.pages) {
      for (let page of batchStockUsageGroupItemsData.pages) {
        pagesData.push(...page.result);
      }
    }

    return pagesData;
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const renderItem = ({item}) => {
    return (
      <DataTable.Row>
        <DataTable.Cell>{item.name}</DataTable.Cell>
        <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
          item.remove_stock_unit_cost,
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>{`${item.remove_stock_qty} ${formatUOMAbbrev(
          item.uom_abbrev,
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>
          {`${currencySymbol} ${commaNumber(item.total_cost)}`}
        </DataTable.Cell>
      </DataTable.Row>
    );
  };

  if (
    batchStockUsageGroupStatus === 'loading' ||
    batchStockUsageGroupItemsStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    batchStockUsageGroupStatus === 'error' ||
    batchStockUsageGroupItemsStatus === 'error'
  ) {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const stockUsageGroup = batchStockUsageGroupData.result;
  const pagesData = getAllPagesData();

  return (
    <View style={styles.container}>
      <StockUsageHistoryDetails
        stockUsageDetails={stockUsageGroup}
        containerStyle={{marginBottom: 5}}
      />
      <DataTable style={{flex: 1, backgroundColor: colors.surface}}>
        <DataTable.Header>
          <DataTable.Title>Item</DataTable.Title>
          <DataTable.Title numeric>Unit Cost</DataTable.Title>
          <DataTable.Title numeric>Used Stock</DataTable.Title>
          <DataTable.Title numeric>Total Cost</DataTable.Title>
        </DataTable.Header>
        <FlatList
          data={pagesData}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                padding: 20,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text>No data to display</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              colors={[colors.primary, colors.accent, colors.dark]}
            />
          }
        />
      </DataTable>
      <GrandTotal value={batchStockUsageGroupsGrandTotalData || 0} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default StockUsageHistoryView;
