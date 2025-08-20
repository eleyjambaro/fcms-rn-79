import React from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {TouchableRipple, useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const SalesCounterSellingMenuListItem = props => {
  const {
    item,
    isHighlighted,
    isHighlightedUpdating,
    onPressItem,
    onPressItemOnHighlighted,
    onPressItemOptions,
  } = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  const renderPrice = () => {
    if (item.unit_selling_price) {
      return (
        <View
          style={{
            marginLeft: 'auto',
            flexDirection: 'row',
          }}>
          <Text
            style={{
              color: colors.dark,
              fontWeight: '500',
            }}>{`${currencySymbol} ${commaNumber(
            parseFloat(item.unit_selling_price || 0).toFixed(2),
          )}`}</Text>
        </View>
      );
    } else if (item.item_modifier_options_count > 0) {
      return (
        <MaterialIcons name="chevron-right" size={20} color={colors.dark} />
      );
    }
  };

  const renderViewOptionsButton = () => {
    if (!onPressItemOptions) return null;

    return (
      <Pressable
        style={styles.optionButtonContainer}
        onPress={onPressItemOptions}>
        <Ionicons name="chevron-down-circle" size={20} color={colors.dark} />
      </Pressable>
    );
  };

  if (!item) return null;

  let itemNameColor = colors.dark;

  const content = (
    <>
      <View style={styles.wrapper}>
        <Text
          style={[
            {
              fontSize: 14,
              color: itemNameColor,
              marginRight: 10,
              flex: 1,
            },
            isHighlighted && {fontWeight: 'bold'},
          ]}
          numberOfLines={1}>
          {item.name}
        </Text>

        {renderPrice()}
        {renderViewOptionsButton()}
      </View>
    </>
  );

  return (
    <TouchableRipple
      style={[
        styles.container,
        {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
        isHighlighted && {backgroundColor: colors.highlighted},
        isHighlightedUpdating && {
          backgroundColor: colors.highlightedUpdating,
        },
      ]}
      onPress={() => {
        if (isHighlighted) {
          onPressItemOnHighlighted && onPressItemOnHighlighted();
          return;
        }

        onPressItem && onPressItem();
      }}
      rippleColor={colors.primary}>
      {content}
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    width: '100%',
    elevation: 100,
  },
  wrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  optionButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 10,
    paddingVertical: 10,
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

export default SalesCounterSellingMenuListItem;
