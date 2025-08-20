import React, {useState} from 'react';
import {StyleSheet, Text, View, FlatList, RefreshControl} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Button, useTheme} from 'react-native-paper';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';

import SalesCounterSellingMenuListItem from './SalesCounterSellingMenuListItem';
import routes from '../../constants/routes';
import ListLoadingFooter from '../stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import {
  getAllSellingMenuItems,
  getSellingMenus,
} from '../../localDbQueries/sellingMenus';
import useSalesCounterContext from '../../hooks/useSalesCounterContext';

const SalesCounterSellingMenuList = props => {
  const {filter, counterMode, showActionButtons = true} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [
    {focusedItem: saleFocusedItem, saleItems, errors, isLocalStateUpdating},
    actions,
  ] = useSalesCounterContext();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(['sellingMenus', {filter}], getSellingMenus, {
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

  const {status: allSellingMenuItemsStatus, data: allSellingMenuItemsData} =
    useQuery(['allSellingMenuItems'], getAllSellingMenuItems);

  console.log(
    'ALL MENU ITEMS: ',
    allSellingMenuItemsData?.resultMapBySellingMenuId,
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
      <SalesCounterSellingMenuListItem
        isHighlighted={item?.id === saleFocusedItem?.id ? true : false}
        isHighlightedUpdating={
          item?.id === saleFocusedItem?.id && isLocalStateUpdating
            ? true
            : false
        }
        disabled={
          item?.id !== saleFocusedItem?.id && isLocalStateUpdating
            ? true
            : false
        }
        item={item}
        onPressItem={() => {
          // avoid focusing to another item while other component level state is updating
          if (isLocalStateUpdating) return;

          if (
            Object.keys(allSellingMenuItemsData?.resultMapBySellingMenuId)
              ?.length > 0
          ) {
            actions?.addSellingMenuItemsAsSaleItems(
              allSellingMenuItemsData.resultMapBySellingMenuId[item.id],
            );
          }
        }}
      />
    );
  };

  if (status === 'loading' || allSellingMenuItemsStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error' || allSellingMenuItemsStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  return (
    <>
      <FlatList
        style={{backgroundColor: colors.surface}}
        data={getAllPagesData()}
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
      {showActionButtons && (
        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button
            mode="contained"
            icon="chevron-right"
            contentStyle={{flexDirection: 'row-reverse'}}
            disabled={isLocalStateUpdating || Object.keys(errors).length}
            onPress={() => {
              actions?.prepareToReviewSaleItems();

              let params = {};

              if (counterMode === 'sales-order-register') {
                params.review_mode = 'new-sales-order';
                params.route_to_go_back = routes.salesOrderRegister();
              }

              navigation.navigate(routes.confirmSales(), params);
            }}>
            {counterMode === 'sales-order-register'
              ? `Review Sales Order`
              : `Review Sales${
                  Object.keys(saleItems)?.length
                    ? ` (${Object.keys(saleItems).length})`
                    : ''
                }`}
          </Button>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default SalesCounterSellingMenuList;
