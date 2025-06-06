import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useQuery} from '@tanstack/react-query';

import {
  getItemAvgUnitCost,
  getItemCurrentStockQuantity,
} from '../../localDbQueries/inventoryLogs';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const ItemListItem = props => {
  const {
    item,
    onPressItem,
    onPressItemOptions,
    displayMode = 'display-cost',
  } = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const {status: itemAvgUnitCostStatus, data: itemAvgUnitCostData} = useQuery(
    ['itemAvgUnitCost', {id: item.id}],
    getItemAvgUnitCost,
  );

  const renderCostOrQuantity = () => {
    if (displayMode === 'display-cost') {
      return (
        <View
          style={{
            marginLeft: 'auto',
            flexDirection: 'row',
          }}>
          <Text>{`${currencySymbol} ${commaNumber(
            parseFloat(itemAvgUnitCostData.result || 0).toFixed(2),
          )} / ${formatUOMAbbrev(item.uom_abbrev)}`}</Text>
        </View>
      );
    }

    if (displayMode === 'display-quantity') {
      return (
        <View
          style={{
            marginLeft: 'auto',
            flexDirection: 'row',
          }}>
          <Text>{`${commaNumber(
            parseFloat(item.current_stock_qty || 0).toFixed(2),
          )} ${formatUOMAbbrev(item.uom_abbrev)}`}</Text>
        </View>
      );
    }
  };

  if (!item) return null;

  if (itemAvgUnitCostStatus === 'loading') {
    return null;
  }

  if (itemAvgUnitCostStatus === 'error') {
    return null;
  }

  return (
    <Pressable
      style={[
        styles.container,
        {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
      ]}
      onPress={onPressItem}>
      <View style={styles.wrapper}>
        <Text
          style={{
            fontSize: 14,
            color: colors.dark,
            marginRight: 10,
            flex: 1,
          }}
          numberOfLines={1}>
          {item.name}
        </Text>

        {renderCostOrQuantity()}
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
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 15,
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

export default ItemListItem;
