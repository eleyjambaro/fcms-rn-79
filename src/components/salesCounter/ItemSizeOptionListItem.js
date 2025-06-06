import React from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';

import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const ItemSizeOptionListItem = props => {
  const {item: listItem, containerStyle, isHighlighted, onPressItem} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  if (!listItem) return null;

  return (
    <Pressable
      onPress={() => onPressItem && onPressItem(listItem)}
      style={[
        styles.listItem,
        containerStyle,
        {
          borderColor: isHighlighted ? colors.primary : colors.neutralTint2,
          backgroundColor: isHighlighted ? colors.highlighted : colors.surface,
        },
      ]}>
      <View style={{flex: 1}}>
        <Text
          style={{
            fontSize: 16,
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
          }}>{`${currencySymbol} ${commaNumber(
          parseFloat(listItem.option_selling_price).toFixed(2),
        )}`}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {},
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderRadius: 25,
    marginTop: 10,
  },
});

export default ItemSizeOptionListItem;
