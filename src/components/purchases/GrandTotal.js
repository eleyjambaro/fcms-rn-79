import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';

const GrandTotal = props => {
  const {
    label = 'Grand Total',
    value = 0,
    containerStyle,
    labelStyle = {},
    valueStyle = {},
  } = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 12,
          paddingBottom: 12,
          paddingHorizontal: 10,
          backgroundColor: colors.neutralTint5,
        },
        containerStyle,
      ]}>
      <Text
        style={[
          {marginRight: 'auto', fontWeight: 'bold', fontSize: 16},
          labelStyle,
        ]}>
        {label}
      </Text>
      <Text
        style={[
          {
            marginLeft: 'auto',
            fontWeight: 'bold',
            fontSize: 22,
            color: 'black',
          },
          valueStyle,
        ]}>
        {`${currencySymbol} ${commaNumber(value?.toFixed(2))}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({});

export default GrandTotal;
