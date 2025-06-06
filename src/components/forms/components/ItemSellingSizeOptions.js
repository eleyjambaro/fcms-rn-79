import {StyleSheet, Text, View, Pressable} from 'react-native';
import React from 'react';
import commaNumber from 'comma-number';
import {useTheme} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import useCurrencySymbol from '../../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../../utils/stringHelpers';

const ItemSellingSizeOptions = props => {
  const {
    containerStyle,
    listItems,
    listItemKey,
    onPressItem,
    onPressDeleteListItem,
  } = props;
  const currencySymbol = useCurrencySymbol();
  const {colors} = useTheme();

  if (!listItems?.length) return null;

  const list = listItems.map((listItem, index) => {
    return (
      <Pressable
        onPress={() => onPressItem && onPressItem(listItem, index)}
        key={listItem[listItemKey] || index}
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
          style={styles.deleteOptionButtonContainer}
          onPress={() =>
            onPressDeleteListItem && onPressDeleteListItem(listItem, index)
          }>
          <MaterialCommunityIcons
            name="delete-forever"
            size={25}
            color={colors.dark}
          />
        </Pressable>
      </Pressable>
    );
  });

  return <View style={[styles.container, containerStyle]}>{list}</View>;
};

export default ItemSellingSizeOptions;

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
  deleteOptionButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 5,
  },
});
