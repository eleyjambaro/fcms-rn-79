import React from 'react';
import {Text, View, FlatList, RefreshControl, StyleSheet} from 'react-native';
import {useTheme, DataTable} from 'react-native-paper';
import commaNumber from 'comma-number';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import moment from 'moment';

import GrandTotal from '../purchases/GrandTotal';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import {
  getInventoryLogs,
  getInventoryLogsTotal,
} from '../../localDbQueries/inventoryLogs';
import ListLoadingFooter from '../stateIndicators/ListLoadingFooter';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const Entries = props => {
  // entryType = "purchase" or "stock-usage"
  // viewMode = "item-view" or "category-view"
  const {
    filter = {},
    showTotal = true,
    entryType,
    totalLabel = 'Total',
    viewMode = 'item-view',
  } = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(['inventoryLogs', {filter}], getInventoryLogs, {
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
  });
  const {status: inventoryLogsTotalStatus, data: inventoryLogsTotalData} =
    useQuery(['inventoryLogsTotal', {filter}], getInventoryLogsTotal);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (data.pages) {
      for (let page of data.pages) {
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
        <DataTable.Cell>
          {moment(item.adjustment_date?.split(' ')[0]).format('MMM DD, YYYY')}
        </DataTable.Cell>
        <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
          (item.adjustment_unit_cost_net || 0).toFixed(2),
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>{`${item.adjustment_qty} ${formatUOMAbbrev(
          item.item_uom_abbrev,
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>
          {`${currencySymbol} ${commaNumber(item.total_cost_net?.toFixed(2))}`}
        </DataTable.Cell>
      </DataTable.Row>
    );
  };

  if (status === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const pagesData = getAllPagesData();
  const grandTotal = inventoryLogsTotalData || 0;
  const grandTotalProps =
    viewMode === 'item-view'
      ? {
          labelStyle: {fontSize: 14},
          valueStyle: {fontSize: 18},
          containerStyle: {backgroundColor: colors.accent},
        }
      : {};

  return (
    <View style={styles.container}>
      <DataTable style={{flex: 1, backgroundColor: colors.surface}}>
        <DataTable.Header>
          <DataTable.Title>
            {entryType === 'purchase'
              ? 'Purchase Date'
              : entryType === 'stock-usage'
              ? 'Usage Date'
              : 'Date'}
          </DataTable.Title>
          <DataTable.Title numeric>Net Unit Cost</DataTable.Title>
          <DataTable.Title numeric>Quantity</DataTable.Title>
          <DataTable.Title numeric>Net Total</DataTable.Title>
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
      {showTotal && (
        <GrandTotal
          label={totalLabel}
          value={grandTotal}
          {...grandTotalProps}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default Entries;
