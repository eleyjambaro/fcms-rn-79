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
import {
  Button,
  useTheme,
  DataTable,
  Modal,
  Portal,
  Title,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import {
  LineChart,
  BarChart,
  PieChart,
  ProgressChart,
  ContributionGraph,
  StackedBarChart,
} from 'react-native-chart-kit';
import {
  Tabs,
  TabScreen,
  useTabIndex,
  useTabNavigation,
} from 'react-native-paper-tabs';
import {useQuery, useInfiniteQuery} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';

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
  getCategoriesMonthlyReport,
  getCategoriesMonthlyReportTotals,
} from '../../localDbQueries/reports';
import SectionHeading from '../headings/SectionHeading';
import CategoryInventoryDetailsModal from './CategoryInventoryDetailsModal';
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

const CategoryTabularList = props => {
  const {
    dateFilter,
    highlightedItemId,
    filter = {},
    currentRevenueGroup,
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
    ['categoriesMonthlyReport', {dateFilter, filter}],
    getCategoriesMonthlyReport,
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
    data: categoriesMonthlyReportTotalsData,
    status: categoriesMonthlyReportTotalsStatus,
  } = useQuery(
    ['categoriesMonthlyReportTotals', {dateFilter, filter}],
    getCategoriesMonthlyReportTotals,
  );

  const {
    data: categoriesMonthlyReportGrandTotalData,
    status: categoriesMonthlyReportGrandTotalStatus,
  } = useQuery(
    [
      'categoriesMonthlyReportGrandTotal',
      {dateFilter, filter: {...filter, 'categories.revenue_group_id': ''}},
    ],
    getCategoriesMonthlyReportTotals,
  );
  const [focusedItem, setFocusedItem] = useState(null);
  const [inventoryDetailsModalVisible, setInventoryDetailsModalVisible] =
    useState(false);

  const totals = categoriesMonthlyReportTotalsData?.totals;
  const grandTotal = categoriesMonthlyReportGrandTotalData?.totals;

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
    const previousMonthGrandTotalCost =
      item.previous_month_grand_total_cost || 0;
    const previousMonthGrandTotalCostNet =
      item.previous_month_grand_total_cost_net || 0;
    const selectedMonthRevenueGroupTotalAmount =
      item.selected_month_revenue_group_total_amount || 0;
    /**
     * Another formula for category net cost percentage:
     *
     * selectedMonthCategoryCostPercentage = selectedMonthRevenueGroupTotalAmount
     * ? (selectedMonthGrandTotalCostNet / selectedMonthRevenueGroupTotalAmount) *
     *   100
     *: 0;
     */
    const selectedMonthCategoryCostPercentage =
      item.selected_month_category_cost_percentage;
    const selectedMonthCategoryNetCostPercentage =
      item.selected_month_category_net_cost_percentage;
    const wholeMonthPurchasesTotalCost =
      item.whole_month_operation_id_2_total_cost || 0;
    const wholeMonthPurchasesTotalCostNet =
      item.whole_month_operation_id_2_total_cost_net || 0;
    const wholeMonthPurchasesTotalCostTax =
      item.whole_month_operation_id_2_total_cost_tax || 0;

    const wholeMonthTotalAddedStockCost =
      item.whole_month_total_added_stock_cost || 0;
    const wholeMonthTotalAddedStockCostNet =
      item.whole_month_total_added_stock_cost_net || 0;
    const wholeMonthTotalAddedStockCostTax =
      item.whole_month_total_added_stock_cost_tax || 0;

    const wholeMonthTotalRemovedStockCost =
      item.whole_month_total_removed_stock_cost || 0;
    const wholeMonthTotalRemovedStockCostNet =
      item.whole_month_total_removed_stock_cost_net || 0;
    const wholeMonthTotalRemovedStockCostTax =
      item.whole_month_total_removed_stock_cost_tax || 0;

    const wholeMonthTotalAddedStockCostPercentage =
      item.whole_month_total_added_stock_cost_percentage || 0;
    const wholeMonthTotalAddedStockCostNetPercentage =
      item.whole_month_total_added_stock_cost_net_percentage || 0;
    const wholeMonthTotalRemovedStockCostPercentage =
      item.whole_month_total_removed_stock_cost_percentage || 0;
    const wholeMonthTotalRemovedStockCostNetPercentage =
      item.whole_month_total_removed_stock_cost_net_percentage || 0;

    /**
     * Another formula for purchase net cost percentage:
     *
     * selectedMonthPurchaseNetCostPercentage = selectedMonthRevenueGroupTotalAmount
     * ? (wholeMonthPurchasesTotalCostNet /
     *     selectedMonthRevenueGroupTotalAmount) *
     *  100
     *: 0;
     */

    const selectedMonthPurchaseCostPercentage =
      item.selected_month_purchase_cost_percentage;
    const selectedMonthPurchaseNetCostPercentage =
      item.selected_month_purchase_net_cost_percentage;

    if (tableColumnNumber === 1) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell>{item.category_name}</DataTable.Cell>
          <DataTable.Cell numeric>
            {
              <MaterialCommunityIcons
                name="chevron-double-right"
                size={20}
                color={colors.dark}
                style={{alignSelf: 'flex-end'}}
              />
            }
          </DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 2) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
            previousMonthGrandTotalCostNet.toFixed(2),
          )}`}</DataTable.Cell>
          <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
            wholeMonthTotalAddedStockCostNet.toFixed(2),
          )}`}</DataTable.Cell>
          <DataTable.Cell
            onPress={() => {
              setFocusedItem(() => item);
              setInventoryDetailsModalVisible(() => true);
            }}
            numeric>
            <Text
              style={{
                color: colors.primary,
                fontWeight: 'bold',
              }}>{`${currencySymbol} ${commaNumber(
              selectedMonthGrandTotalCostNet.toFixed(2),
            )}`}</Text>
          </DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 3) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell numeric>{item.revenue_group_name}</DataTable.Cell>
          <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
            selectedMonthRevenueGroupTotalAmount.toFixed(2),
          )}`}</DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 4) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
            wholeMonthTotalRemovedStockCostNet.toFixed(2),
          )}`}</DataTable.Cell>
          <DataTable.Cell numeric>
            {`${commaNumber(
              wholeMonthTotalRemovedStockCostNetPercentage.toFixed(2),
            )}%`}
          </DataTable.Cell>
          <DataTable.Cell numeric>
            {`${commaNumber(
              wholeMonthTotalAddedStockCostNetPercentage.toFixed(2),
            )}%`}
          </DataTable.Cell>
        </DataTable.Row>
      );
    }

    return null;
  };

  const renderSubTotalTable = ({tableColumnNumber}) => {
    const tableRowStyle = {backgroundColor: colors.accent};
    const revenueGroupTotalLabel = currentRevenueGroup
      ? `${currentRevenueGroup} - Total`
      : 'Revenue Group Total';

    if (!filter?.['categories.revenue_group_id']) return null;

    if (tableColumnNumber === 1) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell>
            <Text style={{fontWeight: 'bold'}}>{revenueGroupTotalLabel}</Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>
            {
              <MaterialCommunityIcons
                name="chevron-double-right"
                size={20}
                color={colors.dark}
                style={{alignSelf: 'flex-end'}}
              />
            }
          </DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 2) {
      return (
        <DataTable.Row style={tableRowStyle}>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>
              {`${currencySymbol} ${commaNumber(
                (totals?.previousMonthAllCategoriesTotalCostNet || 0).toFixed(
                  2,
                ),
              )}`}
            </Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>
              {`${currencySymbol} ${commaNumber(
                (
                  totals?.wholeMonthAllCategoriesTotalAddedStockCostNet || 0
                ).toFixed(2),
              )}`}
            </Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>
              {`${currencySymbol} ${commaNumber(
                (totals?.selectedMonthAllCategoriesTotalCostNet || 0).toFixed(
                  2,
                ),
              )}`}
            </Text>
          </DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 3) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 4) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell numeric>
            <Text
              style={{fontWeight: 'bold'}}>{`${currencySymbol} ${commaNumber(
              (
                totals?.wholeMonthAllCategoriesTotalRemovedStockCostNet || 0
              ).toFixed(2),
            )}`}</Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>{`${commaNumber(
              (
                totals?.wholeMonthAllCategoriesTotalRemovedStockCostNetPercentage ||
                0
              ).toFixed(2),
            )}%`}</Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>{`${commaNumber(
              (
                totals?.wholeMonthAllCategoriesTotalAddedStockCostNetPercentage ||
                0
              ).toFixed(2),
            )}%`}</Text>
          </DataTable.Cell>
        </DataTable.Row>
      );
    }

    return <DataTable.Row style={tableRowStyle}></DataTable.Row>;
  };

  const renderGrandTotalTable = ({tableColumnNumber}) => {
    if (filter?.['categories.revenue_group_id']) return null;

    const tableRowStyle = {
      backgroundColor: colors.neutralTint5,
      borderTopWidth: 3,
      borderTopColor: colors.neutralTint4,
    };

    if (tableColumnNumber === 1) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell>
            <Text style={{fontWeight: 'bold'}}>Grand Total</Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>
            {
              <MaterialCommunityIcons
                name="chevron-double-right"
                size={20}
                color={colors.dark}
                style={{alignSelf: 'flex-end'}}
              />
            }
          </DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 2) {
      return (
        <DataTable.Row style={tableRowStyle}>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>
              {`${currencySymbol} ${commaNumber(
                (
                  grandTotal?.previousMonthAllCategoriesTotalCostNet || 0
                ).toFixed(2),
              )}`}
            </Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>
              {`${currencySymbol} ${commaNumber(
                (
                  grandTotal?.wholeMonthAllCategoriesTotalAddedStockCostNet || 0
                ).toFixed(2),
              )}`}
            </Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>
              {`${currencySymbol} ${commaNumber(
                (
                  grandTotal?.selectedMonthAllCategoriesTotalCostNet || 0
                ).toFixed(2),
              )}`}
            </Text>
          </DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 3) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 4) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>
              {`${currencySymbol} ${commaNumber(
                (
                  grandTotal?.wholeMonthAllCategoriesTotalRemovedStockCostNet ||
                  0
                ).toFixed(2),
              )}`}
            </Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>{`${commaNumber(
              (
                grandTotal?.wholeMonthAllCategoriesTotalRemovedStockCostNetPercentage ||
                0
              ).toFixed(2),
            )}%`}</Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>{`${commaNumber(
              (
                grandTotal?.wholeMonthAllCategoriesTotalAddedStockCostNetPercentage ||
                0
              ).toFixed(2),
            )}%`}</Text>
          </DataTable.Cell>
        </DataTable.Row>
      );
    }

    return <DataTable.Row style={tableRowStyle}></DataTable.Row>;
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
    <>
      <CategoryInventoryDetailsModal
        visible={inventoryDetailsModalVisible}
        onDismiss={() => setInventoryDetailsModalVisible(() => false)}
        contentContainerStyle={{backgroundColor: 'white', padding: 20}}
        category={focusedItem}
      />
      <Tabs
        // defaultIndex={0} // default = 0
        uppercase={false} // true/false | default=true | labels are uppercase
        // showTextLabel={false} // true/false | default=false (KEEP PROVIDING LABEL WE USE IT AS KEY INTERNALLY + SCREEN READERS)
        // iconPosition // leading, top | default=leading
        style={{
          backgroundColor: colors.surface,
          marginTop: 4,
          // borderTopWidth: 5,
          // borderTopColor: colors.neutralTint5,
        }} // works the same as AppBar in react-native-paper
        // dark={false} // works the same as AppBar in react-native-paper
        // theme={} // works the same as AppBar in react-native-paper
        mode="scrollable" // fixed, scrollable | default=fixed
        // onChangeIndex={(newIndex) => {}} // react on index change
        // showLeadingSpace={true} //  (default=true) show leading space in scrollable tabs inside the header
        // disableSwipe={false} // (default=false) disable swipe to left/right gestures
      >
        <TabScreen label="Category">
          <View style={styles.container}>
            <DataTable
              style={[styles.table, {backgroundColor: colors.surface}]}>
              <DataTable.Header>
                <DataTable.Title style={styles.tableColumn}>
                  Name
                </DataTable.Title>
              </DataTable.Header>
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
                        label: 'Manage categories',
                        handler: () => {
                          navigation.navigate(routes.manageCategories());
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
              {renderSubTotalTable({tableColumnNumber: 1})}
              {renderGrandTotalTable({tableColumnNumber: 1})}
            </DataTable>
          </View>
        </TabScreen>
        <TabScreen label="Inventory">
          <View style={styles.container}>
            <DataTable
              style={[styles.table, {backgroundColor: colors.surface}]}>
              <DataTable.Header>
                <DataTable.Title style={styles.tableColumn} numeric>
                  {`Beginning Inv. (${moment(dateFilter).format('MMM')})`}
                </DataTable.Title>
                {/* <DataTable.Title style={styles.tableColumn} numeric>
                  {`Added`}
                </DataTable.Title> */}
                <DataTable.Title style={styles.tableColumn} numeric>
                  {`Purchases`}
                </DataTable.Title>
                <DataTable.Title style={styles.tableColumn} numeric>
                  {`Ending Inventory`}
                </DataTable.Title>
              </DataTable.Header>
              <FlatList
                data={chartData}
                renderItem={props => {
                  return renderItem({...props, tableColumnNumber: 2});
                }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={
                  <ListEmpty
                    actions={[
                      {
                        label: 'Manage categories',
                        handler: () => {
                          navigation.navigate(routes.manageCategories());
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
              {renderSubTotalTable({tableColumnNumber: 2})}
              {renderGrandTotalTable({tableColumnNumber: 2})}
            </DataTable>
          </View>
        </TabScreen>
        <TabScreen label="Revenue">
          <View style={styles.container}>
            <DataTable
              style={[styles.table, {backgroundColor: colors.surface}]}>
              <DataTable.Header>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Revenue Group
                </DataTable.Title>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Rev. Group Amount
                </DataTable.Title>
              </DataTable.Header>
              <FlatList
                data={chartData}
                renderItem={props => {
                  return renderItem({...props, tableColumnNumber: 3});
                }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={
                  <ListEmpty
                    actions={[
                      {
                        label: 'Manage categories',
                        handler: () => {
                          navigation.navigate(routes.manageCategories());
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
              {renderSubTotalTable({tableColumnNumber: 3})}
              {renderGrandTotalTable({tableColumnNumber: 3})}
            </DataTable>
          </View>
        </TabScreen>
        <TabScreen label="Cost & Percentage">
          <View style={styles.container}>
            <DataTable
              style={[styles.table, {backgroundColor: colors.surface}]}>
              <DataTable.Header>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Cost of Sales
                </DataTable.Title>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Category Cost %
                </DataTable.Title>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Purchase %
                </DataTable.Title>
              </DataTable.Header>
              <FlatList
                data={chartData}
                renderItem={props => {
                  return renderItem({...props, tableColumnNumber: 4});
                }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={
                  <ListEmpty
                    actions={[
                      {
                        label: 'Manage categories',
                        handler: () => {
                          navigation.navigate(routes.manageCategories());
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
              {renderSubTotalTable({tableColumnNumber: 4})}
              {renderGrandTotalTable({tableColumnNumber: 4})}
            </DataTable>
          </View>
        </TabScreen>
      </Tabs>
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
    </>
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

export default CategoryTabularList;
