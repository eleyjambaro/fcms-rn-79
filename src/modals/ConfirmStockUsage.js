import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  Button,
  useTheme,
  DataTable,
  Modal,
  Portal,
  Text,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';

import MoreSelectionButton from '../components/buttons/MoreSelectionButton';
import GrandTotal from '../components/purchases/GrandTotal';
import PurchaseOrUsageListItem from '../components/purchases/PurchaseOrUsageListItem';
import ListLoadingFooter from '../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {
  confirmBatchStockUsageEntries,
  getBatchStockUsageEntries,
  getBatchStockUsageEntriesGrandTotal,
} from '../localDbQueries/batchStockUsage';
import routes from '../constants/routes';
import useCurrencySymbol from '../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../utils/stringHelpers';

const ConfirmStockUsage = () => {
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const navigation = useNavigation();
  const [date, setDate] = useState(new Date());
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  const year = date.getFullYear();
  const hours = ('0' + date.getHours()).slice(-2);
  const minutes = ('0' + date.getMinutes()).slice(-2);
  const seconds = ('0' + date.getSeconds()).slice(-2);
  const datetimeStringFormat = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  const [datetimeString, setDatetimeString] = useState(datetimeStringFormat);
  const [dateTimePickerMode, setDateTimePickerMode] = useState('date');
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewItemModalVisible, setViewItemModalVisible] = useState(false);
  const [focusedItem, setFocusedItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    ['batchStockUsageEntries', {filter: {}}],
    getBatchStockUsageEntries,
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
  const queryClient = useQueryClient();
  const confirmBatchStockUsageMutation = useMutation(
    confirmBatchStockUsageEntries,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('itemsAndBatchStockUsageEntries');
        queryClient.invalidateQueries('batchStockUsageEntries');
        queryClient.invalidateQueries('batchStockUsageEntriesCount');
        queryClient.invalidateQueries('batchStockUsageGroups');
      },
    },
  );
  const {status: grandTotalStatus, data: grandTotalData} = useQuery(
    ['batchStockUsageEntriesGrandTotal', {}],
    getBatchStockUsageEntriesGrandTotal,
  );

  useEffect(() => {
    setDatetimeString(currentDatetimeString => {
      const updatedDatetimeString = datetimeStringFormat;
      if (updatedDatetimeString !== currentDatetimeString) {
        return updatedDatetimeString;
      } else {
        return currentDatetimeString;
      }
    });
  }, [date]);

  const showMode = currentMode => {
    setShowCalendar(true);
    setDateTimePickerMode(currentMode);
  };

  const showDatepicker = () => {
    showMode('date');
  };

  const showTimepicker = () => {
    showMode('time');
  };

  const showItemModal = item => {
    setFocusedItem(() => item);
    setViewItemModalVisible(() => true);
  };

  const hideItemModal = () => {
    setFocusedItem(() => null);
    setViewItemModalVisible(() => false);
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

  const handleSubmit = async () => {
    try {
      setIsSubmitting(() => true);
      await confirmBatchStockUsageMutation.mutateAsync({
        usageDate: datetimeString,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      setIsSubmitting(() => false);

      // Pass and merge params back to previous screen
      navigation.navigate({
        name: routes.stockUsageEntryList(),
        // pass date instead of boolean in
        // order to run useEffect due to different
        // Date.now value
        params: {batchStockUsageSuccess: Date.now().toString()},
        merge: true,
      });
    }
  };

  const handleDateTimePickerChange = (_event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowCalendar(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const renderItem = ({item}) => {
    return (
      <TouchableOpacity
        onPress={() => {
          showItemModal(item);
        }}>
        <DataTable.Row>
          <DataTable.Cell>{item.name}</DataTable.Cell>
          <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
            item.remove_stock_unit_cost || item.unit_cost,
          )}`}</DataTable.Cell>
          <DataTable.Cell numeric>{`${item.remove_stock_qty} ${formatUOMAbbrev(
            item.uom_abbrev,
          )}`}</DataTable.Cell>
          <DataTable.Cell numeric>
            {`${currencySymbol} ${commaNumber(
              item.unit_cost * item.remove_stock_qty,
            )}`}
          </DataTable.Cell>
        </DataTable.Row>
      </TouchableOpacity>
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

  return (
    <>
      {showCalendar && (
        <DateTimePicker
          testID="dateTimePicker"
          value={date}
          mode={dateTimePickerMode}
          is24Hour={true}
          onChange={handleDateTimePickerChange}
        />
      )}
      <Portal>
        <Modal visible={viewItemModalVisible} onDismiss={hideItemModal}>
          <PurchaseOrUsageListItem
            item={focusedItem}
            mode="stock-usage"
            onDismiss={hideItemModal}
          />
        </Modal>
      </Portal>
      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <View
          style={{
            padding: 10,
            backgroundColor: colors.surface,
            // marginBottom: 5,
          }}>
          <View
            style={{
              marginVertical: 5,
              // flexDirection: 'row',
              // alignItems: 'center',
              backgroundColor: colors.surface,
            }}>
            <MoreSelectionButton
              label="Usage Date"
              value={moment(datetimeString.split(' ')[0]).format(
                'MMM DD, YYYY',
              )}
              containerStyle={{marginTop: -1}}
              onPress={() => {
                showDatepicker();
              }}
              renderIcon={({iconSize, iconColor}) => {
                return (
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={iconSize}
                    color={iconColor}
                  />
                );
              }}
            />
          </View>
        </View>
        <DataTable style={{flex: 1}}>
          <DataTable.Header>
            <DataTable.Title>Item</DataTable.Title>
            <DataTable.Title numeric>Unit Cost</DataTable.Title>
            <DataTable.Title numeric>Used Stock</DataTable.Title>
            <DataTable.Title numeric>Total Cost</DataTable.Title>
          </DataTable.Header>
          <FlatList
            data={pagesData}
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
        </DataTable>
        <GrandTotal value={grandTotalData || 0} />
        <View style={{padding: 10}}>
          <Button
            disabled={isSubmitting}
            loading={isSubmitting}
            mode="contained"
            style={{marginBottom: 10}}
            onPress={handleSubmit}>
            Proceed
          </Button>
          <Button
            onPress={() => {
              navigation.goBack();
            }}>
            Cancel
          </Button>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ConfirmStockUsage;
