import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TouchableOpacity,
  BackHandler,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  Button,
  useTheme,
  Paragraph,
  Dialog,
  Portal,
  Provider,
  Modal as RNPaperModal,
  Title,
} from 'react-native-paper';
import {BottomSheetModal, BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import {items} from '../../__dummyData';
import ItemListItem from './ItemListItem';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import {getItems, deleteItem} from '../../localDbQueries/items';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import useSalesCounterContext from '../../hooks/useSalesCounterContext';
import SalesRegisterItemForm from '../forms/SalesRegisterItemForm';

const ItemList = props => {
  const {
    filter,
    counterMode,
    listItemDisplayMode,
    listStyle,
    listContentContainerStyle,
    showActionButtons = true,
    displaySellableItemIndicator = false,
  } = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [_focusedItem, setFocusedItem] = useState(null);
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
  } = useInfiniteQuery(
    ['items', {filter, categoryId: filter?.category_id}],
    getItems,
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

  const handleSubmit = values => {
    setItemFormModalVisible(() => false);
    actions?.setFocusedItem(() => null);
    actions?.updateSaleItemWithSizeOption(values, values.sale_qty);
  };

  const renderItem = ({item}) => {
    const saleQty = saleItems?.[item?.id]?.saleQty;

    return (
      <ItemListItem
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
        saleQty={saleQty}
        displayMode={listItemDisplayMode}
        displaySellableItemIndicator={displaySellableItemIndicator}
        onPressItem={() => {
          // avoid focusing to another item while other component level state is updating
          if (isLocalStateUpdating) return;

          if (item.item_modifier_options_count > 0) {
            actions?.setFocusedItem(() => item);
            setItemFormModalVisible(() => true);
          } else {
            actions?.updateSaleItemWithUnitSellingPrice(item, 1);
          }
        }}
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
          <SalesRegisterItemForm
            item={saleFocusedItem}
            initialValues={{}}
            onSubmit={handleSubmit}
            onCancel={() => {
              setItemFormModalVisible(false);
              actions?.setFocusedItem(() => null);
            }}
          />
        </RNPaperModal>
      </Portal>

      <FlatList
        contentContainerStyle={listContentContainerStyle}
        style={[{backgroundColor: colors.surface}, listStyle]}
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

export default ItemList;
