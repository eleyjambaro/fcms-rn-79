import React, {useState} from 'react';
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
import {Formik} from 'formik';
import {useQuery} from '@tanstack/react-query';
import * as Yup from 'yup';

import routes from '../../constants/routes';
import CheckboxSelection from './CheckboxSelection';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import QuantityUOMText from './QuantityUOMText';
import {getInventoryOperations} from '../../localDbQueries/operations';
import {setItemNetWeightPerPiece} from '../../localDbQueries/items';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import {
  PIECE_UNIT,
  isNonEaItem,
  nonEaStockUnitOptions,
  pieceNeedsNetWeight,
  toBaseQty,
} from '../../utils/stockMeasurement';

const RemoveStockValidationSchema = Yup.object().shape({
  remove_stock_unit_cost: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  remove_stock_qty: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
});

const BatchStockUsageRemoveStockForm = props => {
  const {item, onSubmit, onCancel} = props;
  const {colors} = useTheme();
  const {status, data} = useQuery(
    ['operations', {filter: {type: 'remove_stock'}}],
    getInventoryOperations,
  );
  const defaultOperationId = '1';
  // Unit picker (non-'ea' items): the qty field shows the entered value in the
  // chosen unit, while `remove_stock_qty` holds the base-UOM number (the batch
  // usage commit and the per-base unit cost both use base).
  const [enteredQty, setEnteredQty] = useState(
    item?.remove_stock_qty?.toString() || '',
  );
  const [unit, setUnit] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [showUnitDropDown, setShowUnitDropDown] = useState(false);

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

  const isNonEa = isNonEaItem(item);
  const showUnitPicker = isNonEa;
  const effectiveUnit = unit || item?.uom_abbrev;
  const unitOptions = showUnitPicker ? nonEaStockUnitOptions(item) : [];
  const needsNetWeight =
    showUnitPicker && pieceNeedsNetWeight(item, effectiveUnit);
  const isPieceEntry = effectiveUnit === PIECE_UNIT;

  const handleFormSubmit = async (formValues, formikBag) => {
    try {
      if (needsNetWeight) {
        const nw = parseFloat(netWeight);
        if (!(nw > 0)) {
          formikBag.setFieldError(
            'remove_stock_qty',
            'Enter the net weight per piece.',
          );
          formikBag.setSubmitting(false);
          return;
        }
        await setItemNetWeightPerPiece({itemId: item.id, qtyPerPiece: nw});
      }
      await onSubmit(formValues, formikBag);
    } catch (error) {
      formikBag.setSubmitting(false);
      formikBag.setFieldError(
        'remove_stock_qty',
        error?.message || 'Could not save the net weight per piece.',
      );
    }
  };

  return (
    <Formik
      initialValues={{
        // operation_id: defaultOperationId,
        item_id: item?.id?.toString() || '',
        remove_stock_unit_cost:
          item?.remove_stock_unit_cost?.toString() ||
          item?.unit_cost?.toString() ||
          '',
        remove_stock_qty: item?.remove_stock_qty?.toString() || '',
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
          setFieldValue,
        } = props;

        const applyEnteredQty = (enteredValue, unitOverride, nwOverride) => {
          if (showUnitPicker) setEnteredQty(enteredValue);
          const u = unitOverride ?? effectiveUnit;
          const nw =
            nwOverride ??
            (needsNetWeight ? parseFloat(netWeight) || 0 : undefined);
          const converted = showUnitPicker
            ? toBaseQty(item, enteredValue, u, nw)
            : parseFloat(enteredValue || 0);
          setFieldValue(
            'remove_stock_qty',
            showUnitPicker
              ? Number.isFinite(converted)
                ? String(converted)
                : ''
              : enteredValue,
          );
        };

        const basePreviewQty = showUnitPicker
          ? toBaseQty(
              item,
              enteredQty,
              effectiveUnit,
              needsNetWeight ? parseFloat(netWeight) || 0 : undefined,
            )
          : NaN;
        const showBasePreview =
          showUnitPicker &&
          effectiveUnit !== item?.uom_abbrev &&
          !needsNetWeight &&
          Number.isFinite(basePreviewQty) &&
          basePreviewQty > 0;

        return (
          <>
            {/* <Text
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
              options={data.result}
              optionLabelKey="name"
              optionValueKey="id"
              onChange={handleChange('operation_id')}
            />
            <Divider style={{marginTop: 10, marginBottom: 25}} /> */}
            <Text
              style={{
                marginBottom: 15,
                fontSize: 16,
                fontWeight: 'bold',
              }}>
              {'Remove Stock'}
            </Text>
            <TextInput
              label="Unit Cost"
              onChangeText={handleChange('remove_stock_unit_cost')}
              onBlur={handleBlur('remove_stock_unit_cost')}
              value={values.remove_stock_unit_cost}
              keyboardType="numeric"
              error={
                errors.remove_stock_unit_cost && touched.remove_stock_unit_cost
                  ? true
                  : false
              }
            />
            <View style={{flexDirection: 'row'}}>
              <TextInput
                label="Quantity"
                onChangeText={value => applyEnteredQty(value)}
                onBlur={handleBlur('remove_stock_qty')}
                value={showUnitPicker ? enteredQty : values.remove_stock_qty}
                style={[styles.textInput, {flex: 1}]}
                keyboardType="numeric"
                error={
                  errors.remove_stock_qty && touched.remove_stock_qty
                    ? true
                    : false
                }
              />
              {!(showUnitPicker && effectiveUnit !== item?.uom_abbrev) ? (
                <QuantityUOMText
                  uomAbbrev={item?.uom_abbrev}
                  quantity={
                    showUnitPicker ? enteredQty : values.remove_stock_qty
                  }
                  operationType="remove"
                />
              ) : null}
            </View>
            {showUnitPicker ? (
              <Dropdown
                label={'Unit'}
                mode={'flat'}
                visible={showUnitDropDown}
                showDropDown={() => setShowUnitDropDown(true)}
                onDismiss={() => setShowUnitDropDown(false)}
                value={effectiveUnit}
                hideMenuHeader
                onSelect={value => {
                  setUnit(value);
                  applyEnteredQty(enteredQty, value);
                }}
                options={unitOptions}
              />
            ) : null}
            {needsNetWeight ? (
              <View style={{marginTop: 10}}>
                <TextInput
                  label={`Item net weight — ${formatUOMAbbrev(
                    item?.uom_abbrev,
                  )} per piece`}
                  value={netWeight}
                  onChangeText={value => {
                    setNetWeight(value);
                    applyEnteredQty(
                      enteredQty,
                      effectiveUnit,
                      parseFloat(value) || 0,
                    );
                  }}
                  keyboardType="numeric"
                  placeholder="e.g. 155"
                />
                <HelperText type="info" visible={true}>
                  Saved on the item so you can measure it by the piece from now
                  on.
                </HelperText>
              </View>
            ) : showBasePreview ? (
              <Text style={{marginTop: 8, color: colors.backdrop}}>
                {`= ${basePreviewQty} ${formatUOMAbbrev(item?.uom_abbrev)}`}
              </Text>
            ) : null}
            {errors.remove_stock_qty && touched.remove_stock_qty && (
              <Text style={{color: colors.error, marginTop: 10}}>
                {errors.remove_stock_qty}
              </Text>
            )}
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

export default BatchStockUsageRemoveStockForm;
