import React, {useState} from 'react';
import {StyleSheet, Text, View, FlatList, RefreshControl} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ActivityIndicator, Button, Subheading, useTheme} from 'react-native-paper';
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
import {getVendor} from '../../localDbQueries/vendors';
import ListEmpty from '../stateIndicators/ListEmpty';
import MoreSelectionButton from '../buttons/MoreSelectionButton';
import useItemFormContext from '../../hooks/useItemFormContext';
import useRoleAccess from '../../hooks/useRoleAccess';

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
  const {can} = useRoleAccess();
  const {setFormikActions} = useItemFormContext();
  const [focusedItem, setFocusedItem] = useState(null);
  const [vendorId, setVendorId] = useState(null);
  const {
    status: getVendorStatus,
    data: getVendorData,
  } = useQuery(['vendor', {id: vendorId}], getVendor);
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

  const renderVendorValue = (status, data, props) => {
    if (!vendorId || vendorId === '0') return null;

    if (status === 'loading') {
      return (
        <ActivityIndicator
          animating={true}
          color={colors.primary}
          style={{marginRight: 5}}
          size="small"
        />
      );
    }

    if (status === 'error') {
      return <Subheading style={props.style}>Something went wrong</Subheading>;
    }

    if (!data || !data.result) return null;

    return (
      <Subheading {...props}>
        {props?.trimTextLength(`${data.result?.vendor_display_name}`)}
      </Subheading>
    );
  };

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
      <MoreSelectionButton
        placeholder="Select Vendor"
        label="Vendor"
        renderValueCurrentValue={vendorId}
        renderValue={(_value, renderingValueProps) =>
          renderVendorValue(getVendorStatus, getVendorData, renderingValueProps)
        }
        onChangeValue={currentValue => {
          setVendorId(currentValue);
        }}
        onPress={() => {
          setFormikActions(() => ({
            setFieldValue: (key, value) => {
              if (key === 'vendor_id') {
                setVendorId(value);
              }
            },
            setFieldTouched: () => {},
            setFieldError: () => {},
          }));
          navigation.navigate(routes.itemVendor(), {
            vendor_id: vendorId,
            vendor_id_field_key: 'vendor_id',
            is_vendor_id_required: false,
          });
        }}
      />
      {can('batchPurchase.create') ? (
        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button
            mode="contained"
            disabled={
              !currentBatchPurchaseGroupId ||
              purchaseEntriesCount < 1 ||
              !vendorId
            }
            onPress={() => {
              navigation.navigate(routes.confirmPurchases(), {
                current_batch_purchase_group_id: currentBatchPurchaseGroupId,
                vendor_id: vendorId,
              });
            }}>
            {'Confirm Purchase' + purchaseEntriesCount}
          </Button>
        </View>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({});

export default PurchaseList;
