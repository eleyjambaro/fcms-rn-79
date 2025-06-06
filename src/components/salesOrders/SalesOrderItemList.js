import React, {useState, useEffect} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {StyleSheet, Text, View, FlatList, RefreshControl} from 'react-native';
import {
  Button,
  useTheme,
  DataTable,
  Modal,
  Portal,
  Modal as RNPaperModal,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import GrandTotal from '../../components/purchases/GrandTotal';
import SalesOrderDetails from '../../components/salesOrders/SalesOrderDetails';
import {
  getSalesInvoice,
  getSalesInvoiceItems,
  getSalesInvoiceGrandTotal,
  getSalesInvoiceTotals,
} from '../../localDbQueries/salesInvoices';
import {
  getSalesOrderGroup,
  getSalesOrderGroupGrandTotal,
  getSalesOrderGroupItems,
} from '../../localDbQueries/salesOrders';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import useSalesCounterContext from '../../hooks/useSalesCounterContext';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import SalesOrderItemListItem from './SalesOrderItemListItem';
import routes from '../../constants/routes';
import SalesOrderFulfillmentForm from '../forms/SalesOrderFulfillmentForm';

const SalesOrderItemList = props => {
  const {salesOrderGroupId} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const route = useRoute();
  const navigation = useNavigation();

  const [_focusedItem, setFocusedItem] = useState(null);
  const [{focusedItem, saleItems, isLocalStateUpdating, errors}, actions] =
    useSalesCounterContext();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(
    Object.keys(saleItems).length,
  );

  if (!salesOrderGroupId) return null;

  const {status: salesOrderGroupStatus, data: salesOrderGroupData} = useQuery(
    ['salesOrderGroup', {id: salesOrderGroupId}],
    getSalesOrderGroup,
  );
  const {
    status: salesOrderGroupGrandTotalStatus,
    data: salesOrderGroupGrandTotalData,
  } = useQuery(
    ['salesOrderGroupGrandTotal', {id: salesOrderGroupId}],
    getSalesOrderGroupGrandTotal,
  );
  const {
    data: salesOrderGroupItemsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: salesOrderGroupItemsStatus,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(
    ['salesOrderGroupItems', {filter: {}, salesOrderGroupId}],
    getSalesOrderGroupItems,
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

  const [itemFormModalVisible, setItemFormModalVisible] = useState(false);

  useEffect(() => {
    /**
     * setHasUnsavedChanges on mount
     */
    setHasUnsavedChanges(() => {
      if (Object.keys(saleItems).length) {
        return Date.now().toString(); // instead of boolean to force rerendering
      } else {
        return false;
      }
    });

    return () => {
      actions?.setIsLocalStateUpdating(() => false);
      actions?.resetSalesCounter();
    };
  }, []);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (salesOrderGroupItemsData.pages) {
      for (let page of salesOrderGroupItemsData.pages) {
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

  const handleSubmit = values => {
    setItemFormModalVisible(() => false);

    actions?.setFocusedItem(() => null);
    actions?.updateSaleItemFromSalesOrder(values, values.sale_qty, false);
  };

  const renderItem = ({item}) => {
    const saleQty = saleItems?.[item?.order_id]?.saleQty;

    return (
      <SalesOrderItemListItem
        isHighlighted={item?.order_id === focusedItem?.order_id ? true : false}
        disabled={
          item?.order_id !== focusedItem?.order_id && isLocalStateUpdating
            ? true
            : false
        }
        item={item}
        saleQty={saleQty}
        displayMode={'display-sale-qty'}
        onPressItem={() => {
          // avoid focusing to another item while other component level state is updating
          if (isLocalStateUpdating) return;

          // do nothing if order is completed
          if (
            item?.fulfilled_order_qty > 0 &&
            item?.fulfilled_order_qty >= item?.order_qty
          ) {
            return;
          }

          actions?.setFocusedItem(() => item);
          setItemFormModalVisible(() => true);
        }}
      />
    );
  };

  if (
    salesOrderGroupStatus === 'loading' ||
    salesOrderGroupItemsStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    salesOrderGroupStatus === 'error' ||
    salesOrderGroupItemsStatus === 'error'
  ) {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const salesOrderGroup = salesOrderGroupData.result;
  const pagesData = getAllPagesData();
  let defaultSaleQty = saleItems?.[focusedItem?.order_id]?.saleQty || 0;

  if (!defaultSaleQty) {
    defaultSaleQty = focusedItem?.order_qty - focusedItem?.fulfilled_order_qty;
  }

  return (
    <>
      <Portal>
        <RNPaperModal
          visible={itemFormModalVisible}
          onDismiss={() => {
            setItemFormModalVisible(false);
            actions?.setFocusedItem(() => null);
          }}
          contentContainerStyle={{
            backgroundColor: colors.surface,
            padding: 10,
            paddingVertical: 20,
            maxHeight: '98%',
          }}>
          <SalesOrderFulfillmentForm
            item={focusedItem}
            initialValues={{
              sale_qty: defaultSaleQty,
            }}
            onSubmit={handleSubmit}
            onCancel={() => {
              setItemFormModalVisible(false);
              actions?.setFocusedItem(() => null);
            }}
          />
        </RNPaperModal>
      </Portal>

      <View style={{flex: 1, backgroundColor: colors.surface}}>
        <FlatList
          data={pagesData}
          keyExtractor={item => item.order_id}
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
      </View>
      {/* <GrandTotal
        label="Order Total Amount"
        value={salesOrderGroupGrandTotalData || 0}
      /> */}
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
            navigation.navigate(routes.confirmSales(), {
              review_mode: 'fulfilling-sales-order',
              route_to_go_back: routes.salesOrderGroupView(),
              sales_order_group_id: salesOrderGroupId,
            });
          }}>
          Review New Fulfilling Sales
        </Button>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SalesOrderItemList;
