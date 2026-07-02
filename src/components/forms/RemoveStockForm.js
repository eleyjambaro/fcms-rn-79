import React, {useState, useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Divider,
  HelperText,
  useTheme,
} from 'react-native-paper';
import {Dropdown} from 'react-native-paper-dropdown';
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
import {getItem, setItemNetWeightPerPiece} from '../../localDbQueries/items';
import QuantityUOMText from './QuantityUOMText';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import {
  PIECE_UNIT,
  isNonEaItem,
  nonEaStockUnitOptions,
  pieceNeedsNetWeight,
  toBaseQty,
} from '../../utils/stockMeasurement';

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
  const [unit, setUnit] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [showUnitDropDown, setShowUnitDropDown] = useState(false);

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
            heading={'Remove stock using a different measurements?'}
            text={`Use item's UOM per Piece (${formatUOMAbbrev(
              item?.uom_abbrev_per_piece,
            )})`}
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

  const isNonEa = isNonEaItem(item);
  const effectiveUnit = unit || item.uom_abbrev;
  const unitOptions = isNonEa ? nonEaStockUnitOptions(item) : [];
  const needsNetWeight = isNonEa && pieceNeedsNetWeight(item, effectiveUnit);
  const isPieceEntry = effectiveUnit === PIECE_UNIT;

  const handleFormSubmit = async (values, formikBag) => {
    try {
      // Non-'ea' item: convert the entered qty+unit to the item's base UOM (the
      // number inventory_logs stores). 'ea' items keep the existing per-piece
      // checkbox path (addInventoryLog divides by qty_per_piece).
      let submitValues = values;
      if (isNonEa) {
        if (needsNetWeight) {
          const nw = parseFloat(netWeight);
          if (!(nw > 0)) {
            formikBag.setFieldError(
              'adjustment_qty',
              'Enter the net weight per piece.',
            );
            formikBag.setSubmitting(false);
            return;
          }
          await setItemNetWeightPerPiece({itemId: item.id, qtyPerPiece: nw});
        }
        const baseQty = toBaseQty(
          item,
          values.adjustment_qty,
          effectiveUnit,
          needsNetWeight ? parseFloat(netWeight) || 0 : undefined,
        );
        submitValues = {...values, adjustment_qty: `${baseQty}`};
      }
      await onSubmit(submitValues, formikBag);
    } catch (error) {
      formikBag.setSubmitting(false);
      formikBag.setFieldError(
        'adjustment_qty',
        error?.message || 'Could not save the net weight per piece.',
      );
    }
  };

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
      onSubmit={handleFormSubmit}
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

        const previewBaseQty = toBaseQty(
          item,
          values.adjustment_qty,
          effectiveUnit,
          needsNetWeight ? parseFloat(netWeight) || 0 : undefined,
        );
        const showPreview =
          isPieceEntry &&
          !needsNetWeight &&
          Number.isFinite(previewBaseQty) &&
          previewBaseQty > 0;

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
              {!isPieceEntry ? (
                <QuantityUOMText
                  uomAbbrev={
                    isNonEa
                      ? effectiveUnit
                      : values.use_measurement_per_piece
                      ? item?.uom_abbrev_per_piece
                      : item?.uom_abbrev
                  }
                  quantity={values.adjustment_qty}
                  operationType="remove"
                />
              ) : null}
            </View>
            {isNonEa ? (
              <Dropdown
                label={'Unit'}
                mode={'flat'}
                visible={showUnitDropDown}
                showDropDown={() => setShowUnitDropDown(true)}
                onDismiss={() => setShowUnitDropDown(false)}
                value={effectiveUnit}
                hideMenuHeader
                onSelect={value => setUnit(value)}
                options={unitOptions}
              />
            ) : null}
            {needsNetWeight ? (
              <View style={{marginTop: 10}}>
                <TextInput
                  label={`Item net weight — ${formatUOMAbbrev(
                    item.uom_abbrev,
                  )} per piece`}
                  value={netWeight}
                  onChangeText={setNetWeight}
                  keyboardType="numeric"
                  placeholder="e.g. 155"
                />
                <HelperText type="info" visible={true}>
                  Saved on the item so you can measure it by the piece from now
                  on.
                </HelperText>
              </View>
            ) : showPreview ? (
              <Text style={{marginTop: 8, color: colors.backdrop}}>
                {`= ${previewBaseQty} ${formatUOMAbbrev(item.uom_abbrev)}`}
              </Text>
            ) : null}
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
