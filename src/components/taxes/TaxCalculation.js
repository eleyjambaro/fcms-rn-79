import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {useTheme, Subheading} from 'react-native-paper';
import commaNumber from 'comma-number';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';

const TaxCalculation = props => {
  const {item, tax, containerStyle, taxAmountLabel = 'Tax Amount'} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  if (!item) return null;

  const unitCost = parseFloat(
    item.unit_cost ||
      item.adjustment_unit_cost ||
      item.add_stock_unit_cost ||
      item.remove_stock_unit_cost ||
      0,
  );
  const qty = parseFloat(
    item.initial_stock_qty ||
      item.adjustment_qty ||
      item.add_stock_qty ||
      item.remove_stock_qty ||
      0,
  );
  const taxRatePercentage = parseFloat(tax?.rate_percentage || 0);

  const unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
  const unitCostTax = unitCost - unitCostNet;

  const grossPrice = unitCost * qty;
  const netPrice = grossPrice / (taxRatePercentage / 100 + 1);
  const taxAmount = grossPrice - netPrice;

  return (
    <View
      style={[
        {
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: 'gray',
          borderTopColor: 'gray',
          borderBottomColor: 'gray',
          paddingTop: 15,
          paddingLeft: 10,
          paddingRight: 10,
          paddingBottom: 15,
        },
        containerStyle,
      ]}>
      <View style={styles.listItemContainer}>
        <Text style={{fontSize: 16, color: 'gray'}}>
          {`Total Cost (Tax Inclusive)`}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 'auto',
            marginRight: 3,
          }}>
          <Subheading
            numberOfLines={1}
            style={{color: colors.accent, marginRight: 5}}>
            {`${currencySymbol} ${commaNumber(grossPrice.toFixed(2))}`}
          </Subheading>
        </View>
      </View>

      <View style={styles.listItemContainer}>
        <Text style={{fontSize: 16, color: 'gray'}}>Net Price</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 'auto',
            marginRight: 3,
          }}>
          <Subheading
            numberOfLines={1}
            style={{color: colors.accent, marginRight: 5}}>
            {`${currencySymbol} ${commaNumber(netPrice.toFixed(2))}`}
          </Subheading>
        </View>
      </View>

      <View style={styles.listItemContainer}>
        <Text style={{fontSize: 16, color: 'gray'}}>{taxAmountLabel}</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 'auto',
            marginRight: 3,
          }}>
          <Subheading
            numberOfLines={1}
            style={{color: colors.accent, marginRight: 5}}>
            {`${currencySymbol} ${commaNumber(taxAmount.toFixed(2))}`}
          </Subheading>
        </View>
      </View>
    </View>
  );
};

export default TaxCalculation;

const styles = StyleSheet.create({
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
