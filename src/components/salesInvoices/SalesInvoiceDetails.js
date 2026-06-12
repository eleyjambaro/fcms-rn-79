import React from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {useTheme, Headline} from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';
import moment from 'moment';
import commaNumber from 'comma-number';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {getInvoiceReceiptNumber} from '../../utils/stringHelpers';

const SalesInvoiceDetails = props => {
  const {containerStyle, salesInvoice, handlePressPrint} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  if (!salesInvoice) return null;

  const cash = parseFloat(salesInvoice.cash_payment_total_amount || 0);
  const card = parseFloat(salesInvoice.card_payment_total_amount || 0);
  const change = parseFloat(salesInvoice.change_total_amount || 0);
  const hasPaymentBreakdown = cash > 0 || card > 0 || change > 0;

  const renderPaymentRow = (label, amount) => (
    <View style={styles.paymentRow}>
      <Text style={[styles.paymentLabel, {color: colors.dark}]}>{label}</Text>
      <Text style={[styles.paymentAmount, {color: colors.dark}]}>
        {`${currencySymbol} ${commaNumber(amount.toFixed(2))}`}
      </Text>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.surface},
        containerStyle,
      ]}>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <View style={{flex: 1}}>
          <Headline style={{color: colors.accent}}>
            {getInvoiceReceiptNumber(salesInvoice)}
          </Headline>
          <Text style={{color: colors.dark}}>
            {moment(salesInvoice.invoice_date.split(' ').join('T')).format(
              'MMMM DD, YYYY, hh:mm A',
            )}
          </Text>
          {salesInvoice.sold_by_name ? (
            <Text style={{color: colors.dark, marginTop: 2}}>
              {`Cashier: ${salesInvoice.sold_by_name}`}
            </Text>
          ) : null}
        </View>
        <Pressable
          style={[
            {
              marginLeft: 'auto',
              padding: 8,
              borderWidth: 1,
              borderColor: colors.dark,
              borderRadius: 5,
            },
          ]}
          onPress={handlePressPrint}>
          <MaterialCommunityIcons
            name="printer-outline"
            size={25}
            color={colors.dark}
          />
        </Pressable>
      </View>

      {hasPaymentBreakdown ? (
        <View
          style={[styles.paymentContainer, {borderColor: colors.neutralTint4}]}>
          <Text style={[styles.paymentHeading, {color: colors.dark}]}>
            Payment
          </Text>
          {cash > 0 ? renderPaymentRow('Cash', cash) : null}
          {card > 0 ? renderPaymentRow('Card', card) : null}
          {change > 0 ? renderPaymentRow('Change', change) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 5,
    padding: 15,
  },
  paymentContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  paymentHeading: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  paymentLabel: {
    fontSize: 14,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SalesInvoiceDetails;
