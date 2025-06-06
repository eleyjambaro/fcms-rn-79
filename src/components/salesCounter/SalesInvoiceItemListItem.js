import React, {useState, useMemo} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {TouchableRipple, useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useQuery} from '@tanstack/react-query';

import {
  getItemAvgUnitCost,
  getItemCurrentStockQuantity,
} from '../../localDbQueries/inventoryLogs';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const SalesInvoiceItemListItem = props => {
  const {
    item,
    isHighlighted,
    isHighlightedUpdating,
    onPressItem,
    onPressItemOnHighlighted,
    onPressItemOptions,
    displayMode = 'display-sale-qty',
    saleQty,
    disabled,
  } = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const {status: itemAvgUnitCostStatus, data: itemAvgUnitCostData} = useQuery(
    ['itemAvgUnitCost', {id: item.id}],
    getItemAvgUnitCost,
  );
  const costMarkers = useMemo(
    () => ({
      taxable: 'T',
      taxExempt: 'E',
    }),
    [],
  );

  const renderCostOrQuantity = () => {
    if (displayMode === 'display-sale-qty') {
      if (!saleQty) return null;

      const textValue = isHighlightedUpdating
        ? '...'
        : `${commaNumber(
            parseFloat(saleQty || 0).toFixed(saleQty % 1 ? 2 : 0),
          )} ${formatUOMAbbrev(item.uom_abbrev)}`;

      return (
        <View
          style={{
            marginRight: 'auto',
            flexDirection: 'row',
          }}>
          <Text style={{fontWeight: '500'}}>{textValue}</Text>
        </View>
      );
    }

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

  const renderUnitSellingPrice = () => {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: 'auto',
        }}>
        <Text
          style={{
            color: colors.dark,
          }}>{`@ ${currencySymbol} ${commaNumber(
          parseFloat(item?.unit_selling_price || 0).toFixed(2),
        )}`}</Text>
        <Text>{` / ${formatUOMAbbrev(item?.uom_abbrev)}`}</Text>
      </View>
    );
  };

  const renderSubtotal = () => {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: 'auto',
        }}>
        <Text
          style={{
            color: colors.dark,
          }}>{`${currencySymbol} ${commaNumber(
          parseFloat(item?.saleSubtotal || 0).toFixed(2),
        )}`}</Text>
        <Text style={{marginLeft: 5}}>{`${
          item?.tax_id ? costMarkers.taxable : costMarkers.taxExempt
        }`}</Text>
      </View>
    );
  };

  if (!item) return null;

  if (itemAvgUnitCostStatus === 'loading') {
    return null;
  }

  if (itemAvgUnitCostStatus === 'error') {
    return null;
  }

  const content = (
    <>
      <View style={styles.wrapper}>
        <View style={styles.wrappedRow}>
          <Text
            style={[
              {
                fontSize: 14,
                color: disabled ? colors.disabled : colors.dark,
                marginRight: 10,
                flex: 1,
              },
              isHighlighted && {fontWeight: 'bold'},
            ]}
            numberOfLines={1}>
            {item.name}
          </Text>
        </View>

        <View style={[styles.wrappedRow, {marginTop: 5}]}>
          {renderCostOrQuantity()}
          {renderUnitSellingPrice()}
          {renderSubtotal()}
        </View>
      </View>

      {/* <Pressable
        style={styles.optionButtonContainer}
        onPress={onPressItemOptions}>
        <MaterialIcons name="more-horiz" size={20} color={colors.dark} />
      </Pressable> */}
    </>
  );

  /**
   * Uncomment below if we want to set TouchableRipple
   */
  // if (isHighlighted) {
  //   return (
  //     <TouchableRipple
  //       style={[
  //         styles.container,
  //         {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
  //         isHighlighted && {backgroundColor: colors.highlighted},
  //         isHighlightedUpdating && {
  //           backgroundColor: colors.highlightedUpdating,
  //         },
  //       ]}
  //       onPress={() => {
  //         if (isHighlighted) {
  //           onPressItemOnHighlighted && onPressItemOnHighlighted();
  //           return;
  //         }

  //         onPressItem();
  //       }}
  //       rippleColor={colors.primary}>
  //       {content}
  //     </TouchableRipple>
  //   );
  // }

  if (isHighlighted) {
    return (
      <Pressable
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

          onPressItem();
        }}
        rippleColor={colors.primary}>
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[
        styles.container,
        {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
        isHighlighted && {backgroundColor: colors.highlighted},
      ]}
      onPress={() => {
        if (isHighlighted) {
          onPressItemOnHighlighted && onPressItemOnHighlighted();
          return;
        }

        onPressItem();
      }}>
      {content}
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
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  wrappedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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

export default SalesInvoiceItemListItem;
