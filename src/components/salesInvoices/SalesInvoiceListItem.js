import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  Button,
  Paragraph,
  Dialog,
  Modal,
  Portal,
  TextInput,
  Title,
  useTheme,
  Surface,
  Caption,
  Headline,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import moment from 'moment';

import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {padNumber} from '../../utils/stringHelpers';

const SalesInvoicesListItem = props => {
  const {item, onPress} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  const renderFulfilledSalesOrderGroupId = () => {
    if (item.sales_order_group_id) {
      return (
        <View style={{marginLeft: 10}}>
          <Text
            style={{
              fontWeight: '500',
              color: colors.accent,
            }}>{`Fulfilled Sales Order: SO-${padNumber(
            item.sales_order_group_id,
          )}`}</Text>
        </View>
      );
    }
  };

  const renderPaymentMethodIcon = () => {
    let iconName = 'cash-multiple';

    if (item.cash_payment_total_amount > 0) {
      iconName = 'cash-multiple';
    } else if (item.card_payment_total_amount > 0) {
      iconName = 'credit-card-outline';
    }

    // split payment (cash and card)
    if (
      item.cash_payment_total_amount > 0 &&
      item.card_payment_total_amount > 0
    ) {
      return (
        <View
          style={{
            backgroundColor: colors.neutralTint5,
            padding: 15,
            borderRadius: 50,
          }}>
          <MaterialCommunityIcons
            name={'call-split'}
            size={30}
            color={'black'}
            style={{marginLeft: 'auto'}}
          />
          <MaterialCommunityIcons
            name={'cash-multiple'}
            size={14}
            color={'black'}
            style={{position: 'absolute', top: 30, left: 12}}
          />
          <MaterialCommunityIcons
            name={'credit-card-outline'}
            size={14}
            color={'black'}
            style={{position: 'absolute', top: 30, right: 12}}
          />
        </View>
      );
    }

    return (
      <View
        style={{
          backgroundColor: colors.neutralTint5,
          padding: 15,
          borderRadius: 50,
        }}>
        <MaterialCommunityIcons
          name={iconName}
          size={30}
          color={'black'}
          style={{marginLeft: 'auto'}}
        />
      </View>
    );
  };

  if (!item) return null;

  const totalAmount = parseFloat(item.total_amount || 0)?.toFixed(2);

  return (
    <Surface
      style={[
        styles.container,
        {
          borderColor: colors.neutralTint4,
        },
      ]}>
      <Pressable onPress={onPress}>
        <View
          style={{
            flex: 1,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          {renderPaymentMethodIcon()}
          <View>
            <Headline
              style={{
                marginLeft: 10,
                color: colors.neutralTint1,
                fontSize: 16,
              }}>{`SI-${padNumber(item.id)}`}</Headline>
            {renderFulfilledSalesOrderGroupId()}
            <Text
              style={{
                fontSize: 18,
                fontWeight: '500',
                color: colors.dark,
                marginLeft: 10,
                marginRight: 10,
              }}
              numberOfLines={1}>
              {moment(item.invoice_date?.split(' ').join('T')).format(
                'MMMM DD, YYYY, hh:mm A',
              )}
            </Text>
            {/* <Text style={{color: colors.dark}}>{item.purchase_number}</Text> */}
          </View>
          <MaterialIcons
            name="chevron-right"
            size={30}
            color={'black'}
            style={{marginLeft: 'auto'}}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 15,
            paddingVertical: 5,
            backgroundColor: colors.neutralTint5,
            borderRadius: 15,
          }}>
          <Text style={{fontWeight: 'bold'}}>Total Amount</Text>
          <Text
            style={{
              marginLeft: 'auto',
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${currencySymbol} ${commaNumber(totalAmount)}`}
          </Text>
        </View>
      </Pressable>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 5,
    paddingVertical: 10,
    paddingHorizontal: 10,
    width: '100%',
    backgroundColor: 'white',
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  qtyContainer: {
    flexDirection: 'row',
    marginLeft: 'auto',
    flex: 1,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  costFrame: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 4,
    marginRight: 5,
    paddingHorizontal: 10,
    height: 38,
    alignItems: 'center',
  },
  costText: {
    fontSize: 14,
    color: 'black',
  },
  col: {
    flex: 1,
  },
  colHeader: {
    flex: 1,
  },
  colHeading: {
    marginBottom: 3,
    textAlign: 'center',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});

export default SalesInvoicesListItem;
