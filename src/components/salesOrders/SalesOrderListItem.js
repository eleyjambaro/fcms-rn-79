import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
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
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import moment from 'moment';
import {padNumber} from '../../utils/stringHelpers';

const SalesOrderListItem = props => {
  const {item, onPress} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  const renderCompletedIcon = () => {
    if (item?.sales_status === 'completed') {
      return (
        <View
          style={{
            marginLeft: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <MaterialCommunityIcons
            name={'check-circle'}
            size={16}
            color={colors.accent}
          />
          <Text
            style={{
              marginLeft: 5,
              fontSize: 14,
              fontWeight: 'bold',
              color: colors.accent,
            }}>{`Completed`}</Text>
        </View>
      );
    }
  };

  if (!item) return null;

  const orderTotalAmount = parseFloat(item.order_total_amount || 0)?.toFixed(2);
  const fulfilledOrderTotalAmount = parseFloat(
    item.fulfilled_order_total_amount || 0,
  )?.toFixed(2);

  return (
    <Surface style={[styles.container, {borderColor: colors.neutralTint4}]}>
      <Pressable onPress={onPress}>
        <View
          style={{
            flex: 1,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <View>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Headline
                style={{
                  marginLeft: 10,
                  color: colors.neutralTint1,
                  fontSize: 16,
                }}>{`SO-${padNumber(item.sales_order_group_id)}`}</Headline>
              {renderCompletedIcon()}
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '500',
                color: colors.dark,
                marginLeft: 10,
                marginRight: 10,
              }}
              numberOfLines={1}>
              {moment(item.order_date?.split(' ').join('T')).format(
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
          <Text style={{fontWeight: 'bold'}}>Order Total Amount</Text>
          <Text
            style={{
              marginLeft: 'auto',
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${currencySymbol} ${commaNumber(orderTotalAmount)}`}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            marginTop: 5,
            paddingHorizontal: 15,
            paddingVertical: 5,
            backgroundColor: colors.neutralTint5,
            borderRadius: 15,
          }}>
          <Text style={{fontWeight: 'bold'}}>Fulfilled Total Amount</Text>
          <Text
            style={{
              marginLeft: 'auto',
              fontWeight: 'bold',
              color: colors.accent,
            }}>
            {`${currencySymbol} ${commaNumber(fulfilledOrderTotalAmount)}`}
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

export default SalesOrderListItem;
