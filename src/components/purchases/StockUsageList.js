import React, {useState} from 'react';
import {StyleSheet, Text, View, FlatList, RefreshControl} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Button, useTheme} from 'react-native-paper';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import routes from '../../constants/routes';
import GrandTotal from './GrandTotal';
import PurchaseOrUsageListItem from './PurchaseOrUsageListItem';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import {
  getBatchStockUsageEntriesGrandTotal,
  getItemsAndBatchStockUsageEntries,
  hasCurrentBatchStockUsageGroup,
  getBatchStockUsageEntriesCount,
} from '../../localDbQueries/batchStockUsage';
import ListEmpty from '../stateIndicators/ListEmpty';

const StockUsageList = props => {
  const {
    filter,
    currentCategory,
    backAction,
    viewMode,
    listItemDisplayMode,
    listStyle,
    listContentContainerStyle,
  } = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [focusedItem, setFocusedItem] = useState(null);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(
    ['itemsAndBatchStockUsageEntries', {filter}],
    getItemsAndBatchStockUsageEntries,
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
  const {
    status: hasCurrentBatchStockUsageGroupStatus,
    data: hasCurrentBatchStockUsageGroupData,
  } = useQuery(
    ['hasCurrentBatchStockUsageGroup'],
    hasCurrentBatchStockUsageGroup,
  );
  const {status: grandTotalStatus, data: grandTotalData} = useQuery(
    ['batchStockUsageEntriesGrandTotal', {}],
    getBatchStockUsageEntriesGrandTotal,
  );
  const {status: categoryGrandTotalStatus, data: categoryGrandTotalData} =
    useQuery(
      ['batchStockUsageEntriesCategoryGrandTotal', {filter}],
      getBatchStockUsageEntriesGrandTotal,
    );

  const {
    status: batchStockUsageEntriesCountStatus,
    data: batchStockUsageEntriesCountData,
  } = useQuery(
    ['batchStockUsageEntriesCount', {}],
    getBatchStockUsageEntriesCount,
  );

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
    return <PurchaseOrUsageListItem item={item} mode="stock-usage" />;
  };

  const renderCategoryGrandTotal = () => {
    if (!currentCategory || currentCategory === 'All') return null;

    return (
      <GrandTotal
        label={`${currentCategory} - Total`}
        value={categoryGrandTotalData || 0}
        labelStyle={{fontSize: 14}}
        valueStyle={{fontSize: 18}}
        containerStyle={{backgroundColor: colors.accent}}
      />
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
  const stockUsageEntriesCount =
    batchStockUsageEntriesCountData && batchStockUsageEntriesCountData > 0
      ? ` (${batchStockUsageEntriesCountData})`
      : '';

  return (
    <>
      <View style={{flex: 1, backgroundColor: 'white'}}>
        <FlatList
          style={[{backgroundColor: colors.surface}, listStyle]}
          contentContainerStyle={[listContentContainerStyle]}
          data={pagesData}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <ListEmpty
              actions={[
                {
                  label: 'Register Item',
                  handler: () => {
                    navigation.navigate(
                      routes.addItem(),
                      filter?.['items.category_id'] && {
                        category_id: filter['items.category_id'],
                      },
                    );
                  },
                },
              ]}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              colors={[colors.primary, colors.accent, colors.dark]}
            />
          }
        />
      </View>
      {renderCategoryGrandTotal()}
      <GrandTotal value={grandTotalData || 0} />
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button
          mode="contained"
          loading={
            hasCurrentBatchStockUsageGroupStatus === 'loading' ? true : false
          }
          disabled={
            hasCurrentBatchStockUsageGroupStatus === 'loading' ||
            !hasCurrentBatchStockUsageGroupData
          }
          onPress={() => {
            navigation.navigate(routes.confirmStockUsage());
          }}>
          {'Confirm Stock Usage' + stockUsageEntriesCount}
        </Button>
      </View>
    </>
  );
};

const styles = StyleSheet.create({});

export default StockUsageList;
