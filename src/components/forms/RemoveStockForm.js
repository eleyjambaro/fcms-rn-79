import React, {useState, useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {TextInput, Button, Text, Divider, useTheme} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {Formik} from 'formik';
import {useQuery} from '@tanstack/react-query';
import * as Yup from 'yup';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';

import routes from '../../constants/routes';
import CheckboxSelection from './CheckboxSelection';
import MoreSelectionButton from '../../components/buttons/MoreSelectionButton';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import {getInventoryOperations} from '../../localDbQueries/operations';
import {getItem} from '../../localDbQueries/items';
import QuantityUOMText from './QuantityUOMText';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const RemoveStockValidationSchema = Yup.object().shape({
  operation_id: Yup.string().required('Operation is required.'),
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

const RemoveStockForm = props => {
  const {
    itemId,
    initialValues = {
      operation_id: '',
      item_id: '',
      tax_id: '',
      use_measurement_per_piece: '',
      adjustment_unit_cost: '',
      adjustment_qty: '',
      adjustment_date: '',
      remarks: '',
    },
    onSubmit,
    onCancel,
    onFocus,
    editMode = false,
  } = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const {
    status: getInventoryOperationsStatus,
    data: getInventoryOperationsData,
  } = useQuery(
    ['operations', {filter: {type: 'remove_stock'}}],
    getInventoryOperations,
  );
  const defaultOperationId = '4';
  const defaultDate = initialValues.adjustment_date
    ? new Date(initialValues.adjustment_date?.split(' ')?.[0])
    : new Date();
  const [date, setDate] = useState(defaultDate);
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

  const {status: getItemStatus, data: getItemData} = useQuery(
    ['item', {id: itemId}],
    getItem,
    {
      enabled: itemId ? true : false,
    },
  );
  const item = getItemData?.result;

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

    if (item?.uom_abbrev === 'ea' && item?.uom_abbrev_per_piece) {
      return (
        <View style={{marginVertical: 10}}>
          <ConfirmationCheckbox
            status={values.use_measurement_per_piece}
            text={`Use item's UOM per Piece (${formatUOMAbbrev(
              item?.uom_abbrev_per_piece,
            )})`}
            containerStyle={{paddingTop: 5, paddingBottom: 5}}
            onPress={() => {
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

  const renderFormError = (touched, errors) => {
    if (errors.adjustment_qty && touched.adjustment_qty) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.adjustment_qty}
        </Text>
      );
    }
  };

  if (
    getItemStatus === 'loading' ||
    getInventoryOperationsStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (getItemStatus === 'error' || getInventoryOperationsStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  if (!item) return null;

  return (
    <Formik
      initialValues={{
        operation_id: initialValues.operation_id?.toString() || '',
        item_id: item.id?.toString() || '',
        use_measurement_per_piece:
          initialValues.use_measurement_per_piece || false,
        adjustment_unit_cost:
          item.avg_unit_cost_net?.toFixed(2).toString() || '',
        adjustment_qty: initialValues.adjustment_qty?.toString() || '',
        adjustment_date:
          initialValues.adjustment_date?.toString() || datetimeString,
        remarks: initialValues.remarks || '',
      }}
      onSubmit={onSubmit}
      validationSchema={RemoveStockValidationSchema}>
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
        } = props;

        return (
          <>
            {showCalendar && (
              <DateTimePicker
                testID="dateTimePicker"
                value={date}
                mode={dateTimePickerMode}
                is24Hour={true}
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
              options={getInventoryOperationsData.result?.filter(
                operation => operation.list_item_order !== 0,
              )}
              optionLabelKey="name"
              optionValueKey="id"
              onChange={handleChange('operation_id')}
            />
            <Divider style={{marginTop: 10, marginBottom: 25}} />
            <Text
              style={{
                marginBottom: 15,
                fontSize: 16,
                fontWeight: 'bold',
              }}>
              {'Remove Stock'}
            </Text>
            <View
              style={{
                marginTop: 5,
                // flexDirection: 'row',
                // alignItems: 'center',
                backgroundColor: colors.surface,
              }}>
              <MoreSelectionButton
                label="Removed Date"
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
            <View style={{flexDirection: 'row'}}>
              <TextInput
                label="Quantity"
                onChangeText={handleChange('adjustment_qty')}
                onBlur={handleBlur('adjustment_qty')}
                value={values.adjustment_qty}
                style={[styles.textInput, {flex: 1}]}
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
                operationType="remove"
              />
            </View>
            {renderUseMeasurementPerPieceCheckbox(props)}
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
            {/* {values.operation_id === defaultOperationId && (
              <Button
                mode="contained"
                icon="text-box-minus-outline"
                color={colors.surface}
                onPress={() => {}}
                style={{marginTop: 20}}>
                {`Add to Stock Usage List (2)`}
              </Button>
            )} */}
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!dirty || !isValid || isSubmitting}
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

const styles = StyleSheet.create({});

export default RemoveStockForm;
