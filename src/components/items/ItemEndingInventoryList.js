import React, {useState, useRef, useMemo, useCallback} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Dimensions,
  Pressable,
  RefreshControl,
} from 'react-native';
import {Button, useTheme, DataTable, Modal, Portal} from 'react-native-paper';
import commaNumber from 'comma-number';
import {useQuery, useInfiniteQuery} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import routes from '../../constants/routes';
import GrandTotal from '../../components/purchases/GrandTotal';
import {
  getRevenueGroups,
  getRevenueGroupsGrandTotal,
} from '../../localDbQueries/revenues';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import ListEmpty from '../../components/stateIndicators/ListEmpty';
import {
  getItemsMonthlyReport,
  getItemsMonthlyReportTotals,
} from '../../localDbQueries/reports';
import ItemEndingInventoryListItem from './ItemEndingInventoryListItem';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundGradientFrom: '#1E2923',
  backgroundGradientFromOpacity: 0,
  backgroundGradientTo: '#08130D',
  backgroundGradientToOpacity: 0.5,
  color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
  strokeWidth: 2, // optional, default 3
  barPercentage: 0.5,
  useShadowColorFromDataset: false, // optional
};

const ItemEndingInventoryList = props => {
  const {
    containerStyle,
    dateFilter,
    monthYearDateFilter,
    highlightedItemId,
    filter = {},
  } = props;
  const {colors} = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
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
  } = useInfiniteQuery(
    ['itemsMonthlyReport', {dateFilter, filter, limit: 10}],
    getItemsMonthlyReport,
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
    data: itemsMonthlyReportTotalsData,
    status: itemsMonthlyReportTotalsStatus,
  } = useQuery(
    ['itemsMonthlyReportTotals', {dateFilter, filter}],
    getItemsMonthlyReportTotals,
  );

  const {
    data: itemsMonthlyReportGrandTotalData,
    status: itemsMonthlyReportGrandTotalStatus,
  } = useQuery(
    [
      'itemsMonthlyReportGrandTotal',
      {dateFilter, filter: {...filter, 'items.category_id': ''}},
    ],
    getItemsMonthlyReportTotals,
  );

  const totals = itemsMonthlyReportTotalsData?.totals;
  const grandTotal = itemsMonthlyReportGrandTotalData?.totals;

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (data?.pages) {
      for (let page of data.pages) {
        pagesData.push(...page.result);
      }
    }

    return pagesData;
  };

  const renderItem = ({item, index, tableColumnNumber}) => {
    const tableRowStyle =
      item.id === highlightedItemId
        ? {backgroundColor: colors.highlighted}
        : {
            backgroundColor: index % 2 === 0 ? 'none' : colors.neutralTint5,
          };
    const selectedMonthGrandTotalCost =
      item.selected_month_grand_total_cost || 0;
    const selectedMonthGrandTotalCostNet =
      item.selected_month_grand_total_cost_net || 0;
    const selectedMonthTotalRemovedStockCost =
      item.selected_month_total_removed_stock_cost || 0;
    const selectedMonthTotalRemovedStockCostNet =
      item.selected_month_total_removed_stock_cost_net || 0;
    const selectedMonthRevenueGroupTotalAmount =
      item.selected_month_revenue_group_total_amount || 0;
    const itemCostPercentage = selectedMonthRevenueGroupTotalAmount
      ? (selectedMonthTotalRemovedStockCostNet /
          selectedMonthRevenueGroupTotalAmount) *
        100
      : 0;
    const avgUnitCost = selectedMonthGrandTotalCost
      ? selectedMonthGrandTotalCost / (item.selected_month_grand_total_qty || 0)
      : 0;
    const avgUnitCostNet = selectedMonthGrandTotalCostNet
      ? selectedMonthGrandTotalCostNet /
        (item.selected_month_grand_total_qty || 0)
      : 0;

    return (
      <ItemEndingInventoryListItem
        item={item}
        mode="stock-usage"
        monthYearDateFilter={monthYearDateFilter}
      />
    );
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  if (status === 'loading') {
    return (
      <DefaultLoadingScreen
        containerStyle={{flex: 1, backgroundColor: colors.surface}}
      />
    );
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const items = getAllPagesData();

  const chartColors = [
    colors.primary,
    colors.accent,
    'green',
    colors.notification,
    colors.error,
    colors.text,
  ];

  const chartData = items.map((item, index) => {
    return {
      ...item,
      totalCost: item.grand_total_cost || 0,
      color: chartColors[index],
    };
  });

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.surface},
        containerStyle,
      ]}>
      <FlatList
        data={chartData}
        renderItem={props => {
          return renderItem({...props, tableColumnNumber: 1});
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <ListEmpty
            actions={[
              {
                label: 'Register item',
                handler: () => {
                  navigation.navigate(routes.addItem(), {
                    category_id: filter?.['items.category_id'],
                  });
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
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button
          mode="contained"
          onPress={() => {
            navigation.navigate(routes.monthlyReportByItem());
          }}>
          View Report by Item
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  table: {
    flex: 1,
  },
  tableColumn: {},
});

export default ItemEndingInventoryList;
