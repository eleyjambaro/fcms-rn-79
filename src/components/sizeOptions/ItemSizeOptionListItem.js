import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const ItemSizeOptionListItem = props => {
  const {item: listItem, onPressItem, onPressItemOptions} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  if (!listItem) return null;

  return (
    <Pressable
      onPress={() => onPressItem && onPressItem(listItem)}
      style={[styles.listItem, {borderColor: colors.neutralTint2}]}>
      <View style={{flex: 1}}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: 'bold',
            color: colors.dark,
            marginRight: 10,
            flex: 1,
          }}
          numberOfLines={1}>
          {listItem.option_name}
        </Text>

        <Text style={{fontWeight: 'bold'}}>{`${
          listItem.in_option_qty
        } ${formatUOMAbbrev(listItem.in_option_qty_uom_abbrev)}`}</Text>
      </View>

      <View>
        <Text
          style={{
            fontWeight: '500',
            fontSize: 16,
            marginRight: 10,
          }}>{`${currencySymbol} ${commaNumber(
          parseFloat(listItem.option_selling_price).toFixed(2),
        )}`}</Text>
      </View>

      <Pressable
        style={styles.optionButtonContainer}
        onPress={onPressItemOptions}>
        <MaterialIcons name="more-horiz" size={20} color={colors.dark} />
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {},
  listItem: {
    flexDirection: 'row',
    marginTop: -1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingLeft: 15,
    paddingRight: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  optionButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 5,
  },
});

export default ItemSizeOptionListItem;
