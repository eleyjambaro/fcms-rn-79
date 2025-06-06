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
  getBatchPurchaseEntriesGrandTotal,
  getItemsAndBatchPurchaseEntries,
  hasCurrentBatchPurchaseGroup,
  getBatchPurchaseEntriesCount,
} from '../../localDbQueries/batchPurchase';
import ListEmpty from '../stateIndicators/ListEmpty';

const PurchaseList = props => {
  const {
    filter,
    currentBatchPurchaseGroupId,
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
    ['itemsAndBatchPurchaseEntries', {filter, currentBatchPurchaseGroupId}],
    getItemsAndBatchPurchaseEntries,
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
  const {status: grandTotalStatus, data: grandTotalData} = useQuery(
    ['batchPurchaseEntriesGrandTotal', {currentBatchPurchaseGroupId}],
    getBatchPurchaseEntriesGrandTotal,
  );
  const {status: categoryGrandTotalStatus, data: categoryGrandTotalData} =
    useQuery(
      ['batchPurchaseEntriesCategoryGrandTotal', {filter}],
      getBatchPurchaseEntriesGrandTotal,
    );

  const {
    status: batchPurchaseEntriesCountStatus,
    data: batchPurchaseEntriesCountData,
  } = useQuery(
    ['batchPurchaseEntriesCount', {currentBatchPurchaseGroupId}],
    getBatchPurchaseEntriesCount,
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
    return (
      <PurchaseOrUsageListItem item={item} isListRefetching={isRefetching} />
    );
  };

  const renderCategoryGrandTotal = () => {
    if (!currentCategory || currentCategory === 'All') return null;

    const categoryGrandTotal = categoryGrandTotalData || 0;

    if (categoryGrandTotal) {
      return (
        <GrandTotal
          label={`${currentCategory} - Carts Total`}
          value={categoryGrandTotal}
          labelStyle={{fontSize: 14}}
          valueStyle={{fontSize: 18}}
          containerStyle={{backgroundColor: colors.accent}}
        />
      );
    } else {
      return null;
    }
  };

  const renderGrandTotal = () => {
    const grandTotal = grandTotalData || 0;

    if (grandTotal) {
      return <GrandTotal value={grandTotal} label="Carts Grand Total" />;
    } else {
      return null;
    }
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
  const purchaseEntriesCount =
    batchPurchaseEntriesCountData && batchPurchaseEntriesCountData > 0
      ? ` (${batchPurchaseEntriesCountData})`
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
      {renderGrandTotal()}
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button
          mode="contained"
          disabled={!currentBatchPurchaseGroupId || purchaseEntriesCount < 1}
          onPress={() => {
            navigation.navigate(routes.confirmPurchases(), {
              current_batch_purchase_group_id: currentBatchPurchaseGroupId,
            });
          }}>
          {'Confirm Purchase' + purchaseEntriesCount}
        </Button>
      </View>
    </>
  );
};

const styles = StyleSheet.create({});

export default PurchaseList;
