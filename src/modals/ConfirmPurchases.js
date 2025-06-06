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
  Checkbox,
  TextInput,
  Subheading,
  ActivityIndicator,
  HelperText,
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
import {Formik} from 'formik';
import * as Yup from 'yup';

import useItemFormContext from '../hooks/useItemFormContext';
import MoreSelectionButton from '../components/buttons/MoreSelectionButton';
import GrandTotal from '../components/purchases/GrandTotal';
import PurchaseOrUsageListItem from '../components/purchases/PurchaseOrUsageListItem';
import ListLoadingFooter from '../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import {
  confirmBatchPurchaseEntries,
  getBatchPurchaseEntries,
  getBatchPurchaseEntriesGrandTotal,
} from '../localDbQueries/batchPurchase';
import routes from '../constants/routes';
import {getVendor} from '../localDbQueries/vendors';
import ConfirmationCheckbox from '../components/forms/ConfirmationCheckbox';
import useCurrencySymbol from '../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../utils/stringHelpers';

const PurchaseFormValidationSchema = Yup.object().shape({
  vendor_id: Yup.string().required('Vendor is required'),
  official_receipt_number: Yup.string()
    .required('OR Number is required')
    .max(120, 'OR Number should not be more than 120 characters'),
});

const ConfirmPurchases = props => {
  const {route} = props;
  const currentBatchPurchaseGroupId =
    route.params?.current_batch_purchase_group_id;
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
  const [confirmDateChecked, setConfirmDateChecked] = useState(false);
  const [focusedItem, setFocusedItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [limitReachedMessage, setLimitReachedMessage] = useState('');

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
    ['batchPurchaseEntries', {filter: {}, currentBatchPurchaseGroupId}],
    getBatchPurchaseEntries,
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
  const confirmBatchPurchaseMutation = useMutation(
    confirmBatchPurchaseEntries,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('itemsAndBatchPurchaseEntries');
        queryClient.invalidateQueries('batchPurchaseEntries');
        queryClient.invalidateQueries('batchPurchaseEntriesCount');
        queryClient.invalidateQueries('batchPurchaseGroups');
      },
    },
  );
  const {status: grandTotalStatus, data: grandTotalData} = useQuery(
    ['batchPurchaseEntriesGrandTotal', {currentBatchPurchaseGroupId}],
    getBatchPurchaseEntriesGrandTotal,
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
    if (isRefetching) return;
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

  const handleConfirm = async (values, actions) => {
    try {
      setIsSubmitting(() => true);
      await confirmBatchPurchaseMutation.mutateAsync({
        currentBatchPurchaseGroupId,
        purchaseDate: datetimeString,
        values,
        actions,
        onLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: () => {
          // Pass and merge params back to previous screen
          navigation.navigate({
            name: routes.purchaseEntryList(),
            // pass date instead of boolean in
            // order to run useEffect due to different
            // Date.now value
            params: {batchPurchaseSuccess: Date.now().toString()},
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
        disabled={isRefetching}
        onPress={() => {
          showItemModal(item);
        }}>
        <DataTable.Row>
          <DataTable.Cell>
            <Text style={{color: colors.primary, fontWeight: 'bold'}}>
              {item.name}
            </Text>
          </DataTable.Cell>
          <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
            (item.add_stock_unit_cost || item.unit_cost).toFixed(2),
          )}`}</DataTable.Cell>
          <DataTable.Cell numeric>{`${commaNumber(
            item.add_stock_qty.toFixed(2),
          )} ${formatUOMAbbrev(item.uom_abbrev)}`}</DataTable.Cell>
          <DataTable.Cell numeric>
            {`${currencySymbol} ${commaNumber(item.total_cost?.toFixed(2))}`}
          </DataTable.Cell>
        </DataTable.Row>
      </TouchableOpacity>
    );
  };

  const {setFormikActions} = useItemFormContext();

  const [vendorId, setVendorId] = useState(null);
  const {
    status: getVendorStatus,
    data: getVendorData,
    isRefetching: isVendorRefetching,
  } = useQuery(['vendor', {id: vendorId}], getVendor);

  const handleVendorChange = vendorId => {
    setVendorId(() => vendorId);
  };

  const renderVendorValue = (status, data, props) => {
    if (!vendorId) return null;

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
            isListRefetching={isRefetching}
            onDismiss={hideItemModal}
          />
        </Modal>
      </Portal>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <Formik
        initialValues={{
          vendor_id: '',
          official_receipt_number: '',
        }}
        onSubmit={handleConfirm}
        validationSchema={PurchaseFormValidationSchema}>
        {props => {
          const {
            handleChange,
            handleBlur,
            handleSubmit,
            values,
            errors,
            touched,
            dirty,
            isValid,
            isSubmitting,
            setFieldValue,
            setFieldTouched,
            setFieldError,
          } = props;

          return (
            <View style={[styles.container, {backgroundColor: colors.surface}]}>
              <View
                style={{
                  paddingTop: 10,
                  paddingHorizontal: 10,
                  backgroundColor: colors.surface,
                  // marginBottom: 5,
                }}>
                <View
                  style={{
                    marginTop: 5,
                    // flexDirection: 'row',
                    // alignItems: 'center',
                    backgroundColor: colors.surface,
                  }}>
                  <MoreSelectionButton
                    placeholder="Select Vendor"
                    label="Vendor"
                    renderValueCurrentValue={values.vendor_id}
                    renderValue={(_value, renderingValueProps) =>
                      renderVendorValue(
                        getVendorStatus,
                        getVendorData,
                        renderingValueProps,
                      )
                    }
                    onChangeValue={currentValue => {
                      handleVendorChange(currentValue);
                      handleChange('vendor_id')(currentValue);
                    }}
                    onPress={() => {
                      setFormikActions(() => ({
                        setFieldValue,
                        setFieldTouched,
                        setFieldError,
                      }));

                      navigation.navigate(routes.itemVendor(), {
                        vendor_id: values.vendor_id,
                        vendor_id_field_key: 'vendor_id',
                        is_vendor_id_required: true,
                      });
                    }}
                    error={errors.vendor_id && touched.vendor_id ? true : false}
                  />
                  <TextInput
                    label="Official Receipt #"
                    onChangeText={handleChange('official_receipt_number')}
                    onBlur={handleBlur('official_receipt_number')}
                    value={values.official_receipt_number}
                    error={
                      errors.official_receipt_number &&
                      touched.official_receipt_number
                        ? true
                        : false
                    }
                  />
                  <MoreSelectionButton
                    label="Purchase Date"
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
              <ConfirmationCheckbox
                status={confirmDateChecked}
                text="Confirm date of purchase"
                onPress={() => {
                  setConfirmDateChecked(!confirmDateChecked);
                }}
              />
              <DataTable style={{flex: 1}}>
                <DataTable.Header>
                  <DataTable.Title>Item</DataTable.Title>
                  <DataTable.Title numeric>Unit Cost</DataTable.Title>
                  <DataTable.Title numeric>Add Stock</DataTable.Title>
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
                <View
                  style={{
                    alignItems: 'center',
                  }}>
                  <HelperText
                    visible={true}
                    style={{
                      color: colors.dark,
                      fontStyle: 'italic',
                      marginVertical: 5,
                    }}>
                    Tap item to view or edit
                  </HelperText>
                </View>
              </DataTable>

              <GrandTotal
                label="Carts Grand Total"
                value={grandTotalData || 0}
              />
              <View style={{padding: 10}}>
                <Button
                  disabled={
                    !dirty || !isValid || isSubmitting || !confirmDateChecked
                  }
                  loading={isSubmitting}
                  mode="contained"
                  style={{marginBottom: 10}}
                  onPress={handleSubmit}>
                  Confirm & Proceed
                </Button>
                <Button
                  onPress={() => {
                    navigation.goBack();
                  }}>
                  Cancel
                </Button>
              </View>
            </View>
          );
        }}
      </Formik>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ConfirmPurchases;
