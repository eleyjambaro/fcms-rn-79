import React, {useState, useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import DropDown from 'react-native-paper-dropdown';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useQuery} from '@tanstack/react-query';
import convert from 'convert-units';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';

import QuantityUOMText from './QuantityUOMText';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import MoreSelectionButton from '../buttons/MoreSelectionButton';
import {getItem} from '../../localDbQueries/items';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';

const SpoilageItemValidationSchema = Yup.object().shape({
  use_measurement_per_piece: Yup.boolean(),
  in_spoilage_qty: Yup.string().required('Required'),
  in_spoilage_uom_abbrev: Yup.string().required('Required'),
  remarks: Yup.string().max(
    120,
    'Remarks should not be more than 120 characters.',
  ),
});

const SpoilageItemForm = props => {
  const {
    initialValues = {
      use_measurement_per_piece: '',
      in_spoilage_qty: '',
      in_spoilage_uom_abbrev: 'kg',
      in_spoilage_date: '',
      remarks: '',
    },
    itemId,
    submitButtonTitle = 'Add',
    onSubmit,
    onCancel,
    selectedDateFilterValue,
    monthYearDateFilter,
    exactDateFilter,
    dateRangeFilterStart,
    dateRangeFilterEnd,
    monthToDateFilterStart,
    monthToDateFilterEnd,
  } = props;
  const {colors} = useTheme();
  const defaultDate = initialValues.in_spoilage_date
    ? new Date(initialValues.in_spoilage_date?.split(' ')?.[0])
    : new Date();
  const [date, setDate] = useState(defaultDate);
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  const year = date.getFullYear();
  const hours = ('0' + date.getHours()).slice(-2);
  const minutes = ('0' + date.getMinutes()).slice(-2);
  const seconds = ('0' + date.getSeconds()).slice(-2);
  const datetimeStringFormat = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  let minimumDate = new Date(year, date.getMonth());
  let maximumDate = new Date(year, date.getMonth() + 1, 0);
  const [datetimeString, setDatetimeString] = useState(datetimeStringFormat);
  const [dateTimePickerMode, setDateTimePickerMode] = useState('date');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDropDown, setShowDropDown] = useState(false);
  const {status: getItemStatus, data: getItemData} = useQuery(
    ['item', {id: itemId}],
    getItem,
    {
      enabled: itemId ? true : false,
    },
  );

  const item = getItemData?.result;

  const [unit, setUnit] = useState(initialValues.in_spoilage_uom_abbrev);

  /** units: [ 'ml', 'l', 'tsp', 'Tbs', 'fl-oz', 'cup', 'pnt', 'qt', 'gal' ] **/
  const units = convert().from(unit).possibilities();

  const unitOptions = units.map(unit => {
    const unitDesc = convert().describe(unit);
    const label = unitDesc.singular === 'Each' ? 'Piece' : unitDesc.singular;
    const value = unit === 'ea' ? 'pc' : unit;

    return {
      label: `${label} (${value})`,
      value: unit,
    };
  });

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
              let uomAbbrevValue;

              if (values.use_measurement_per_piece === false) {
                uomAbbrevValue = item?.uom_abbrev_per_piece;
                setUnit(() => uomAbbrevValue);
              } else {
                uomAbbrevValue = item?.uom_abbrev;
                setUnit(() => uomAbbrevValue);
              }

              setFieldTouched('in_spoilage_uom_abbrev', true);
              setFieldValue('in_spoilage_uom_abbrev', uomAbbrevValue);

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

  if (getItemStatus === 'loading') {
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

  if (!item) return null;

  return (
    <Formik
      initialValues={{
        use_measurement_per_piece:
          initialValues.use_measurement_per_piece ||
          (item?.uom_abbrev === 'ea' &&
          initialValues.in_spoilage_uom_abbrev !== 'ea'
            ? true
            : false) ||
          false,
        in_spoilage_qty: initialValues.in_spoilage_qty?.toString(),
        in_spoilage_uom_abbrev: initialValues.in_spoilage_uom_abbrev || 'kg',
        in_spoilage_date: initialValues.in_spoilage_date || '',
        remarks: initialValues.remarks || '',
      }}
      onSubmit={onSubmit}
      validationSchema={SpoilageItemValidationSchema}>
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
                // minimumDate={minimumDate}
                // maximumDate={maximumDate}
                onChange={(_event, selectedDate) => {
                  handleDateTimePickerChange(_event, selectedDate);

                  const month = ('0' + (selectedDate.getMonth() + 1)).slice(-2);
                  const day = ('0' + selectedDate.getDate()).slice(-2);
                  const year = selectedDate.getFullYear();
                  const hours = ('0' + selectedDate.getHours()).slice(-2);
                  const minutes = ('0' + selectedDate.getMinutes()).slice(-2);
                  const seconds = ('0' + selectedDate.getSeconds()).slice(-2);
                  const selectedDateStringFormat = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

                  handleChange('in_spoilage_date')(selectedDateStringFormat);
                }}
              />
            )}
            <MoreSelectionButton
              label="Spoilage Date"
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
            <View style={{flexDirection: 'row'}}>
              <TextInput
                label="Quantity"
                onChangeText={handleChange('in_spoilage_qty')}
                onBlur={handleBlur('in_spoilage_qty')}
                value={values.in_spoilage_qty}
                style={[styles.textInput, {flex: 1}]}
                autoFocus={true}
                keyboardType="numeric"
                error={
                  errors.in_spoilage_qty && touched.in_spoilage_qty
                    ? true
                    : false
                }
              />
              <QuantityUOMText
                uomAbbrev={unit}
                quantity={values.in_spoilage_qty}
                operationType="add"
              />
            </View>
            <DropDown
              label={'Unit'}
              mode={'flat'}
              visible={showDropDown}
              showDropDown={() => setShowDropDown(true)}
              onDismiss={() => setShowDropDown(false)}
              value={unit}
              setValue={value => {
                setUnit(value);
                handleChange('in_spoilage_uom_abbrev')(value);
              }}
              list={unitOptions}
            />
            {renderUseMeasurementPerPieceCheckbox(props)}

            <TextInput
              multiline
              label="Remarks (Optional)"
              onChangeText={handleChange('remarks')}
              onBlur={handleBlur('remarks')}
              value={values.remarks}
              error={errors.remarks && touched.remarks ? true : false}
            />

            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!dirty || !isValid || isSubmitting}
              loading={isSubmitting}
              style={{marginTop: 20}}>
              {submitButtonTitle}
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

export default SpoilageItemForm;
