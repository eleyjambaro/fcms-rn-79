import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
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
} from 'react-native-paper';
import commaNumber from 'comma-number';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';

const StockUsageHistoryListItem = props => {
  const {item, onPress} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  if (!item) return null;

  const totalCost = item.total_cost;

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
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: colors.dark,
                marginRight: 10,
              }}
              numberOfLines={1}>
              {item.date_confirmed?.split(' ')[0]}
            </Text>
            {/* <Text style={{color: colors.dark}}>{item.stock_usage_number}</Text> */}
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
            paddingHorizontal: 10,
            paddingVertical: 5,
            backgroundColor: colors.neutralTint5,
          }}>
          <Text style={{fontWeight: 'bold'}}>Total Cost</Text>
          <Text
            style={{
              marginLeft: 'auto',
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${currencySymbol} ${commaNumber(totalCost)}`}
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

export default StockUsageHistoryListItem;
