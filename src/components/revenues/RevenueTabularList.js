import React, {useState, useRef, useMemo, useCallback} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
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
import {useQuery, useInfiniteQuery} from '@tanstack/react-query';

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

const RevenueTabularList = props => {
  const {dateFilter, highlightedItemId} = props;
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
  } = useInfiniteQuery(['revenueGroups', {dateFilter}], getRevenueGroups, {
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
  const {
    status: revenueGroupsGrandTotalStatus,
    data: revenueGroupsGrandTotalData,
  } = useQuery(
    ['revenueGroupsGrandTotal', {dateFilter}],
    getRevenueGroupsGrandTotal,
  );

  const grandTotal = revenueGroupsGrandTotalData || 0;

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

  const renderItem = ({item}) => {
    const totalRevenue = item.amount || 0;
    const percentage = item.percentage || 0;

    return (
      <DataTable.Row
        style={
          item.id === highlightedItemId
            ? {backgroundColor: colors.highlighted}
            : {}
        }>
        <DataTable.Cell>{item.name}</DataTable.Cell>
        <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
          totalRevenue.toFixed(2),
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View
              style={{
                width: 15,
                height: 15,
                borderRadius: 15 / 2,
                backgroundColor: item.color,
                marginRight: 10,
              }}
            />
            <Text style={{color: colors.dark}}>{`${commaNumber(
              percentage.toFixed(2),
            )}%`}</Text>
          </View>
        </DataTable.Cell>
      </DataTable.Row>
    );
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
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

  const revenueGroups = getAllPagesData();

  const chartColors = [
    colors.primary,
    colors.accent,
    'green',
    colors.notification,
    colors.error,
    colors.text,
  ];

  const chartData = revenueGroups.map((categoryGroup, index) => {
    return {
      ...categoryGroup,
      amount: categoryGroup.amount || 0,
      color: chartColors[index],
    };
  });

  return (
    <>
      <View style={styles.container}>
        <View
          style={{
            borderBottomWidth: 2,
            borderColor: colors.background,
            backgroundColor: colors.surface,
            minHeight: 20 * 2 + 18,
          }}>
          {showChart && (
            <PieChart
              data={chartData}
              width={screenWidth}
              height={230}
              chartConfig={chartConfig}
              accessor={'amount'}
              backgroundColor={'white'}
              paddingLeft={'15'}
              center={[10, 1]}
              absolute
              hasLegend={false}
            />
          )}
          <Pressable
            style={{position: 'absolute', bottom: 0, right: 0}}
            onPress={() => setShowChart(!showChart)}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: 'bold',
                margin: 20,
                color: colors.primary,
              }}>
              {showChart ? 'Hide Chart' : 'Show Chart'}
            </Text>
          </Pressable>
        </View>
        <DataTable style={{flex: 1, backgroundColor: colors.surface}}>
          <DataTable.Header>
            <DataTable.Title>Revenue Group</DataTable.Title>
            <DataTable.Title numeric>Total Revenue</DataTable.Title>
            <DataTable.Title numeric>Percentage</DataTable.Title>
          </DataTable.Header>
          <FlatList
            data={chartData}
            renderItem={renderItem}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              <ListEmpty
                actions={[
                  {
                    label: 'View revenue and expense groups',
                    handler: () => {
                      navigation.navigate(routes.foodCostAnalysis());
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
        </DataTable>
        <GrandTotal value={revenueGroupsGrandTotalData || 0} />
      </View>
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button
          mode="contained"
          onPress={() => {
            navigation.navigate(routes.foodCostAnalysis());
          }}>
          View Revenue and Expense Groups
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

export default RevenueTabularList;
