import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';

import useCurrencySymbol from '../../hooks/useCurrencySymbol';

/**
 * Compact, visually-distinct summary of an item's Suggested Retail Price (SRP).
 * Shows the net (before-tax) SRP and, emphasized, the tax-inclusive price the
 * customer pays. Used on the Selling Price & Tax editor and surfaced read-only
 * above the Selling Price input on the Size/Quantity Option modal so the user
 * has a reference price while entering a size option's selling price.
 *
 * `srp` is net (VAT-exclusive); `srpWithTax` is inclusive of the effective
 * selling-side sales tax. `salesTaxRate` is only used to label the tax line.
 */
const SrpSummaryCard = ({srp, srpWithTax, salesTaxRate = 0, style}) => {
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const hasTax = parseFloat(salesTaxRate) > 0;

  const money = value => `${currencySymbol} ${commaNumber(Number(value).toFixed(2))}`;

  return (
    <View
      style={[
        styles.card,
        {backgroundColor: colors.highlighted, borderColor: colors.primary},
        style,
      ]}>
      <View style={styles.row}>
        <Text style={[styles.label, {color: colors.neutralTint1}]}>
          SRP (Before Tax)
        </Text>
        <Text style={[styles.value, {color: colors.neutralTint1}]}>
          {money(srp)}
        </Text>
      </View>
      <View style={[styles.divider, {backgroundColor: colors.primary}]} />
      <View style={styles.row}>
        <Text style={[styles.labelStrong, {color: colors.dark}]}>
          {`SRP${hasTax ? ` (With ${commaNumber(salesTaxRate)}% Tax)` : ' (With Tax)'}`}
        </Text>
        <Text style={[styles.valueStrong, {color: colors.dark}]}>
          {money(srpWithTax)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    opacity: 0.3,
    marginVertical: 7,
  },
  labelStrong: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  valueStrong: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SrpSummaryCard;
