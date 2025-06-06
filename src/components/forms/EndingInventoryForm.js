import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Divider,
  useTheme,
  ActivityIndicator,
  Subheading,
  HelperText,
} from 'react-native-paper';
import {Formik} from 'formik';
import {useQuery} from '@tanstack/react-query';
import * as Yup from 'yup';
import commaNumber from 'comma-number';

import MoreSelectionButton from '../buttons/MoreSelectionButton';
import useItemFormContext from '../../hooks/useItemFormContext';
import routes from '../../constants/routes';
import CheckboxSelection from './CheckboxSelection';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import {getInventoryOperations} from '../../localDbQueries/operations';
import {getTax} from '../../localDbQueries/taxes';
import * as RootNavigation from '../../../RootNavigation';
import ItemInventorySummary from '../items/ItemInventorySummary';
import ItemStocksHeading from '../items/ItemStocksHeading';
import {ScrollView} from 'react-native-gesture-handler';
import TextWithIconButton from '../buttons/TextWithIconButton';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const EndingInventoryValidationSchema = Yup.object().shape({
  remaining_stock_qty: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
});

const EndingInventoryForm = props => {
  const {item, monthYearDateFilter, onSubmit, onCancel, onDismiss} = props;
  const {colors} = useTheme();
  const [taxId, setTaxId] = useState(item?.item_tax_id || null);
  const {status, data} = useQuery(
    ['operations', {filter: {type: 'add_stock'}}],
    getInventoryOperations,
  );
  const {status: getTaxStatus, data: getTaxData} = useQuery(
    ['tax', {id: item?.item_tax_id}],
    getTax,
    {
      enabled: taxId ? true : false,
    },
  );
  const [confirmEndingInventoryChanges, setConfirmDateChecked] =
    useState(false);
  const defaultOperationId = '1';

  const renderTaxValue = (status, data) => {
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
      return (
        <Subheading style={{color: colors.primary, marginRight: 5}}>
          Something went wrong
        </Subheading>
      );
    }

    if (!data || !data.result) return null;

    return (
      <Subheading style={{color: colors.primary, marginRight: 5}}>
        {`${data.result?.name} (${data.result?.rate_percentage}%)`}
      </Subheading>
    );
  };

  const renderInventorySummary = values => {
    return (
      <>
        <ItemStocksHeading
          item={item}
          date={monthYearDateFilter}
          monthLabelPrefix="Stocks in "
          containerStyle={{backgroundColor: colors.surface, paddingTop: 0}}
          onDismiss={onDismiss}
        />
        <ItemInventorySummary
          values={values}
          item={item}
          monthYearDateFilter={monthYearDateFilter}
          // containerStyle={{marginTop: 15}}
        />
      </>
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

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Formik
        initialValues={{
          remaining_stock_qty:
            item?.selected_month_grand_total_qty?.toString() || '',
        }}
        onSubmit={onSubmit}
        validationSchema={EndingInventoryValidationSchema}>
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

          let isEndingInventoryInvalid = true;

          const previousMonthGrandTotalQty =
            item.previous_month_grand_total_qty || 0;
          const selectedMonthTotalAddedStockQty =
            item.selected_month_total_added_stock_qty || 0;
          const selectedMonthTotalRemovedStockQty =
            item.selected_month_total_removed_stock_qty || 0;

          let updateValuesAddedStock = selectedMonthTotalAddedStockQty;
          let updateValuesRemovedStock = selectedMonthTotalRemovedStockQty;

          let defaultCurrentStockQty =
            previousMonthGrandTotalQty +
            selectedMonthTotalAddedStockQty -
            selectedMonthTotalRemovedStockQty;

          let remainingStockQty = parseFloat(values.remaining_stock_qty || 0);

          let numberOfStocksToAdd = 0;
          let numberOfStocksToRemove = 0;

          if (remainingStockQty > defaultCurrentStockQty) {
            // add stock
            updateValuesAddedStock =
              updateValuesAddedStock +
              (remainingStockQty - defaultCurrentStockQty);

            numberOfStocksToAdd = remainingStockQty - defaultCurrentStockQty;
          } else if (remainingStockQty < defaultCurrentStockQty) {
            // remove stock
            updateValuesRemovedStock =
              updateValuesRemovedStock +
              (defaultCurrentStockQty - remainingStockQty);

            numberOfStocksToRemove = defaultCurrentStockQty - remainingStockQty;
          }

          if (numberOfStocksToAdd > 0) {
            isEndingInventoryInvalid = true;
          } else {
            isEndingInventoryInvalid = false;
          }

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
              {/* <Text
                style={{
                  marginBottom: 15,
                  fontSize: 16,
                  fontWeight: 'bold',
                }}>
                {'Current Stock'}
              </Text> */}
              {renderInventorySummary(values)}
              <TextInput
                style={{marginBottom: -1}}
                label="Ending Inventory (Remaining Stock Quantity)"
                onChangeText={handleChange('remaining_stock_qty')}
                onBlur={handleBlur('remaining_stock_qty')}
                value={values.remaining_stock_qty}
                keyboardType="numeric"
                error={
                  errors.remaining_stock_qty && touched.remaining_stock_qty
                    ? true
                    : false
                }
              />
              {isEndingInventoryInvalid && (
                <View style={{marginTop: 10}}>
                  <HelperText style={{color: colors.dark}}>
                    {`You are trying to update the Ending Inventory of ${
                      item.item_name
                    } that will add ${commaNumber(
                      numberOfStocksToAdd.toFixed(2),
                    )} ${formatUOMAbbrev(item.item_uom_abbrev)} to the stock.`}
                  </HelperText>
                  <HelperText style={{color: colors.dark}}>
                    {`To do this, you should update the item's stock directly by adding quantity as `}
                    <HelperText
                      style={{
                        color: colors.dark,
                        fontWeight: 'bold',
                      }}>{`New Purchase, Inventory Re-count, `}</HelperText>
                    or other add stock inventory operation:
                  </HelperText>
                </View>
              )}
              {dirty &&
                values.remaining_stock_qty !== '' &&
                !isEndingInventoryInvalid && (
                  <>
                    <View style={{marginTop: 10}}>
                      <HelperText style={{color: colors.dark}}>
                        {`This Ending Inventory update will remove ${commaNumber(
                          numberOfStocksToRemove.toFixed(2),
                        )} ${formatUOMAbbrev(item.item_uom_abbrev)} of ${
                          item.item_name
                        } from the inventory as `}
                        <HelperText
                          style={{color: colors.dark, fontWeight: 'bold'}}>
                          Stock Usage
                        </HelperText>
                        <HelperText>.</HelperText>
                      </HelperText>
                    </View>

                    <ConfirmationCheckbox
                      status={confirmEndingInventoryChanges}
                      text="I confirm the ending inventory changes of this item"
                      onPress={() => {
                        setConfirmDateChecked(!confirmEndingInventoryChanges);
                      }}
                    />
                  </>
                )}

              <View style={{marginTop: 20, marginBottom: 15}}>
                {isEndingInventoryInvalid && (
                  <Button
                    mode="outlined"
                    icon="chevron-right"
                    contentStyle={{flexDirection: 'row-reverse'}}
                    onPress={() => {
                      onDismiss && onDismiss();
                      RootNavigation.navigate(routes.manageStock(), {
                        item_id: item.id,
                        adjustment_qty: numberOfStocksToAdd,
                        month_year_date: monthYearDateFilter,
                        operation_id: 2,
                        from_ending_inventory: true,
                      });
                    }}>
                    {`Add ${commaNumber(
                      numberOfStocksToAdd.toFixed(2),
                    )} ${formatUOMAbbrev(item.item_uom_abbrev)} now`}
                  </Button>
                )}
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  disabled={
                    !dirty ||
                    !isValid ||
                    isEndingInventoryInvalid ||
                    !confirmEndingInventoryChanges ||
                    isSubmitting
                  }
                  loading={isSubmitting}
                  style={{marginTop: 10}}>
                  Save
                </Button>
                <Button onPress={onCancel} style={{marginTop: 10}}>
                  Cancel
                </Button>
              </View>
            </>
          );
        }}
      </Formik>
    </ScrollView>
  );
};

const styles = StyleSheet.create({});

export default EndingInventoryForm;
