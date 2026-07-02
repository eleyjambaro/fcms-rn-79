import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {TextInput, Button, Text, useTheme, HelperText} from 'react-native-paper';
import {Dropdown} from 'react-native-paper-dropdown';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useQuery} from '@tanstack/react-query';
import convert from 'convert-units';
import QuantityUOMText from './QuantityUOMText';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import {getItem, setItemNetWeightPerPiece} from '../../localDbQueries/items';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import {
  PIECE_UNIT,
  isNonEaItem,
  nonEaStockUnitOptions,
  pieceNeedsNetWeight,
  toBaseQty,
} from '../../utils/stockMeasurement';
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
  const [netWeight, setNetWeight] = useState('');
  const {status: getItemStatus, data: getItemData} = useQuery(
    ['item', {id: itemId}],
    getItem,
    {
      enabled: itemId ? true : false,
    },
  );

  const item = getItemData?.result;

  // Empty until the user picks; `effectiveUnit` below falls back to the item's
  // default (which remaps a stored non-'ea' Piece entry back to the sentinel).
  const [unit, setUnit] = useState('');

  const renderUseMeasurementPerPieceCheckbox = formikProps => {
    const {values, setFieldValue, setFieldTouched} = formikProps;

    if (item?.uom_abbrev === 'ea' && item?.uom_abbrev_per_piece) {
      return (
        <View style={{marginVertical: 10}}>
          <ConfirmationCheckbox
            status={values.use_measurement_per_piece}
            heading={'Add ingredient using a different measurement?'}
            text={`Use item's UOM per Piece (${formatUOMAbbrev(
              item?.uom_abbrev_per_piece,
            )})`}
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

  const isNonEa = isNonEaItem(item);
  // A stored non-'ea' Piece entry is recorded with uom 'ea' — remap it back to the
  // Piece sentinel so the dropdown selects it on edit.
  const rawInitialUom = initialValues.in_recipe_uom_abbrev;
  const remappedInitialUom =
    isNonEa && rawInitialUom === 'ea' ? PIECE_UNIT : rawInitialUom;
  const defaultUom = remappedInitialUom || item.uom_abbrev || 'kg';
  // Effective selected unit; falls back to the item's base UOM so the dropdown /
  // conversions never run against an empty or Piece-sentinel anchor.
  const effectiveUnit = unit || defaultUom;

  // Non-'ea' items get the base measure family + a synthetic Piece option; 'ea'
  // items keep their existing per-piece checkbox flow (units are the convertible
  // possibilities of the currently selected unit).
  const safeAnchor =
    effectiveUnit && effectiveUnit !== PIECE_UNIT ? effectiveUnit : item.uom_abbrev;
  const unitOptions = isNonEa
    ? nonEaStockUnitOptions(item)
    : convert()
        .from(safeAnchor)
        .possibilities()
        ?.filter(u => u !== 'dz')
        .map(u => {
          const unitDesc = convert().describe(u);
          const label = unitDesc.singular === 'Each' ? 'Piece' : unitDesc.singular;
          const value = u === 'ea' ? 'pc' : u;
          return {label: `${label} (${value})`, value: u};
        });

  const needsNetWeight = pieceNeedsNetWeight(item, effectiveUnit);
  const isPieceEntry = effectiveUnit === PIECE_UNIT;

  const handleFormSubmit = async (values, formikBag) => {
    try {
      // Persist the net weight per piece (non-'ea' Piece entry, first time) so the
      // conversion is saved on the item and reusable — createRecipeIngredient then
      // re-reads the item with qty_per_piece set.
      if (pieceNeedsNetWeight(item, values.in_recipe_uom_abbrev)) {
        const nw = parseFloat(netWeight);
        if (!(nw > 0)) {
          formikBag.setFieldError(
            'in_recipe_uom_abbrev',
            'Enter the net weight per piece.',
          );
          formikBag.setSubmitting(false);
          return;
        }
        await setItemNetWeightPerPiece({itemId: item.id, qtyPerPiece: nw});
      }
      await onSubmit(values, formikBag);
    } catch (error) {
      formikBag.setSubmitting(false);
      formikBag.setFieldError(
        'in_recipe_uom_abbrev',
        error?.message || 'Could not save the net weight per piece.',
      );
    }
  };

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
        in_recipe_uom_abbrev: defaultUom,
      }}
      onSubmit={handleFormSubmit}
      validationSchema={IngredientUnitAndQuantityValidationSchema}>
      {formikProps => {
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
        } = formikProps;

        const previewBaseQty = toBaseQty(
          item,
          values.in_recipe_qty,
          values.in_recipe_uom_abbrev,
          needsNetWeight ? parseFloat(netWeight) || 0 : undefined,
        );
        const showPreview =
          isPieceEntry &&
          !needsNetWeight &&
          Number.isFinite(previewBaseQty) &&
          previewBaseQty > 0;

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
              {!isPieceEntry ? (
                <QuantityUOMText
                  uomAbbrev={values.in_recipe_uom_abbrev}
                  quantity={values.in_recipe_qty}
                  operationType="add"
                />
              ) : null}
            </View>
            <Dropdown
              label={'Unit'}
              mode={'flat'}
              visible={showDropDown}
              showDropDown={() => setShowDropDown(true)}
              onDismiss={() => setShowDropDown(false)}
              value={values.in_recipe_uom_abbrev}
              hideMenuHeader
              onSelect={value => {
                setUnit(value);
                handleChange('in_recipe_uom_abbrev')(value);
              }}
              options={unitOptions}
              activeColor={colors.accent}
              dropDownItemSelectedTextStyle={{fontWeight: 'bold'}}
            />

            {needsNetWeight ? (
              <View style={{marginTop: 10}}>
                <TextInput
                  label={`Item net weight — ${formatUOMAbbrev(
                    item.uom_abbrev,
                  )} per piece`}
                  value={netWeight}
                  onChangeText={setNetWeight}
                  keyboardType="numeric"
                  style={styles.textInput}
                  placeholder="e.g. 155"
                />
                <HelperText type="info" visible={true}>
                  Saved on the item so you can measure it by the piece from now on.
                </HelperText>
              </View>
            ) : showPreview ? (
              <Text style={{marginTop: 8, color: colors.backdrop}}>
                {`= ${previewBaseQty} ${formatUOMAbbrev(item.uom_abbrev)}`}
              </Text>
            ) : null}

            {renderUseMeasurementPerPieceCheckbox(formikProps)}

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
