import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Dropdown} from 'react-native-paper-dropdown';
import {useFormik} from 'formik';
import {useQuery} from '@tanstack/react-query';
import convert from 'convert-units';
import * as Yup from 'yup';

import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import QuantityUOMText from './QuantityUOMText';
import {getItem} from '../../localDbQueries/items';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import TextInputLabel from './TextInputLabel';

const ModifierOptionValidationSchema = Yup.object({
  use_measurement_per_piece: Yup.boolean(),
  option_name: Yup.string().max(
    120,
    'Option name should not be more than 120 characters.',
  ),
  option_selling_price: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  in_option_qty: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Quantity field is required.'),
  in_option_qty_uom_abbrev: Yup.string().required(
    'Option UOM field is required.',
  ),
  remarks: Yup.string().max(
    120,
    'Remarks should not be more than 120 characters.',
  ),
});

const ModifierOptionForm = props => {
  const {
    itemId,
    initialValues = {
      item_id: '',
      tax_id: '',
      use_measurement_per_piece: '',
      option_selling_price: '',
      in_option_qty: '',
      in_option_qty_uom_abbrev: '',
      uom_abbrev_per_piece: '',
      qty_per_piece: '',
      remarks: '',
    },
    onSubmit,
    onCancel,
    onFocus,
    editMode = false,
  } = props;
  const {colors} = useTheme();
  const [showDropDown, setShowDropDown] = useState(false);
  const {status: getItemStatus, data: getItemData} = useQuery(
    ['item', {id: itemId}],
    getItem,
    {
      enabled: itemId ? true : false,
    },
  );
  const item = getItemData?.result;

  const [unit, setUnit] = useState(
    initialValues.in_option_qty_uom_abbrev || item?.uom_abbrev || 'ea',
  );

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

    if (
      (!editMode && item?.uom_abbrev === 'ea' && item?.uom_abbrev_per_piece) ||
      (initialValues.in_option_qty_uom_abbrev === 'ea' &&
        initialValues.uom_abbrev_per_piece)
    ) {
      return (
        <View style={{marginVertical: 10}}>
          <ConfirmationCheckbox
            status={values.use_measurement_per_piece}
            text={`Use item's UOM per Piece (${formatUOMAbbrev(
              editMode
                ? item?.uom_abbrev_per_piece
                : initialValues.uom_abbrev_per_piece,
            )})`}
            containerStyle={{paddingTop: 5, paddingBottom: 5}}
            onPress={() => {
              let uomAbbrevValue;

              if (values.use_measurement_per_piece === false) {
                uomAbbrevValue = values.uom_abbrev_per_piece;
                setUnit(() => uomAbbrevValue);
              } else {
                uomAbbrevValue = initialValues.in_option_qty_uom_abbrev;
                setUnit(() => uomAbbrevValue);
              }

              setFieldTouched('in_option_qty_uom_abbrev', true);
              setFieldValue('in_option_qty_uom_abbrev', uomAbbrevValue);

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
    if (errors.in_option_qty && touched.in_option_qty) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.in_option_qty}
        </Text>
      );
    }
  };

  if (editMode && getItemStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (editMode && getItemStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  if (editMode && !item) return null;

  let taxIdFormValue = item?.tax_id?.toString() || '';

  const formik = useFormik({
    initialValues: {
      item_id: item?.id?.toString() || '',
      tax_id: taxIdFormValue,
      use_measurement_per_piece:
        initialValues.use_measurement_per_piece || false,
      option_selling_price: initialValues.option_selling_price || '',
      in_option_qty: initialValues.in_option_qty?.toString() || '',
      in_option_qty_uom_abbrev:
        initialValues.in_option_qty_uom_abbrev || item?.uom_abbrev || '',
      uom_abbrev_per_piece: initialValues.uom_abbrev_per_piece,
      qty_per_piece: initialValues.qty_per_piece,
      remarks: initialValues.remarks || '',
    },
    validationSchema: ModifierOptionValidationSchema,
    onSubmit,
  });

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
  } = formik;

  return (
    <>
      <TextInput
        style={styles.textInput}
        label={
          <TextInputLabel
            label="Size Option Name (e.g., Regular, Large)"
            required
            error={errors.option_name && touched.option_name ? true : false}
          />
        }
        onChangeText={handleChange('option_name')}
        onBlur={handleBlur('option_name')}
        value={values.option_name}
        error={errors.option_name && touched.option_name ? true : false}
        autoCapitalize="sentences"
      />
      <View style={{flexDirection: 'row'}}>
        <TextInput
          label={
            <TextInputLabel
              label="Size/Quantity"
              required
              error={
                errors.option_selling_price && touched.option_selling_price
                  ? true
                  : false
              }
            />
          }
          onChangeText={handleChange('in_option_qty')}
          onBlur={handleBlur('in_option_qty')}
          value={values.in_option_qty}
          style={[styles.textInput, {flex: 1}]}
          onFocus={() => {
            onFocus && onFocus();
          }}
          keyboardType="numeric"
          error={errors.in_option_qty && touched.in_option_qty ? true : false}
        />
        <QuantityUOMText
          uomAbbrev={
            values.use_measurement_per_piece
              ? item?.uom_abbrev_per_piece
              : item?.uom_abbrev
          }
          quantity={values.in_option_qty}
          operationType="add"
        />
      </View>
      <Dropdown
        label={'Size/Quantity Unit'}
        mode={'flat'}
        visible={showDropDown}
        showDropDown={() => setShowDropDown(true)}
        onDismiss={() => setShowDropDown(false)}
        value={unit}
        hideMenuHeader
        onSelect={value => {
          setUnit(value);
          handleChange('in_option_qty_uom_abbrev')(value);
        }}
        options={unitOptions}
        activeColor={colors.accent}
        dropDownItemSelectedTextStyle={{fontWeight: 'bold'}}
      />
      {renderUseMeasurementPerPieceCheckbox(formik)}
      <View style={{flexDirection: 'row'}}>
        <TextInput
          style={[styles.textInput, {flex: 1}]}
          label={
            <TextInputLabel
              label="Selling Price"
              required
              error={
                errors.option_selling_price && touched.option_selling_price
                  ? true
                  : false
              }
            />
          }
          onChangeText={handleChange('option_selling_price')}
          onBlur={handleBlur('option_selling_price')}
          value={values.option_selling_price}
          keyboardType="numeric"
          error={
            errors.option_selling_price && touched.option_selling_price
              ? true
              : false
          }
        />
        <QuantityUOMText uomAbbrev={values.uom_abbrev} prefixText={'Per '} />
      </View>

      {/* <TextInput
              multiline
              label="Remarks (Optional)"
              onChangeText={handleChange('remarks')}
              onBlur={handleBlur('remarks')}
              value={values.remarks}
              onFocus={() => {
                onFocus && onFocus();
              }}
              error={errors.remarks && touched.remarks ? true : false}
            /> */}
      {renderFormError(touched, errors)}
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

export default ModifierOptionForm;
