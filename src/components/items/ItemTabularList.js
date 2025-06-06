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
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

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

const ItemTabularList = props => {
  const {dateFilter, highlightedItemId, filter = {}} = props;
  const {colors} = useTheme();
  const route = useRoute();
  const currencySymbol = useCurrencySymbol();
  const navigation = useNavigation();

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
    ['itemsMonthlyReport', {dateFilter, filter}],
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
  // const {
  //   status: revenueGroupsGrandTotalStatus,
  //   data: revenueGroupsGrandTotalData,
  // } = useQuery(
  //   ['revenueGroupsGrandTotal', {dateFilter}],
  //   getRevenueGroupsGrandTotal,
  // );

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

  // const grandTotal = revenueGroupsGrandTotalData || 0;

  const [showChart, setShowChart] = useState(false);

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

    if (tableColumnNumber === 1) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell>{item.item_name}</DataTable.Cell>
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
          <DataTable.Cell numeric>{`${
            item.previous_month_grand_total_qty || 0
          } ${formatUOMAbbrev(item.item_uom_abbrev)}`}</DataTable.Cell>
          <DataTable.Cell numeric>{`${
            item.selected_month_total_added_stock_qty || 0
          } ${formatUOMAbbrev(item.item_uom_abbrev)}`}</DataTable.Cell>
          <DataTable.Cell numeric>{`${
            item.selected_month_total_removed_stock_qty || 0
          } ${formatUOMAbbrev(item.item_uom_abbrev)}`}</DataTable.Cell>
          <DataTable.Cell numeric>{`${
            item.selected_month_grand_total_qty || 0
          } ${formatUOMAbbrev(item.item_uom_abbrev)}`}</DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 3) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
            selectedMonthGrandTotalCostNet.toFixed(2),
          )}`}</DataTable.Cell>
          <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
            avgUnitCostNet.toFixed(2),
          )}`}</DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 4) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell>{item.revenue_group_name}</DataTable.Cell>
          <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
            selectedMonthRevenueGroupTotalAmount.toFixed(2),
          )}`}</DataTable.Cell>
          <DataTable.Cell numeric>
            {`${commaNumber(itemCostPercentage.toFixed(2))}%`}
          </DataTable.Cell>
        </DataTable.Row>
      );
    }

    return null;
  };

  const renderSubTotalTable = ({tableColumnNumber}) => {
    const tableRowStyle = {backgroundColor: colors.accent};

    if (!filter?.['items.category_id']) return null;

    if (tableColumnNumber === 1) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell>
            <Text style={{fontWeight: 'bold'}}>Selected Category Total</Text>
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
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 3) {
      return (
        <DataTable.Row style={tableRowStyle}>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>
              {`${currencySymbol} ${commaNumber(
                (totals?.selectedMonthAllItemsTotalCostNet || 0).toFixed(2),
              )}`}
            </Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 4) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
        </DataTable.Row>
      );
    }

    return <DataTable.Row style={tableRowStyle}></DataTable.Row>;
  };

  const renderGrandTotalTable = ({tableColumnNumber}) => {
    if (filter?.['items.category_id']) return null;

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
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 3) {
      return (
        <DataTable.Row style={tableRowStyle}>
          <DataTable.Cell numeric>
            <Text style={{fontWeight: 'bold'}}>
              {`${currencySymbol} ${commaNumber(
                (grandTotal?.selectedMonthAllItemsTotalCostNet || 0).toFixed(2),
              )}`}
            </Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
        </DataTable.Row>
      );
    }

    if (tableColumnNumber === 4) {
      return (
        <DataTable.Row style={[tableRowStyle]}>
          <DataTable.Cell>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
          <DataTable.Cell numeric>{`---`}</DataTable.Cell>
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
      <Tabs
        // defaultIndex={0} // default = 0
        uppercase={false} // true/false | default=true | labels are uppercase
        // showTextLabel={false} // true/false | default=false (KEEP PROVIDING LABEL WE USE IT AS KEY INTERNALLY + SCREEN READERS)
        // iconPosition // leading, top | default=leading
        style={{
          backgroundColor: colors.surface,
          borderTopWidth: 5,
          borderTopColor: colors.neutralTint5,
        }} // works the same as AppBar in react-native-paper
        // dark={false} // works the same as AppBar in react-native-paper
        // theme={} // works the same as AppBar in react-native-paper
        mode="scrollable" // fixed, scrollable | default=fixed
        // onChangeIndex={(newIndex) => {}} // react on index change
        // showLeadingSpace={true} //  (default=true) show leading space in scrollable tabs inside the header
        // disableSwipe={false} // (default=false) disable swipe to left/right gestures
      >
        <TabScreen label="Item">
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

              {renderSubTotalTable({tableColumnNumber: 1})}
              {renderGrandTotalTable({tableColumnNumber: 1})}
            </DataTable>
          </View>
        </TabScreen>
        <TabScreen label="Stock">
          <View style={styles.container}>
            <DataTable
              style={[styles.table, {backgroundColor: colors.surface}]}>
              <DataTable.Header>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Previous Month
                </DataTable.Title>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Added
                </DataTable.Title>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Removed
                </DataTable.Title>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Total
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

              {renderSubTotalTable({tableColumnNumber: 2})}
              {renderGrandTotalTable({tableColumnNumber: 2})}
            </DataTable>
          </View>
        </TabScreen>
        <TabScreen label="Cost">
          <View style={styles.container}>
            <DataTable
              style={[styles.table, {backgroundColor: colors.surface}]}>
              <DataTable.Header>
                <DataTable.Title style={styles.tableColumn} numeric>
                  {`Total Stock Cost (Net)`}
                </DataTable.Title>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Avg. Unit Cost
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

              {renderSubTotalTable({tableColumnNumber: 3})}
              {renderGrandTotalTable({tableColumnNumber: 3})}
            </DataTable>
          </View>
        </TabScreen>
        <TabScreen label="Revenue">
          <View style={styles.container}>
            <DataTable
              style={[styles.table, {backgroundColor: colors.surface}]}>
              <DataTable.Header>
                <DataTable.Title style={styles.tableColumn}>
                  Revenue Group
                </DataTable.Title>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Rev. Group Amount
                </DataTable.Title>
                <DataTable.Title style={styles.tableColumn} numeric>
                  Item Cost %
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
            navigation.navigate(routes.monthlyReportByCategory());
          }}>
          View Report by Category
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

export default ItemTabularList;
