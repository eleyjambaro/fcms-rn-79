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
  RadioButton,
} from 'react-native-paper';
import {BottomSheetModal, BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import moment from 'moment';

import SalesInvoiceItemListItem from './SalesInvoiceItemListItem';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import useSalesCounterContext from '../../hooks/useSalesCounterContext';
import SalesInvoiceTotals from './SalesInvoiceTotals';
import TestModeLimitModal from '../modals/TestModeLimitModal';
import MoreSelectionButton from '../buttons/MoreSelectionButton';
import SectionHeading from '../headings/SectionHeading';
import {
  addSaleEntriesToSalesOrders,
  confirmFulfillingSalesOrders,
  confirmSaleEntries,
} from '../../localDbQueries/salesCounter';

const SalesInvoiceItemList = props => {
  const {
    filter,
    backAction,
    viewMode,
    reviewMode,
    salesOrderGroupId,
    routeToGoBack,
    listItemDisplayMode,
    listStyle,
    listContentContainerStyle,
    showActionButtons = true,
  } = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [_focusedItem, setFocusedItem] = useState(null);
  const [{focusedItem, saleItems, isLocalStateUpdating}, actions] =
    useSalesCounterContext();

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limitReachedMessage, setLimitReachedMessage] = useState('');
  const [action, setAction] = useState(
    reviewMode === 'new-sales-order'
      ? 'add-to-sales-order'
      : reviewMode === 'fulfilling-sales-order'
      ? 'confirm-fulfilling-sales-order'
      : 'proceed-to-sales-invoice',
  );

  const queryClient = useQueryClient();
  const confirmSaleEntriesMutation = useMutation(confirmSaleEntries, {
    onSuccess: () => {
      queryClient.invalidateQueries('items');
    },
  });

  const addSaleEntriesToSalesOrdersMutation = useMutation(
    addSaleEntriesToSalesOrders,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('salesOrderGroups');
      },
    },
  );

  const confirmFulfillingSalesOrdersMutation = useMutation(
    confirmFulfillingSalesOrders,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('salesOrderGroupItems');
        queryClient.invalidateQueries('items');
      },
    },
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

  const loadMore = () => {};

  const getListData = () => {
    let listData = [];

    if (saleItems) {
      for (let itemId in saleItems) {
        let item = saleItems[itemId];
        listData.push(item);
      }
    }

    return listData;
  };

  const renderFooter = () => {
    return null;
  };

  const itemOptions = [
    {
      label: 'Manage Stocks',
      icon: 'text-box-check-outline',
      handler: () => {
        navigation.navigate(routes.manageStock(), {item_id: focusedItem.id});
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        navigation.navigate(routes.editItem(), {item_id: focusedItem.id});
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Delete',
      labelColor: colors.notification,
      icon: 'delete-outline',
      iconColor: colors.notification,
      handler: () => {
        closeOptionsBottomSheet();
      },
    },
  ];

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        backAction && backAction();
        closeOptionsBottomSheet();
      },
    );

    return () => backHandler.remove();
  }, []);

  //   return () => {
  //     if (routeToGoBack) {
  //       // Pass and merge params back to previous screen
  //       navigation.navigate({
  //         name: routeToGoBack,
  //         // pass date instead of boolean in
  //         // order to run useEffect due to different
  //         // Date.now value
  //         params: {goBackedFromConfirmation: Date.now().toString()},
  //         merge: true,
  //       });
  //     }
  //   };
  // }, []);

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, itemOptions.length * 75 + 30],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmSaleEntries = async items => {
    try {
      setIsSubmitting(() => true);
      await confirmSaleEntriesMutation.mutateAsync({
        saleDate: datetimeString,
        saleItems: items,
        onLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: () => {
          actions?.resetSalesCounter();

          // Pass and merge params back to previous screen
          navigation.navigate({
            name: routeToGoBack || routes.counter(),
            // pass date instead of boolean in
            // order to run useEffect due to different
            // Date.now value
            params: {salesConfirmationSuccess: Date.now().toString()},
            merge: true,
          });
        },
      });
    } catch (error) {
      console.debug(error);
      throw error;
    } finally {
      setIsSubmitting(() => false);
    }
  };

  const handleAddSaleEntriesToSalesOrders = async items => {
    try {
      setIsSubmitting(() => true);
      await addSaleEntriesToSalesOrdersMutation.mutateAsync({
        orderDate: datetimeString,
        saleItems: items,
        onLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: () => {
          actions?.resetSalesCounter();

          // Pass and merge params back to previous screen
          navigation.navigate({
            name: routeToGoBack,
            // pass date instead of boolean in
            // order to run useEffect due to different
            // Date.now value
            params: {addSalesOrdersSuccess: Date.now().toString()},
            merge: true,
          });
        },
      });
    } catch (error) {
      console.debug(error);
      throw error;
    } finally {
      setIsSubmitting(() => false);
    }
  };

  const handleConfirmFulfillingSalesOrders = async items => {
    try {
      setIsSubmitting(() => true);
      await confirmFulfillingSalesOrdersMutation.mutateAsync({
        saleDate: datetimeString,
        salesOrderGroupId,
        saleItems: items,
        onLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: () => {
          actions?.resetSalesCounter();

          const dateNowString = Date.now().toString();

          const params = {addSalesOrdersSuccess: dateNowString};

          if (action === 'proceed-to-sales-invoice') {
            params.salesConfirmationSuccess = dateNowString;
          }

          // Pass and merge params back to previous screen
          navigation.navigate({
            name: routeToGoBack,
            // pass date instead of boolean in
            // order to run useEffect due to different
            // Date.now value
            params,
            merge: true,
          });
        },
      });
    } catch (error) {
      console.debug(error);
      throw error;
    } finally {
      setIsSubmitting(() => false);
    }
  };

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const handleDateTimePickerChange = (_event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowCalendar(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const renderBottomSheetBackdrop = useCallback(
    props => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={1}
      />
    ),
    [],
  );

  const renderOptions = () => {
    return (
      <View style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Item options'}
        </Text>
        <OptionsList options={itemOptions} />
      </View>
    );
  };

  const renderItem = ({item}) => {
    const saleQty = saleItems?.[item?.id]?.saleQty;

    return (
      <SalesInvoiceItemListItem
        isHighlighted={item?.id === focusedItem?.id ? true : false}
        isHighlightedUpdating={
          item?.id === focusedItem?.id && isLocalStateUpdating ? true : false
        }
        disabled={
          item?.id !== focusedItem?.id && isLocalStateUpdating ? true : false
        }
        item={item}
        saleQty={saleQty}
        displayMode={listItemDisplayMode}
        onPressItem={() => {
          // avoid focusing to another item while other component level state is updating
          if (isLocalStateUpdating) return;

          setFocusedItem(() => item);
          actions?.setFocusedItem(() => item);
        }}
        // onPressItemOnHighlighted={() => {
        //   // avoid focusing to another item while other component level state is updating
        //   if (isLocalStateUpdating) return;

        //   setFocusedItem(() => item);
        //   actions?.setFocusedItem(() => item);
        //   actions?.increaseSaleItemQty();
        // }}
        onPressItemOptions={() => {
          setFocusedItem(() => item);
          openOptionsBottomSheet();
        }}
      />
    );
  };

  const renderConfirmButton = () => {
    if (action === 'proceed-to-sales-invoice') {
      return (
        <Button
          mode="contained"
          disabled={isLocalStateUpdating || isSubmitting || !items?.length}
          loading={isLocalStateUpdating || isSubmitting}
          onPress={() => {
            handleConfirmSaleEntries(items);
          }}>
          Confirm & Proceed
        </Button>
      );
    } else if (action === 'add-to-sales-order') {
      return (
        <Button
          mode="contained"
          disabled={isLocalStateUpdating || isSubmitting || !items?.length}
          loading={isLocalStateUpdating || isSubmitting}
          onPress={() => {
            handleAddSaleEntriesToSalesOrders(items);
          }}>
          Add To Sales Orders
        </Button>
      );
    } else if (action === 'confirm-fulfilling-sales-order') {
      return (
        <Button
          mode="contained"
          disabled={isLocalStateUpdating || isSubmitting || !items?.length}
          loading={isLocalStateUpdating || isSubmitting}
          onPress={() => {
            handleConfirmFulfillingSalesOrders(items);
          }}>
          Confirm Fulfilling Sales Order
        </Button>
      );
    }

    return (
      <Button
        mode="contained"
        disabled={
          !action || isLocalStateUpdating || isSubmitting || !items?.length
        }
        loading={isLocalStateUpdating || isSubmitting}
        onPress={() => {}}>
        Confirm & Proceed
      </Button>
    );
  };

  const renderActionSelectionButtons = () => {
    if (reviewMode === 'sales-order') return null;

    return (
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <SectionHeading
          headingText={'Select an Action'}
          containerStyle={{paddingTop: 0}}
        />

        <Pressable
          onPress={() => setAction(() => 'proceed-to-sales-invoice')}
          style={[
            {
              borderWidth: 1,
              borderColor: colors.neutralTint3,
              borderRadius: 5,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 10,
            },
            action === 'proceed-to-sales-invoice' && {
              backgroundColor: colors.highlighted,
            },
          ]}>
          <MaterialIcons name="receipt-long" size={37} color={colors.dark} />

          <View style={{marginLeft: 10}}>
            <Text style={{fontSize: 18, fontWeight: '500', color: colors.dark}}>
              Proceed Items to Sales Invoice
            </Text>
            <Text style={{fontSize: 12}}>
              Directly create sales invoice of these items
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setAction(() => 'add-to-sales-order')}
          style={[
            {
              borderWidth: 1,
              borderColor: colors.neutralTint3,
              borderRadius: 5,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 10,
              marginTop: 10,
            },
            action === 'add-to-sales-order' && {
              backgroundColor: colors.highlighted,
            },
          ]}>
          <MaterialCommunityIcons
            name="clipboard-check-multiple-outline"
            size={37}
            color={colors.dark}
          />

          <View style={{marginLeft: 10}}>
            <Text style={{fontSize: 18, fontWeight: '500', color: colors.dark}}>
              Add Items to Sales Orders
            </Text>
            <Text style={{fontSize: 12}}>
              Track sales items before creating a sales invoice
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  const items = getListData();

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
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />

      {/* {renderActionSelectionButtons()} */}

      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 5,
          backgroundColor: colors.surface,
        }}>
        <View
          style={{
            marginVertical: 5,
            backgroundColor: colors.surface,
          }}>
          <MoreSelectionButton
            label={
              action === 'add-sales-order'
                ? 'Sales Order Date'
                : 'Sales Invoice Date'
            }
            value={moment(datetimeString.split(' ')[0]).format('MMM DD, YYYY')}
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
      <FlatList
        contentContainerStyle={listContentContainerStyle}
        style={[{backgroundColor: colors.surface, marginTop: 2}, listStyle]}
        data={items}
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
      />
      <SalesInvoiceTotals />
      {showActionButtons && (
        <>
          <View
            style={{
              backgroundColor: 'white',
              padding: 10,
            }}>
            {/* <Pressable
              onPress={() => setAction(() => 'proceed-to-sales-invoice')}
              style={[
                {
                  borderWidth: 1,
                  borderRadius: 5,
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                },
                action === 'proceed-to-sales-invoice' && {
                  backgroundColor: colors.highlighted,
                },
              ]}>
              <MaterialIcons
                name="receipt-long"
                size={37}
                color={colors.dark}
              />

              <View style={{marginLeft: 10}}>
                <Text
                  style={{fontSize: 18, fontWeight: '500', color: colors.dark}}>
                  Proceed Items to Sales Invoice
                </Text>
                <Text style={{fontSize: 12}}>
                  Directly create sales invoice of these items
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setAction(() => 'add-to-sales-order')}
              style={[
                {
                  borderWidth: 1,
                  borderRadius: 5,
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                  marginVertical: 10,
                },
                action === 'add-to-sales-order' && {
                  backgroundColor: colors.highlighted,
                },
              ]}>
              <MaterialCommunityIcons
                name="clipboard-check-multiple-outline"
                size={37}
                color={colors.dark}
              />

              <View style={{marginLeft: 10}}>
                <Text
                  style={{fontSize: 18, fontWeight: '500', color: colors.dark}}>
                  Add Items to Sales Orders
                </Text>
                <Text style={{fontSize: 12}}>
                  Track sales items before creating a sales invoice
                </Text>
              </View>
            </Pressable> */}

            {renderConfirmButton()}
          </View>
        </>
      )}
      <BottomSheetModal
        ref={optionsBottomSheetModalRef}
        index={1}
        snapPoints={optionsBottomSheetSnapPoints}
        backdropComponent={renderBottomSheetBackdrop}
        onChange={handleBottomSheetChange}>
        {renderOptions()}
      </BottomSheetModal>
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

export default SalesInvoiceItemList;
