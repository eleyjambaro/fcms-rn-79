import React, {useState, useEffect} from 'react';
import {StyleSheet, View, Modal} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Divider,
  useTheme,
  Subheading,
  ActivityIndicator,
  HelperText,
  RadioButton,
} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {Formik} from 'formik';
import {useQuery} from '@tanstack/react-query';
import * as Yup from 'yup';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';

import routes from '../../constants/routes';
import useItemFormContext from '../../hooks/useItemFormContext';
import CheckboxSelection from './CheckboxSelection';
import MoreSelectionButton from '../../components/buttons/MoreSelectionButton';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import TaxCalculation from '../../components/taxes/TaxCalculation';
import QuantityUOMText from './QuantityUOMText';
import {getInventoryOperations} from '../../localDbQueries/operations';
import {getTax} from '../../localDbQueries/taxes';
import {getItem} from '../../localDbQueries/items';
import {getVendor} from '../../localDbQueries/vendors';
import {getInventoryLog} from '../../localDbQueries/inventoryLogs';
import MonthPicker from 'react-native-month-picker';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import appDefaults from '../../constants/appDefaults';

const AddStockValidationSchema = Yup.object().shape({
  operation_id: Yup.string().required('Operation is required'),
  use_measurement_per_piece: Yup.boolean(),
  adjustment_unit_cost: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  adjustment_qty: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Quantity field is required.'),
  remarks: Yup.string().max(
    120,
    'Remarks should not be more than 120 characters.',
  ),
});

const AddStockForm = props => {
  const {
    itemId,
    logId,
    initialValues = {
      operation_id: '',
      item_id: '',
      tax_id: '',
      vendor_id: '',
      use_measurement_per_piece: '',
      adjustment_unit_cost: '',
      adjustment_qty: '',
      cost_input_mode: 'total_cost', // 'total_cost' or 'unit_cost'
      adjustment_date: '',
      beginning_inventory_date: '',
      official_receipt_number: '',
      remarks: '',
    },
    onSubmit,
    onCancel,
    onFocus,
    editMode = false,
    fromEndingInventory = false,
  } = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  let defaultDate = initialValues.adjustment_date
    ? new Date(initialValues.adjustment_date?.split(' ')?.[0])
    : new Date();

  if (parseInt(initialValues.operation_id) === 1) {
    defaultDate = initialValues.beginning_inventory_date
      ? new Date(initialValues.beginning_inventory_date?.split(' ')?.[0])
      : new Date();
  }

  const [date, setDate] = useState(defaultDate);
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  const year = date.getFullYear();
  const hours = ('0' + date.getHours()).slice(-2);
  const minutes = ('0' + date.getMinutes()).slice(-2);
  const seconds = ('0' + date.getSeconds()).slice(-2);
  const datetimeStringFormat = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  const minimumDate = new Date(year, date.getMonth());
  const maximumDate = new Date(year, date.getMonth() + 1, 0);
  const [datetimeString, setDatetimeString] = useState(datetimeStringFormat);
  const [dateTimePickerMode, setDateTimePickerMode] = useState('date');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  let dateLabel = 'Added Date';
  let dateValue = moment(datetimeString.split(' ')[0]).format('MMM DD, YYYY');

  if (parseInt(initialValues.operation_id) === 1) {
    dateLabel = 'Beginning Inventory';
    dateValue = moment(datetimeString.split(' ')[0]).format('MMM YYYY');
  }

  const {setFormikActions} = useItemFormContext();
  const {status: getItemStatus, data: getItemData} = useQuery(
    ['item', {id: itemId}],
    getItem,
    {
      enabled: itemId ? true : false,
    },
  );
  const item = getItemData?.result;

  const {status: getInventoryLogStatus, data: getInventoryLogData} = useQuery(
    ['inventoryLog', {id: logId}],
    getInventoryLog,
    {
      enabled: editMode && logId ? true : false,
    },
  );
  const inventoryLog = getInventoryLogData?.result;

  let defaultTaxId = 0;
  let defaultVendorId = 0;

  if (item) {
    defaultTaxId = item.tax_id;
    defaultVendorId = item.preferred_vendor_id;
  }

  if (editMode && inventoryLog) {
    defaultTaxId = inventoryLog.ref_tax_id;
    defaultVendorId = inventoryLog.ref_vendor_id;
  }

  const [taxId, setTaxId] = useState(defaultTaxId);
  const [vendorId, setVendorId] = useState(defaultVendorId);
  const {
    status: getTaxStatus,
    data: getTaxData,
    isRefetching: isTaxRefetching,
  } = useQuery(['tax', {id: taxId}], getTax, {
    enabled: item?.tax_id || taxId ? true : false,
  });
  const {
    status: getVendorStatus,
    data: getVendorData,
    isRefetching: isVendorRefetching,
  } = useQuery(['vendor', {id: vendorId}], getVendor, {
    enabled: item?.preferred_vendor_id || vendorId ? true : false,
  });
  const {
    status: getInventoryOperationsStatus,
    data: getInventoryOperationsData,
  } = useQuery(
    ['operations', {filter: {type: 'add_stock'}}],
    getInventoryOperations,
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

  const handleDateTimePickerChange = (_event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowCalendar(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const handleMonthChange = selectedDate => {
    setDate(() => new Date(selectedDate));
  };

  const handleTaxChange = taxId => {
    setTaxId(() => taxId);
  };

  const renderUseMeasurementPerPieceCheckbox = formikProps => {
    const {
      handleChange,
      handleBlur,
      handleSubmit,
      setFieldValue,
      values,
      errors,
      touched,
      isValid,
      dirty,
      isSubmitting,
      setFieldTouched,
      setFieldError,
      setErrors,
    } = formikProps;

    if (!editMode && item?.uom_abbrev === 'ea' && item?.uom_abbrev_per_piece) {
      return (
        <View style={{marginVertical: 10}}>
          <ConfirmationCheckbox
            status={values.use_measurement_per_piece}
            text={`Use item's UOM per Piece (${formatUOMAbbrev(
              item?.uom_abbrev_per_piece,
            )})`}
            containerStyle={{paddingTop: 5, paddingBottom: 5}}
            onPress={() => {
              if (values.use_measurement_per_piece === false) {
                // Reset cost
                setFieldValue('adjustment_unit_cost', '0');
                setFieldTouched('adjustment_unit_cost', false);

                setFieldValue('adjustment_total_cost', '0');
                setFieldTouched('adjustment_total_cost', false);
              } else {
                const itemUnitCost = item?.unit_cost || 0;

                setFieldValue(
                  'adjustment_unit_cost',
                  itemUnitCost?.toString() || '',
                );

                // set calculated total cost
                const adjustmentQty = parseFloat(values.adjustment_qty || 0);
                const calculatedTotalCost = itemUnitCost * adjustmentQty;

                setFieldValue(
                  'adjustment_total_cost',
                  calculatedTotalCost?.toString(),
                );

                setFieldValue('cost_input_mode', 'unit_cost');
              }

              setFieldTouched('use_measurement_per_piece', true);
              setFieldValue(
                'use_measurement_per_piece',
                !values.use_measurement_per_piece,
              );
            }}
          />
        </View>
      );
    }
  };

  const renderTaxValue = (status, data, props) => {
    if (!taxId) return null;

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
        {props?.trimTextLength(
          `${data.result?.name} (${data.result?.rate_percentage}%)`,
        )}
      </Subheading>
    );
  };

  const renderTaxCalculation = values => {
    const tax = getTaxData?.result;

    return (
      <TaxCalculation
        item={values}
        tax={tax}
        containerStyle={{marginTop: -1}}
      />
    );
  };

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

  const renderDeletedInventoryLogAppliedTax = (
    deletedInventoryLogAppliedTax = null,
  ) => {
    if (!editMode || !deletedInventoryLogAppliedTax) return null;

    if (parseInt(taxId) === 0) return null;

    if (isTaxRefetching) return null;

    if (getInventoryLogStatus === 'loading' || getTaxStatus === 'loading') {
      return null;
    }

    if (getInventoryLogStatus === 'error' || getTaxStatus === 'error') {
      return null;
    }

    return (
      <HelperText
        visible={true}
        style={{
          color: colors.dark,
          fontStyle: 'italic',
          marginVertical: 5,
        }}>
        {
          <Text style={{fontStyle: 'italic'}}>
            * This inventory operation has{' '}
          </Text>
        }
        {
          <Text style={{fontWeight: 'bold', fontStyle: 'italic'}}>
            {`${deletedInventoryLogAppliedTax?.name} (${deletedInventoryLogAppliedTax?.rate_percentage}%)`}
          </Text>
        }{' '}
        tax applied on it. You can select a new tax to update if only needed.
      </HelperText>
    );
  };

  const renderDeletedInventoryLogVendor = (
    deletedInventoryLogVendor = null,
  ) => {
    if (!editMode || !deletedInventoryLogVendor) return null;

    if (parseInt(vendorId) === 0) return null;

    if (isVendorRefetching) return null;

    if (getInventoryLogStatus === 'loading' || getVendorStatus === 'loading') {
      return null;
    }

    if (getInventoryLogStatus === 'error' || getVendorStatus === 'error') {
      return null;
    }

    return (
      <HelperText
        visible={true}
        style={{
          color: colors.dark,
          fontStyle: 'italic',
          marginVertical: 5,
        }}>
        {<Text style={{fontStyle: 'italic'}}>{`* `}</Text>}
        {
          <Text style={{fontWeight: 'bold', fontStyle: 'italic'}}>
            {`${deletedInventoryLogVendor?.vendor_display_name}`}
          </Text>
        }{' '}
        vendor of this item was deleted. You can select a new vendor to update
        if only needed.
      </HelperText>
    );
  };

  const renderReasonsSelection = (status, data, formikProps) => {
    const {
      handleChange,
      handleBlur,
      handleSubmit,
      setFieldValue,
      values,
      errors,
      touched,
      isValid,
      dirty,
      isSubmitting,
      setFieldTouched,
      setFieldError,
    } = formikProps;

    if (editMode && status === 'loading') {
      return <DefaultLoadingScreen />;
    }

    if (editMode && status === 'error') {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    const inventoryLog = getInventoryLogData?.result;
    if (editMode && !inventoryLog) {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    // if edit mode and inventory log is an initial stock operation
    if (editMode && inventoryLog?.operation_id === 1) {
      return (
        <>
          <Text
            style={{
              marginTop: 10,
              marginBottom: 15,
              fontSize: 16,
              fontWeight: 'bold',
            }}>
            {'Select a Reason'}
          </Text>
          <CheckboxSelection
            value={values.operation_id}
            options={getInventoryOperationsData.result
              ?.filter(operation => {
                if (item?.is_finished_product) {
                  // hide operation id 2 (New Purchase if the item is a finished product)
                  return operation.list_item_order !== 0 && operation.id !== 2;
                }

                return operation.list_item_order !== 0;
              })
              .map(operation => {
                return {
                  id: operation.id,
                  name:
                    operation.id === 1
                      ? `Pre-${appDefaults.appDisplayName} Stock`
                      : operation.name,
                  disabled: true,
                };
              })}
            optionLabelKey="name"
            optionValueKey="id"
            onChange={handleChange('operation_id')}
          />
        </>
      );
    }

    return (
      <>
        <Text
          style={{
            marginTop: 10,
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
          }}>
          {'Select a Reason'}
        </Text>
        <CheckboxSelection
          value={values.operation_id}
          options={getInventoryOperationsData.result?.filter(operation => {
            if (item?.is_finished_product) {
              // hide operation id 2 (New Purchase if the item is a finished product)
              return operation.list_item_order !== 0 && operation.id !== 2;
            }

            return operation.list_item_order !== 0;
          })}
          optionLabelKey="name"
          optionValueKey="id"
          onChange={handleChange('operation_id')}
        />
      </>
    );
  };

  const renderFormError = (touched, errors) => {
    if (errors.adjustment_qty && touched.adjustment_qty) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.adjustment_qty}
        </Text>
      );
    }
  };

  if (getItemStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (getInventoryOperationsStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (getItemStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  if (getInventoryOperationsStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  if (!item) return null;

  if (editMode) {
    if (getInventoryLogStatus === 'loading') {
      return <DefaultLoadingScreen />;
    }

    if (getInventoryLogStatus === 'error') {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }
  }

  if (editMode && !inventoryLog) return null;

  let deletedInventoryLogAppliedTax = null;
  let deletedInventoryLogVendor = null;

  if (getInventoryLogStatus === 'loading' || getTaxStatus === 'loading') {
    deletedInventoryLogAppliedTax = null;
  }

  if (getInventoryLogStatus === 'loading' || getVendorStatus === 'loading') {
    deletedInventoryLogVendor = null;
  }

  if (getTaxStatus === 'success') {
    const inventoryLogAppliedTax = getTaxData?.result;

    if (inventoryLog && inventoryLog.ref_tax_id && !inventoryLogAppliedTax) {
      deletedInventoryLogAppliedTax = {
        name: inventoryLog.adjustment_tax_name,
        rate_percentage: inventoryLog.adjustment_tax_rate_percentage,
      };
    }
  }

  if (getVendorStatus === 'success') {
    const inventoryLogVendor = getVendorData?.result;

    if (inventoryLog && inventoryLog.ref_vendor_id && !inventoryLogVendor) {
      deletedInventoryLogVendor = {
        vendor_display_name: inventoryLog.vendor_display_name,
      };
    }
  }

  let adjustmentQty = initialValues.adjustment_qty?.toString() || '';
  let unitCost =
    initialValues.unit_cost?.toString() ||
    item.unit_cost?.toFixed(2).toString() ||
    '';
  let adjustmentUnitCost = unitCost;
  let adjustmentTotalCost = '0';
  let taxIdFormValue = item.tax_id?.toString() || '';
  let vendorIdFormValue = item.preferred_vendor_id?.toString() || '';

  if (editMode && inventoryLog) {
    adjustmentQty = inventoryLog.adjustment_qty.toString();
    // unit cost should be the gross cost and not the net unit cost
    adjustmentUnitCost = inventoryLog.adjustment_unit_cost
      ?.toFixed(2)
      .toString();
    taxIdFormValue = inventoryLog.ref_tax_id?.toString() || '';
    vendorIdFormValue = inventoryLog.ref_vendor_id?.toString() || '';
  }

  if (inventoryLog) {
    adjustmentTotalCost =
      (
        parseFloat(inventoryLog.adjustment_unit_cost) *
        parseFloat(inventoryLog.adjustment_qty)
      ).toString() || '0';
  }

  return (
    <Formik
      initialValues={{
        operation_id: initialValues.operation_id?.toString() || '',
        item_id: item.id?.toString() || '',
        tax_id: taxIdFormValue,
        vendor_id: vendorIdFormValue,
        use_measurement_per_piece:
          initialValues.use_measurement_per_piece || false,
        adjustment_unit_cost: adjustmentUnitCost || '',
        adjustment_qty: adjustmentQty,
        adjustment_total_cost: adjustmentTotalCost,
        cost_input_mode: initialValues.cost_input_mode, // 'total_cost' or 'unit_cost'
        adjustment_date:
          initialValues.adjustment_date?.toString() || datetimeString,
        beginning_inventory_date:
          initialValues.beginning_inventory_date?.toString() || datetimeString,
        official_receipt_number: initialValues.official_receipt_number,
        remarks: initialValues.remarks || '',
      }}
      onSubmit={onSubmit}
      validationSchema={AddStockValidationSchema}>
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
          <>
            {showCalendar && (
              <DateTimePicker
                testID="dateTimePicker"
                value={date}
                mode={dateTimePickerMode}
                is24Hour={true}
                minimumDate={fromEndingInventory ? minimumDate : null}
                maximumDate={fromEndingInventory ? maximumDate : null}
                onChange={(_event, selectedDate) => {
                  handleDateTimePickerChange(_event, selectedDate);

                  const month = ('0' + (selectedDate.getMonth() + 1)).slice(-2);
                  const day = ('0' + selectedDate.getDate()).slice(-2);
                  const year = selectedDate.getFullYear();
                  const hours = ('0' + selectedDate.getHours()).slice(-2);
                  const minutes = ('0' + selectedDate.getMinutes()).slice(-2);
                  const seconds = ('0' + selectedDate.getSeconds()).slice(-2);
                  const selectedDateStringFormat = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

                  handleChange('adjustment_date')(selectedDateStringFormat);
                }}
              />
            )}

            {showMonthPicker && (
              <Modal
                transparent
                animationType="fade"
                visible={showMonthPicker}
                onRequestClose={() => {
                  setShowMonthPicker(() => false);
                }}>
                <View style={styles.modalContentContainer}>
                  <View style={styles.modalContent}>
                    <MonthPicker
                      selectedDate={date}
                      onMonthChange={selectedValue => {
                        const selectedDate = new Date(selectedValue);

                        handleMonthChange(selectedDate);

                        const month = (
                          '0' +
                          (selectedDate.getMonth() + 1)
                        ).slice(-2);
                        const day = ('0' + selectedDate.getDate()).slice(-2);
                        const year = selectedDate.getFullYear();
                        const hours = ('0' + selectedDate.getHours()).slice(-2);
                        const minutes = ('0' + selectedDate.getMinutes()).slice(
                          -2,
                        );
                        const seconds = ('0' + selectedDate.getSeconds()).slice(
                          -2,
                        );
                        const selectedDateStringFormat = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

                        handleChange('beginning_inventory_date')(
                          selectedDateStringFormat,
                        );
                      }}
                      currentMonthTextStyle={{
                        color: colors.accent,
                        fontWeight: 'bold',
                      }}
                      selectedBackgroundColor={colors.accent}
                      yearTextStyle={{
                        fontWeight: 'bold',
                        fontSize: 20,
                        color: colors.dark,
                      }}
                    />
                    <Button
                      onPress={() => setShowMonthPicker(() => false)}
                      style={styles.modalConfirmButton}>
                      OK
                    </Button>
                  </View>
                </View>
              </Modal>
            )}

            {renderReasonsSelection(
              getInventoryLogStatus,
              getInventoryLogData,
              props,
            )}
            <Divider style={{marginTop: 10, marginBottom: 25}} />
            <Text
              style={{
                marginBottom: 15,
                fontSize: 16,
                fontWeight: 'bold',
              }}>
              {'Add Stock'}
            </Text>
            <View
              style={{
                marginTop: 5,
                // flexDirection: 'row',
                // alignItems: 'center',
                backgroundColor: colors.surface,
              }}>
              <MoreSelectionButton
                label={dateLabel}
                value={dateValue}
                containerStyle={{marginTop: -1}}
                onPress={() => {
                  if (parseInt(initialValues.operation_id) === 1) {
                    setShowMonthPicker(() => true);
                  } else {
                    showDatepicker();
                  }
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
              {fromEndingInventory && (
                <HelperText
                  style={{
                    color: colors.dark,
                    marginVertical: 10,
                    fontStyle: 'italic',
                  }}>
                  {`* You are currently updating your `}
                  <HelperText
                    style={{
                      color: colors.dark,
                      marginVertical: 10,
                      fontStyle: 'italic',
                      fontWeight: 'bold',
                    }}>
                    {`${moment(date).format('MMM YYYY')} Ending Inventory`}
                  </HelperText>
                  {`. Please review all the values, and save the changes once you're done.`}
                </HelperText>
              )}
            </View>
            <View style={{flexDirection: 'row'}}>
              <TextInput
                label="Total Quantity"
                onChangeText={value => {
                  const adjustmentQty = parseFloat(value || 0);

                  if (values.cost_input_mode === 'total_cost') {
                    const totalCost = parseFloat(
                      values?.adjustment_total_cost || 0,
                    );
                    const calculatedUnitCost =
                      totalCost && adjustmentQty
                        ? totalCost / adjustmentQty
                        : 0;

                    setFieldValue(
                      'adjustment_unit_cost',
                      calculatedUnitCost?.toString(),
                    );
                  }

                  if (values.cost_input_mode === 'unit_cost') {
                    const unitCost = parseFloat(
                      values.adjustment_unit_cost || 0,
                    );
                    const calculatedTotalCost = unitCost * adjustmentQty;

                    setFieldValue(
                      'adjustment_total_cost',
                      calculatedTotalCost?.toString(),
                    );
                  }

                  handleChange('adjustment_qty')(value);
                }}
                onBlur={handleBlur('adjustment_qty')}
                value={values.adjustment_qty}
                style={[styles.textInput, {flex: 1}]}
                onFocus={() => {
                  onFocus && onFocus();
                }}
                keyboardType="numeric"
                error={
                  errors.adjustment_qty && touched.adjustment_qty ? true : false
                }
              />
              <QuantityUOMText
                uomAbbrev={
                  values.use_measurement_per_piece
                    ? item?.uom_abbrev_per_piece
                    : item?.uom_abbrev
                }
                quantity={values.adjustment_qty}
                operationType="add"
              />
            </View>
            {renderUseMeasurementPerPieceCheckbox(props)}

            <RadioButton.Group
              onValueChange={newValue => {
                if (newValue === 'total_cost') {
                  setFieldTouched('unit_cost', false);
                } else if (newValue === 'unit_cost') {
                  setFieldTouched('total_cost', false);
                }

                setFieldValue('cost_input_mode', newValue);
              }}
              value={values.cost_input_mode}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={{flexDirection: 'row', flex: 1}}>
                  <TextInput
                    style={[styles.textInput, {flex: 1}]}
                    label="Unit Cost (Including tax)"
                    disabled={
                      values.cost_input_mode === 'total_cost' ? true : false
                    }
                    onChangeText={value => {
                      const unitCost = parseFloat(value || 0);
                      const adjustmentQty = parseFloat(
                        values.adjustment_qty || 0,
                      );
                      const calculatedTotalCost = unitCost * adjustmentQty;

                      setFieldValue(
                        'adjustment_total_cost',
                        calculatedTotalCost?.toString(),
                      );
                      handleChange('adjustment_unit_cost')(value);
                    }}
                    onBlur={handleBlur('adjustment_unit_cost')}
                    onFocus={() => {
                      onFocus && onFocus();
                    }}
                    value={values.adjustment_unit_cost}
                    keyboardType="numeric"
                    error={
                      errors.adjustment_unit_cost &&
                      touched.adjustment_unit_cost
                        ? true
                        : false
                    }
                  />
                  <QuantityUOMText
                    uomAbbrev={
                      values.use_measurement_per_piece
                        ? item?.uom_abbrev_per_piece
                        : item?.uom_abbrev
                    }
                    prefixText={'Per '}
                    disabled={
                      values.cost_input_mode === 'total_cost' ? true : false
                    }
                  />
                </View>
                <RadioButton value="unit_cost" color={colors.primary} />
              </View>

              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={{flexDirection: 'row', flex: 1}}>
                  <TextInput
                    style={[styles.textInput, {flex: 1}]}
                    label="Total Cost (Including tax)"
                    disabled={
                      values.cost_input_mode === 'unit_cost' ? true : false
                    }
                    onChangeText={value => {
                      const totalCost = parseFloat(value || 0);
                      const adjustmentQty = parseFloat(
                        values.adjustment_qty || 0,
                      );
                      const calculatedUnitCost =
                        totalCost && adjustmentQty
                          ? totalCost / adjustmentQty
                          : 0;

                      setFieldValue(
                        'adjustment_unit_cost',
                        calculatedUnitCost?.toString(),
                      );
                      handleChange('adjustment_total_cost')(value);
                    }}
                    onBlur={handleBlur('adjustment_total_cost')}
                    onFocus={() => {
                      onFocus && onFocus();
                    }}
                    value={values.adjustment_total_cost}
                    keyboardType="numeric"
                    error={
                      errors.adjustment_total_cost &&
                      touched.adjustment_total_cost
                        ? true
                        : false
                    }
                  />
                  <QuantityUOMText
                    quantity={values.adjustment_qty}
                    uomAbbrev={
                      values.use_measurement_per_piece
                        ? item?.uom_abbrev_per_piece
                        : item?.uom_abbrev
                    }
                    prefixText={'Total '}
                    concatText={' Cost'}
                    disabled={
                      values.cost_input_mode === 'unit_cost' ? true : false
                    }
                  />
                </View>
                <RadioButton value="total_cost" color={colors.primary} />
              </View>
            </RadioButton.Group>

            <MoreSelectionButton
              placeholder="Select Tax"
              label="Tax"
              containerStyle={{marginTop: -2}}
              renderValueCurrentValue={values.tax_id}
              renderValue={(_value, renderingValueProps) =>
                renderTaxValue(getTaxStatus, getTaxData, renderingValueProps)
              }
              onChangeValue={currentValue => {
                handleTaxChange(currentValue);
                handleChange('tax_id')(currentValue);
              }}
              onPress={() => {
                setFormikActions(() => ({
                  setFieldValue,
                  setFieldTouched,
                  setFieldError,
                }));

                navigation.navigate(routes.itemTax(), {
                  tax_id: values.tax_id,
                  tax_id_field_key: 'tax_id',
                });
              }}
              error={errors.tax_id && touched.tax_id ? true : false}
            />
            {renderDeletedInventoryLogAppliedTax(deletedInventoryLogAppliedTax)}
            {!deletedInventoryLogAppliedTax && renderTaxCalculation(values)}
            <MoreSelectionButton
              placeholder="Select Vendor"
              label="Vendor"
              containerStyle={{marginTop: -1}}
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
                });
              }}
              error={errors.vendor_id && touched.vendor_id ? true : false}
            />
            {renderDeletedInventoryLogVendor(deletedInventoryLogVendor)}
            <TextInput
              label="Official Receipt # (Optional)"
              onChangeText={handleChange('official_receipt_number')}
              onBlur={handleBlur('official_receipt_number')}
              value={values.official_receipt_number}
              onFocus={() => {
                onFocus && onFocus();
              }}
              error={
                errors.official_receipt_number &&
                touched.official_receipt_number
                  ? true
                  : false
              }
            />
            <TextInput
              multiline
              label="Remarks (Optional)"
              onChangeText={handleChange('remarks')}
              onBlur={handleBlur('remarks')}
              value={values.remarks}
              onFocus={() => {
                onFocus && onFocus();
              }}
              error={errors.remarks && touched.remarks ? true : false}
            />
            {renderFormError(touched, errors)}
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={
                (!dirty && !fromEndingInventory) || !isValid || isSubmitting
              }
              loading={isSubmitting}
              style={{marginTop: 20}}>
              Save
            </Button>
            <Button onPress={onCancel} style={{marginTop: 10}}>
              Cancel
            </Button>
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({
  textInput: {},
  modalContentContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 70,
  },
  modalConfirmButton: {
    marginTop: 25,
    margin: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AddStockForm;
