import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Dropdown} from 'react-native-paper-dropdown';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useQuery} from '@tanstack/react-query';
import convert from 'convert-units';
import QuantityUOMText from './QuantityUOMText';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import {getItem} from '../../localDbQueries/items';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';

const IngredientUnitAndQuantityValidationSchema = Yup.object().shape({
  use_measurement_per_piece: Yup.boolean(),
  in_recipe_qty: Yup.string().required('Required'),
  in_recipe_uom_abbrev: Yup.string().required('Required'),
});

const IngredientUnitAndQuantityForm = props => {
  const {
    initialValues = {
      use_measurement_per_piece: '',
      in_recipe_qty: '',
      in_recipe_uom_abbrev: '',
    },
    itemId,
    onSubmit,
    onCancel,
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

  const [unit, setUnit] = useState(initialValues.in_recipe_uom_abbrev);

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

              setFieldTouched('in_recipe_uom_abbrev', true);
              setFieldValue('in_recipe_uom_abbrev', uomAbbrevValue);

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
          initialValues.in_recipe_uom_abbrev !== 'ea'
            ? true
            : false) ||
          false,
        in_recipe_qty: initialValues.in_recipe_qty?.toString(),
        in_recipe_uom_abbrev: initialValues.in_recipe_uom_abbrev || 'kg',
      }}
      onSubmit={onSubmit}
      validationSchema={IngredientUnitAndQuantityValidationSchema}>
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
            <View style={{flexDirection: 'row'}}>
              <TextInput
                label="Quantity"
                onChangeText={handleChange('in_recipe_qty')}
                onBlur={handleBlur('in_recipe_qty')}
                value={values.in_recipe_qty}
                style={[styles.textInput, {flex: 1}]}
                autoFocus={true}
                keyboardType="numeric"
                error={
                  errors.in_recipe_qty && touched.in_recipe_qty ? true : false
                }
              />
              <QuantityUOMText
                uomAbbrev={unit}
                quantity={values.in_recipe_qty}
                operationType="add"
              />
            </View>
            <Dropdown
              label={'Unit'}
              mode={'flat'}
              visible={showDropDown}
              showDropDown={() => setShowDropDown(true)}
              onDismiss={() => setShowDropDown(false)}
              value={unit}
              hideMenuHeader
              onSelect={value => {
                setUnit(value);
                handleChange('in_recipe_uom_abbrev')(value);
              }}
              options={unitOptions}
              activeColor={colors.accent}
              dropDownItemSelectedTextStyle={{fontWeight: 'bold'}}
            />
            {renderUseMeasurementPerPieceCheckbox(props)}

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

export default IngredientUnitAndQuantityForm;
