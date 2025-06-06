import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import commaNumber from 'comma-number';

import useCurrencySymbol from '../../../hooks/useCurrencySymbol';
import {useTheme} from 'react-native-paper';

const CashPaymentTotals = props => {
  const {totalAmountDue = 0, changeAmount = 0, containerStyle} = props;
  const currencySymbol = useCurrencySymbol();
  const {colors} = useTheme();

  return (
    <View style={[{alignItems: 'center'}, containerStyle]}>
      <View style={{alignItems: 'center'}}>
        <Text style={[styles.labelText]}>Total amount due:</Text>
        <Text style={[styles.totalAmountDueText, {color: colors.dark}]}>
          {`${currencySymbol} ${commaNumber(
            (parseFloat(totalAmountDue) || 0)?.toFixed(2),
          )}`}
        </Text>
      </View>

      <View style={{alignItems: 'center', marginTop: 15}}>
        <Text style={[styles.labelText]}>Change:</Text>
        <Text
          style={[styles.changeAmountText]}>{`${currencySymbol} ${commaNumber(
          (parseFloat(changeAmount) || 0)?.toFixed(2),
        )}`}</Text>
      </View>
    </View>
  );
};

export default CashPaymentTotals;

const styles = StyleSheet.create({
  labelText: {
    fontSize: 16,
  },
  totalAmountDueText: {
    fontSize: 34,
    fontWeight: '600',
  },
  changeAmountText: {
    fontSize: 25,
  },
});
