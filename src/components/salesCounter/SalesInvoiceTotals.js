import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import useSalesCounterContext from '../../hooks/useSalesCounterContext';

const SalesInvoiceTotals = props => {
  const {
    label = 'Grand Total',
    value = 0,
    containerStyle,
    labelStyle = {},
    valueStyle = {},
  } = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const [{saleTotals, isLocalStateUpdating}, actions] =
    useSalesCounterContext();

  const costMarkers = useMemo(
    () => ({
      taxable: 'T',
      taxExempt: 'E',
    }),
    [],
  );

  const taxValuesFontSize = 12;

  return (
    <View style={{backgroundColor: colors.surface}}>
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
              fontSize: 24,
              color: 'black',
            },
            valueStyle,
          ]}>
          {`${currencySymbol} ${commaNumber(
            (saleTotals.grandTotalAmount || 0)?.toFixed(2),
          )}`}
        </Text>
      </View>

      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
            paddingTop: 8,
            paddingBottom: 8,
            paddingHorizontal: 10,
            backgroundColor: colors.neutralTint4,
          },
        ]}>
        <Text
          style={[
            {
              marginRight: 'auto',
              fontWeight: 'bold',
              fontSize: taxValuesFontSize,
            },
            labelStyle,
          ]}>
          {`Taxable (${costMarkers.taxable})`}
        </Text>
        <Text
          style={[
            {
              marginLeft: 'auto',
              fontWeight: 'bold',
              fontSize: taxValuesFontSize,
              color: 'black',
            },
            valueStyle,
          ]}>
          {`${currencySymbol} ${commaNumber(
            (saleTotals.totalTaxableNetAmount || 0)?.toFixed(2),
          )}`}
        </Text>
      </View>

      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: 8,
            paddingBottom: 8,
            paddingHorizontal: 10,
            backgroundColor: colors.surface,
          },
        ]}>
        <Text
          style={[
            {
              marginRight: 'auto',
              fontWeight: 'bold',
              fontSize: taxValuesFontSize,
            },
            labelStyle,
          ]}>
          {`Tax-Exempt (${costMarkers.taxExempt})`}
        </Text>
        <Text
          style={[
            {
              marginLeft: 'auto',
              fontWeight: 'bold',
              fontSize: taxValuesFontSize,
              color: 'black',
            },
            valueStyle,
          ]}>
          {`${currencySymbol} ${commaNumber(
            (saleTotals.totalTaxExemptAmount || 0)?.toFixed(2),
          )}`}
        </Text>
      </View>

      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: 8,
            paddingBottom: 8,
            paddingHorizontal: 10,
            backgroundColor: colors.neutralTint4,
          },
        ]}>
        <Text
          style={[
            {
              marginRight: 'auto',
              fontWeight: 'bold',
              fontSize: taxValuesFontSize,
            },
            labelStyle,
          ]}>
          {'Tax'}
        </Text>
        <Text
          style={[
            {
              marginLeft: 'auto',
              fontWeight: 'bold',
              fontSize: taxValuesFontSize,
              color: 'black',
            },
            valueStyle,
          ]}>
          {`${currencySymbol} ${commaNumber(
            (saleTotals.totalTaxAmount || 0)?.toFixed(2),
          )}`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({});

export default SalesInvoiceTotals;
