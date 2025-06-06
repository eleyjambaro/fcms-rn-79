import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {useTheme, Subheading} from 'react-native-paper';
import commaNumber from 'comma-number';
import useCurrencySymbol from '../../../hooks/useCurrencySymbol';
import {formatQtyAndPackage} from '../../../utils/stringHelpers';

const YieldCostCalculation = props => {
  const {values, containerStyle} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  const unitCost = parseFloat(values?.unit_cost || 0);
  const initialStockQty = parseFloat(values?.initial_stock_qty || 0);
  const calculatedTotalCost = unitCost * initialStockQty;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.listItemContainer]}>
        <Text style={{fontSize: 14, color: 'gray', fontWeight: 'bold'}}>
          {`Total Yield to Produce (Quantity):`}
        </Text>
        <View style={styles.valueContainer}>
          <Subheading
            numberOfLines={3}
            style={{
              color: colors.accent,
              marginRight: 5,
              fontWeight: 'bold',
              fontSize: 20,
            }}>
            {`${formatQtyAndPackage(
              initialStockQty,
              values.uom_abbrev || '',
              values.qty_per_piece || '',
              values.uom_abbrev_per_piece || '',
            )?.toLocaleLowerCase()}`}
          </Subheading>
        </View>
      </View>

      <View style={[styles.listItemContainer, {marginTop: 15}]}>
        <Text style={{fontSize: 14, color: 'gray', fontWeight: 'bold'}}>
          {`Cost Per Yield / Unit Cost (Gross):`}
        </Text>
        <View style={styles.valueContainer}>
          <Subheading
            numberOfLines={1}
            style={{
              color: colors.accent,
              marginRight: 5,
              fontWeight: 'bold',
              fontSize: 20,
            }}>
            {`${currencySymbol} ${commaNumber(unitCost.toFixed(2))}`}
          </Subheading>
        </View>
      </View>

      <View style={[styles.listItemContainer, {marginTop: 15}]}>
        <Text style={{fontSize: 14, color: 'gray', fontWeight: 'bold'}}>
          {`Total Cost (Gross):`}
        </Text>
        <View style={styles.valueContainer}>
          <Subheading
            numberOfLines={1}
            style={{
              color: colors.accent,
              marginRight: 5,
              fontWeight: 'bold',
              fontSize: 20,
            }}>
            {`${currencySymbol} ${commaNumber(calculatedTotalCost.toFixed(2))}`}
          </Subheading>
        </View>
      </View>
    </View>
  );
};

export default YieldCostCalculation;

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'gray',
    borderTopColor: 'gray',
    borderBottomColor: 'gray',
    paddingTop: 20,
    paddingLeft: 10,
    paddingRight: 10,
    paddingBottom: 20,
  },
  listItemContainer: {},
  label: {
    fontSize: 14,
    color: 'gray',
    fontWeight: 'bold',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginLeft: 10,
  },
});
