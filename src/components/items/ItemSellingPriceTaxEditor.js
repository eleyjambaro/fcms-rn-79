import React, {useState} from 'react';
import {View, StyleSheet, Pressable} from 'react-native';
import {Button, Text, TextInput, HelperText} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import commaNumber from 'comma-number';

import SectionHeading from '../headings/SectionHeading';
import SrpSummaryCard from './SrpSummaryCard';
import MoreSelectionButton from '../buttons/MoreSelectionButton';
import TextInputLabel from '../forms/TextInputLabel';
import routes from '../../constants/routes';
import useItemFormContext from '../../hooks/useItemFormContext';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {getTax} from '../../localDbQueries/taxes';
import {updateItemSellingPriceAndTax} from '../../localDbQueries/items';
import {
  computeMarkupAmount,
  computeMarkupPercentage,
  computeSrpFromAmount,
  computeSrpWithTax,
} from '../../utils/markupHelpers';

/**
 * Inline editor for an item's selling-side fields — markup %/amount (→ SRP) and
 * the per-item Sales Tax — shown on the Size Options screen (the Edit Item flow
 * navigates here from the "Update Selling Price & Tax" heading). Mirrors the
 * markup + sales-tax UI that used to live in ItemForm, but persists through the
 * focused `updateItemSellingPriceAndTax` so it never clobbers other item fields.
 *
 * The Sales Tax picker reuses the shared ItemTax screen, which writes the chosen
 * tax back via ItemFormContext.formikActions.setFieldValue — so we register a
 * minimal actions object (state setter) before navigating, exactly like ItemForm.
 */
const ItemSellingPriceTaxEditor = ({
  item,
  containerStyle,
  showUnitSellingPrice = false,
}) => {
  const navigation = useNavigation();
  const currencySymbol = useCurrencySymbol();
  const queryClient = useQueryClient();
  const {setFormikActions} = useItemFormContext();

  const [markupPercentage, setMarkupPercentage] = useState(
    item?.markup_percentage != null ? item.markup_percentage.toString() : '0',
  );
  const [markupAmount, setMarkupAmount] = useState(
    item?.markup_amount != null ? item.markup_amount.toString() : '0',
  );
  // '0' represents None (no per-item sales tax → falls back to the cost tax).
  const [salesTaxId, setSalesTaxId] = useState(
    item?.sales_tax_id ? item.sales_tax_id.toString() : '0',
  );
  // Single unit selling price (tax-inclusive / gross), shown only in unit-price
  // mode. Maps to the "SRP (With Tax)" suggestion below.
  const [unitSellingPrice, setUnitSellingPrice] = useState(
    item?.unit_selling_price != null ? item.unit_selling_price.toString() : '0',
  );

  const normalizedSalesTaxId =
    salesTaxId && salesTaxId !== '0' ? salesTaxId : null;

  const {data: salesTaxData} = useQuery(
    ['tax', {id: normalizedSalesTaxId}],
    getTax,
    {enabled: !!normalizedSalesTaxId},
  );

  const updateMutation = useMutation(updateItemSellingPriceAndTax, {
    onSuccess: () => {
      queryClient.invalidateQueries(['item', {id: item?.id}]);
      queryClient.invalidateQueries(['items']);
    },
  });

  const netCostBase = parseFloat(item?.avg_unit_cost_net) || 0;
  const srp = computeSrpFromAmount(netCostBase, markupAmount);
  // Effective selling-side sales tax rate, recomputed live from the current
  // picker selection: the picked tax's rate, or the item's cost tax when None
  // ('0') is selected (mirrors the sales_tax_rate_percentage COALESCE / POS).
  const effectiveSalesTaxRate = normalizedSalesTaxId
    ? parseFloat(salesTaxData?.result?.rate_percentage || 0)
    : parseFloat(item?.tax_rate_percentage || 0);
  const srpWithTax = computeSrpWithTax(srp, effectiveSalesTaxRate);

  const numChanged = (a, b) => parseFloat(a || 0) !== parseFloat(b || 0);
  const isDirty =
    numChanged(item?.markup_percentage, markupPercentage) ||
    numChanged(item?.markup_amount, markupAmount) ||
    (item?.sales_tax_id ? item.sales_tax_id.toString() : '0') !==
      (salesTaxId || '0') ||
    (showUnitSellingPrice &&
      numChanged(item?.unit_selling_price, unitSellingPrice));

  const handleUpdate = async () => {
    try {
      await updateMutation.mutateAsync({
        id: item?.id,
        markup_percentage: markupPercentage,
        markup_amount: markupAmount,
        sales_tax_id: salesTaxId,
        // Only persisted in unit-price mode; omitted otherwise so it isn't
        // clobbered while editing markup/tax for a size-option item.
        ...(showUnitSellingPrice ? {unit_selling_price: unitSellingPrice} : {}),
      });
    } catch (error) {
      console.debug(error);
    }
  };

  const handlePressSalesTax = () => {
    setFormikActions(() => ({
      setFieldValue: (field, value) => {
        if (field === 'sales_tax_id') {
          setSalesTaxId(value);
        }
      },
      setFieldTouched: () => {},
      setFieldError: () => {},
    }));
    navigation.navigate(routes.itemTax(), {
      tax_id: salesTaxId,
      tax_id_field_key: 'sales_tax_id',
    });
  };

  if (!item) return null;

  return (
    <View style={[styles.container, containerStyle]}>
      <SectionHeading headingText="Selling Price & Tax" />

      <HelperText type="info">
        {`Net Unit Cost: ${currencySymbol} ${commaNumber(
          netCostBase.toFixed(2),
        )} (SRP = net cost + markup, and tax)`}
      </HelperText>
      <View style={styles.markupRow}>
        <TextInput
          style={styles.markupInput}
          label={<TextInputLabel label="Markup %" />}
          value={markupPercentage}
          keyboardType="numeric"
          right={<TextInput.Affix text="%" />}
          onChangeText={value => {
            setMarkupPercentage(value);
            setMarkupAmount(computeMarkupAmount(netCostBase, value).toFixed(2));
          }}
        />
        <TextInput
          style={[styles.markupInput, styles.markupInputRight]}
          label={<TextInputLabel label="Markup Amount" />}
          value={markupAmount}
          keyboardType="numeric"
          left={<TextInput.Affix text={currencySymbol} />}
          onChangeText={value => {
            setMarkupAmount(value);
            setMarkupPercentage(
              computeMarkupPercentage(netCostBase, value).toFixed(2),
            );
          }}
        />
      </View>
      <MoreSelectionButton
        placeholder="Select Tax"
        label="Sales Tax"
        renderValueCurrentValue={salesTaxId}
        renderValue={(_value, renderingValueProps) => {
          if (!normalizedSalesTaxId) return null;
          const tax = salesTaxData?.result;
          if (!tax) return null;
          return (
            <Text variant="titleMedium" {...renderingValueProps}>
              {renderingValueProps?.trimTextLength(
                `${tax.name} (${tax.rate_percentage}%)`,
              )}
            </Text>
          );
        }}
        onPress={handlePressSalesTax}
      />

      <SrpSummaryCard
        srp={srp}
        srpWithTax={srpWithTax}
        salesTaxRate={effectiveSalesTaxRate}
        style={styles.srpCard}
      />

      {showUnitSellingPrice && (
        <View style={styles.unitPriceSection}>
          <TextInput
            style={styles.unitPriceInput}
            label={<TextInputLabel label="Unit Selling Price (Including tax)" />}
            value={unitSellingPrice}
            keyboardType="numeric"
            left={<TextInput.Affix text={currencySymbol} />}
            onChangeText={setUnitSellingPrice}
          />
          <Pressable
            onPress={() => setUnitSellingPrice(srpWithTax.toFixed(2))}
            style={styles.suggestionRow}>
            <HelperText type="info" style={styles.suggestionText}>
              {`Tap to use suggested SRP (With Tax): ${currencySymbol} ${commaNumber(
                srpWithTax.toFixed(2),
              )}`}
            </HelperText>
          </Pressable>
        </View>
      )}

      <Button
        mode="contained"
        onPress={handleUpdate}
        disabled={!isDirty || updateMutation.isLoading}
        loading={updateMutation.isLoading}
        style={styles.updateButton}>
        Update
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  // No container horizontal padding: SectionHeading, MoreSelectionButton and
  // paper's HelperText each bring their own (~11–12px) inset; only the bare
  // markup inputs and the Update button need to be inset to match them.
  container: {
    paddingBottom: 6,
  },
  markupRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  markupInput: {
    flex: 1,
  },
  markupInputRight: {
    marginLeft: 10,
  },
  srpCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  unitPriceSection: {
    marginTop: 12,
    paddingHorizontal: 12,
  },
  unitPriceInput: {},
  suggestionRow: {
    alignSelf: 'flex-start',
  },
  suggestionText: {
    textDecorationLine: 'underline',
  },
  updateButton: {
    marginTop: 16,
    marginBottom: 10,
    marginHorizontal: 12,
  },
});

export default ItemSellingPriceTaxEditor;
