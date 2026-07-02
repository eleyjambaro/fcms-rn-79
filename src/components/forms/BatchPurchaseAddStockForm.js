import React, {useState, useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Divider,
  HelperText,
  useTheme,
  ActivityIndicator,
  Subheading,
  RadioButton,
} from 'react-native-paper';
import {Formik} from 'formik';
import {useQuery} from '@tanstack/react-query';
import * as Yup from 'yup';

import MoreSelectionButton from '../buttons/MoreSelectionButton';
import useItemFormContext from '../../hooks/useItemFormContext';
import routes from '../../constants/routes';
import CheckboxSelection from './CheckboxSelection';
import TaxCalculation from '../taxes/TaxCalculation';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import {getInventoryOperations} from '../../localDbQueries/operations';
import {getTax, getTaxes} from '../../localDbQueries/taxes';
import {setItemNetWeightPerPiece} from '../../localDbQueries/items';
import * as RootNavigation from '../../../RootNavigation';
import {getVendor} from '../../localDbQueries/vendors';
import QuantityUOMText from './QuantityUOMText';
import {Dropdown} from 'react-native-paper-dropdown';
import UnitOrTotalCostRadioButtonWrapper from './UnitOrTotalCostRadioButtonWrapper';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import {
  PIECE_UNIT,
  isNonEaItem,
  nonEaStockUnitOptions,
  pieceNeedsNetWeight,
  toBaseQty,
} from '../../utils/stockMeasurement';

const AddStockValidationSchema = Yup.object().shape({
  add_stock_unit_cost: Yup.string().required('Required'),
  add_stock_qty: Yup.string().required('Required'),
  add_stock_total_cost: Yup.string().required('Required'),
});

const BatchPurchaseAddStockForm = props => {
  const {item, isListRefetching, onSubmit, onCancel} = props;
  const {colors} = useTheme();
  const [taxId, setTaxId] = useState(
    item?.add_stock_tax_id || item?.item_tax_id || null,
  );
  const [vendorId, setVendorId] = useState(item?.item_vendor_id || null);
  const {status, data} = useQuery(
    ['operations', {filter: {type: 'add_stock'}}],
    getInventoryOperations,
  );
  const {
    status: getTaxStatus,
    data: getTaxData,
    refetch: refetchTax,
    isRefetching: isRefetchingTax,
  } = useQuery(['tax', {id: taxId}], getTax, {
    enabled: taxId ? true : false,
  });

  /**
   * Reset tax id on item value change. Item value changes after list refetching
   */
  useEffect(() => {
    setTaxId(() => {
      return item?.add_stock_tax_id || item?.item_tax_id || null;
    });
  }, [item]);

  const {status: getVendorStatus, data: getVendorData} = useQuery(
    ['vendor', {id: item?.item_vendor_id}],
    getVendor,
    {
      enabled: vendorId ? true : false,
    },
  );
  const {status: getTaxesStatus, data: getTaxesData} = useQuery(
    ['taxes', {}],
    getTaxes,
  );
  const [showDropDown, setShowDropDown] = useState(false);
  // Unit picker (non-'ea' items): the qty field shows the entered value in the
  // chosen unit, while `add_stock_qty` holds the base-UOM number so the cost math
  // (and the batch-purchase commit → inventory_logs) stays correct.
  const [enteredQty, setEnteredQty] = useState(
    item?.add_stock_qty?.toString() || '',
  );
  const [unit, setUnit] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [showUnitDropDown, setShowUnitDropDown] = useState(false);

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
    if (isRefetchingTax) return <DefaultLoadingScreen />;

    const tax = getTaxData?.result;

    return (
      <TaxCalculation
        item={values}
        tax={tax}
        containerStyle={{marginTop: -1}}
      />
    );
  };

  if (status === 'loading' || getTaxesStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error' || getTaxesStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const taxes = getTaxesData?.result;
  const taxSelectionList = taxes?.map(tax => {
    return {
      label: `${tax.name} (${tax.rate_percentage}%)`,
      value: `${tax.id}`,
    };
  });

  taxSelectionList.unshift({
    label: 'None',
    value: '',
  });

  if (isListRefetching) {
    return <DefaultLoadingScreen />;
  }

  let unitCost = item?.add_stock_unit_cost || item?.unit_cost || 0;
  let addStockQty = item?.add_stock_qty || 0;
  let addStockTotalCost = '0';

  if (item) {
    addStockTotalCost =
      (parseFloat(unitCost) * parseFloat(addStockQty)).toString() || '0';
  }

  const isNonEa = isNonEaItem(item);
  // Non-'ea' items get the Quantity + Unit (+ Piece) picker; 'ea' items purchase in
  // pieces (no picker here — batch purchase has no per-piece checkbox).
  const showUnitPicker = isNonEa;
  const effectiveUnit = unit || item?.uom_abbrev;
  const unitOptions = showUnitPicker ? nonEaStockUnitOptions(item) : [];
  const needsNetWeight =
    showUnitPicker && pieceNeedsNetWeight(item, effectiveUnit);
  const isPieceEntry = effectiveUnit === PIECE_UNIT;

  const handleFormSubmit = async (formValues, formikBag) => {
    try {
      // Persist the net weight per piece (non-'ea' Piece entry, first time) before
      // saving. `add_stock_qty` already holds the converted base-UOM quantity.
      if (needsNetWeight) {
        const nw = parseFloat(netWeight);
        if (!(nw > 0)) {
          formikBag.setFieldError(
            'add_stock_qty',
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
        'add_stock_qty',
        error?.message || 'Could not save the net weight per piece.',
      );
    }
  };

  return (
    <>
      <Formik
        initialValues={{
          // operation_id: defaultOperationId,
          item_id: item?.id?.toString() || '',
          tax_id:
            item?.add_stock_tax_id?.toString() ||
            item?.item_tax_id?.toString() ||
            '',
          // vendor_id: item?.item_vendor_id?.toString() || '',
          add_stock_unit_cost: unitCost?.toString() || '',
          add_stock_qty: addStockQty?.toString() || '',
          add_stock_total_cost: addStockTotalCost,
          cost_input_mode: 'unit_cost',
        }}
        onSubmit={handleFormSubmit}
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

          // Convert the entered qty to the item's base UOM, keep the cost totals in
          // sync (unit cost is per base), and store the base number in
          // `add_stock_qty`. For 'ea' (no picker) it behaves like the raw handler.
          const applyEnteredQty = (enteredValue, unitOverride, nwOverride) => {
            if (showUnitPicker) setEnteredQty(enteredValue);
            const u = unitOverride ?? effectiveUnit;
            const nw =
              nwOverride ??
              (needsNetWeight ? parseFloat(netWeight) || 0 : undefined);
            const converted = showUnitPicker
              ? toBaseQty(item, enteredValue, u, nw)
              : parseFloat(enteredValue || 0);
            const baseQty = Number.isFinite(converted) ? converted : 0;

            if (values.cost_input_mode === 'total_cost') {
              const totalCost = parseFloat(values?.add_stock_total_cost || 0);
              const calculatedUnitCost =
                totalCost && baseQty ? totalCost / baseQty : 0;
              setFieldValue(
                'add_stock_unit_cost',
                calculatedUnitCost?.toString(),
              );
            }
            if (values.cost_input_mode === 'unit_cost') {
              const unitCostValue = parseFloat(values.add_stock_unit_cost || 0);
              const calculatedTotalCost = unitCostValue * baseQty;
              setFieldValue(
                'add_stock_total_cost',
                calculatedTotalCost?.toString(),
              );
            }

            setFieldValue(
              'add_stock_qty',
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
                {'Add Stock'}
              </Text>
              <View style={{flexDirection: 'row'}}>
                <TextInput
                  label="Total Quantity"
                  onChangeText={value => applyEnteredQty(value)}
                  onBlur={handleBlur('add_stock_qty')}
                  value={showUnitPicker ? enteredQty : values.add_stock_qty}
                  style={[styles.textInput, {flex: 1, marginBottom: -1}]}
                  keyboardType="numeric"
                  error={
                    errors.add_stock_qty && touched.add_stock_qty ? true : false
                  }
                />
                {!(showUnitPicker && effectiveUnit !== item?.uom_abbrev) ? (
                  <QuantityUOMText
                    uomAbbrev={item?.uom_abbrev}
                    quantity={
                      showUnitPicker ? enteredQty : values.add_stock_qty
                    }
                    operationType="add"
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

              <UnitOrTotalCostRadioButtonWrapper>
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
                          const addStockQty = parseFloat(
                            values.add_stock_qty || 0,
                          );
                          const calculatedTotalCost = unitCost * addStockQty;

                          setFieldValue(
                            'add_stock_total_cost',
                            calculatedTotalCost?.toString(),
                          );
                          handleChange('add_stock_unit_cost')(value);
                        }}
                        onBlur={handleBlur('add_stock_unit_cost')}
                        value={values.add_stock_unit_cost}
                        keyboardType="numeric"
                        error={
                          errors.add_stock_unit_cost &&
                          touched.add_stock_unit_cost
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
                    <View style={{paddingHorizontal: 5}}>
                      <RadioButton value="unit_cost" color={colors.primary} />
                    </View>
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
                          const addStockQty = parseFloat(
                            values.add_stock_qty || 0,
                          );
                          const calculatedUnitCost =
                            totalCost && addStockQty
                              ? totalCost / addStockQty
                              : 0;

                          setFieldValue(
                            'add_stock_unit_cost',
                            calculatedUnitCost?.toString(),
                          );
                          handleChange('add_stock_total_cost')(value);
                        }}
                        onBlur={handleBlur('add_stock_total_cost')}
                        value={values.add_stock_total_cost}
                        keyboardType="numeric"
                        error={
                          errors.add_stock_total_cost &&
                          touched.add_stock_total_cost
                            ? true
                            : false
                        }
                      />
                      <QuantityUOMText
                        quantity={values.add_stock_qty}
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
                    <View style={{paddingHorizontal: 5}}>
                      <RadioButton value="total_cost" color={colors.primary} />
                    </View>
                  </View>
                </RadioButton.Group>
              </UnitOrTotalCostRadioButtonWrapper>

              <Dropdown
                label={'Tax'}
                mode={'flat'}
                visible={showDropDown}
                showDropDown={() => setShowDropDown(true)}
                onDismiss={() => setShowDropDown(false)}
                value={values.tax_id}
                hideMenuHeader
                onSelect={value => {
                  setTaxId(value);
                  refetchTax();
                  handleChange('tax_id')(value);
                }}
                options={taxSelectionList}
                activeColor={colors.accent}
                dropDownItemSelectedTextStyle={{fontWeight: 'bold'}}
                inputProps={{disabled: isListRefetching}}
              />
              {renderTaxCalculation(values)}
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
    </>
  );
};

const styles = StyleSheet.create({
  textInput: {},
});

export default BatchPurchaseAddStockForm;
