import React from 'react';
import {useRoute} from '@react-navigation/native';
import {StyleSheet, Text, View, FlatList, RefreshControl} from 'react-native';
import {Button, useTheme, DataTable, Modal, Portal} from 'react-native-paper';
import commaNumber from 'comma-number';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import GrandTotal from '../components/purchases/GrandTotal';
import PurchaseHistoryDetails from '../components/purchases/PurchaseHistoryDetails';
import {
  getBatchPurchaseGroup,
  getBatchPurchaseGroupItems,
  getBatchPurchaseGroupGrandTotal,
} from '../localDbQueries/batchPurchase';
import ListLoadingFooter from '../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import useCurrencySymbol from '../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../utils/stringHelpers';

const PurchaseListHistoryView = () => {
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const route = useRoute();
  const purchaseList = route.params?.purchaseList;
  const batchPurchaseGroupId = route.params?.batch_purchase_group_id;

  if (!purchaseList) return null;
  if (!batchPurchaseGroupId) return null;

  const {status: batchPurchaseGroupStatus, data: batchPurchaseGroupData} =
    useQuery(
      ['batchPurchaseGroup', {id: batchPurchaseGroupId}],
      getBatchPurchaseGroup,
    );
  const {
    status: batchPurchaseGroupsGrandTotalStatus,
    data: batchPurchaseGroupsGrandTotalData,
  } = useQuery(
    ['batchPurchaseGroupsGrandTotal', {id: batchPurchaseGroupId}],
    getBatchPurchaseGroupGrandTotal,
  );
  const {
    data: batchPurchaseGroupItemsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: batchPurchaseGroupItemsStatus,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(
    ['batchPurchaseGroupItems', {filter: {}, batchPurchaseGroupId}],
    getBatchPurchaseGroupItems,
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

    if (batchPurchaseGroupItemsData.pages) {
      for (let page of batchPurchaseGroupItemsData.pages) {
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
          item.add_stock_unit_cost,
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>{`${item.add_stock_qty} ${formatUOMAbbrev(
          item.uom_abbrev,
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>
          {`${currencySymbol} ${commaNumber(item.total_cost)}`}
        </DataTable.Cell>
      </DataTable.Row>
    );
  };

  if (
    batchPurchaseGroupStatus === 'loading' ||
    batchPurchaseGroupItemsStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    batchPurchaseGroupStatus === 'error' ||
    batchPurchaseGroupItemsStatus === 'error'
  ) {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const purchaseGroup = batchPurchaseGroupData.result;
  const pagesData = getAllPagesData();

  return (
    <View style={styles.container}>
      <PurchaseHistoryDetails
        purchaseDetails={purchaseGroup}
        containerStyle={{marginBottom: 5}}
      />
      <DataTable style={{flex: 1, backgroundColor: colors.surface}}>
        <DataTable.Header>
          <DataTable.Title>Item</DataTable.Title>
          <DataTable.Title numeric>Unit Cost</DataTable.Title>
          <DataTable.Title numeric>Add Stock</DataTable.Title>
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
      <GrandTotal value={batchPurchaseGroupsGrandTotalData || 0} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default PurchaseListHistoryView;
