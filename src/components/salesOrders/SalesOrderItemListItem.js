import React, {useState, useMemo} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {Divider, TouchableRipple, useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useQuery} from '@tanstack/react-query';

import {
  getItemAvgUnitCost,
  getItemCurrentStockQuantity,
} from '../../localDbQueries/inventoryLogs';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const SalesOrderItemListItem = props => {
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

  const renderOrderQuantity = () => {
    let textValue = `${commaNumber(
      parseFloat(item.order_qty || 0).toFixed(item.order_qty % 1 ? 2 : 0),
    )} ${formatUOMAbbrev(item.uom_abbrev)}`;

    if (item.order_size_name) {
      textValue = `x ${commaNumber(
        parseFloat(item.order_qty || 0).toFixed(item.order_qty % 1 ? 2 : 0),
      )}`;
    }

    return (
      <View
        style={{
          marginTop: 5,
          marginRight: 'auto',
          flexDirection: 'row',
        }}>
        <Text style={{fontSize: 16, fontWeight: '500', marginRight: 5}}>
          {'Order:'}
        </Text>
        <Text style={{fontSize: 16, fontWeight: '500'}}>{textValue}</Text>
      </View>
    );
  };

  const renderFulfillingQuantity = () => {
    if (!saleQty) return null;

    const notYetCompletedOrderQty =
      parseFloat(item?.order_qty || 0) -
      parseFloat(item?.fulfilled_order_qty || 0);

    const isStockQtyExceeded = saleQty > item?.current_stock_qty;
    const isOrderQtyExceeded = saleQty > notYetCompletedOrderQty;

    let errorIcon = null;

    if (!isHighlightedUpdating && isOrderQtyExceeded) {
      errorIcon = (
        <MaterialIcons
          name="error"
          size={16}
          color={colors.error}
          style={{marginRight: 5}}
        />
      );
    }

    const fulfillingValue = isHighlightedUpdating
      ? '...'
      : `${commaNumber(
          parseFloat(saleQty || 0).toFixed(
            item.fulfilled_order_qty % 1 ? 2 : 0,
          ),
        )}`;

    return (
      <View
        style={{
          marginLeft: 20,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        {errorIcon}
        <Text
          style={{
            fontSize: 16,
            color: colors.accent,
            fontWeight: 'bold',
          }}>
          {`+ ${fulfillingValue}`}
        </Text>
      </View>
    );
  };

  const renderCompletedIcon = () => {
    if (
      item?.fulfilled_order_qty > 0 &&
      item?.fulfilled_order_qty >= item?.order_qty
    ) {
      return (
        <View
          style={{
            marginLeft: 'auto',
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

  const renderFulfilledOrderQuantity = () => {
    let fulfilledValue = `${commaNumber(
      parseFloat(item.fulfilled_order_qty || 0).toFixed(
        item.fulfilled_order_qty % 1 ? 2 : 0,
      ),
    )} ${formatUOMAbbrev(item.uom_abbrev)}`;

    if (item.order_size_name) {
      fulfilledValue = `${commaNumber(
        parseFloat(item.fulfilled_order_qty || 0).toFixed(
          item.fulfilled_order_qty % 1 ? 2 : 0,
        ),
      )}`;
    }

    return (
      <View
        style={{
          marginTop: 5,
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Text style={{fontSize: 16, fontWeight: '500', marginRight: 5}}>
          {'Fulfilled:'}
        </Text>
        <Text style={{fontSize: 16, color: colors.accent, fontWeight: 'bold'}}>
          {fulfilledValue}
        </Text>
        {renderFulfillingQuantity()}
        {renderCompletedIcon()}
      </View>
    );
  };

  const __renderUnitSellingPrice = () => {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Text
          style={{
            color: colors.dark,
          }}>{`${currencySymbol} ${commaNumber(
          parseFloat(item?.order_unit_selling_price || 0).toFixed(2),
        )}`}</Text>
        <Text>{` / ${formatUOMAbbrev(item?.uom_abbrev)}`}</Text>
      </View>
    );
  };

  const renderUnitSellingPrice = () => {
    let textContent = (
      <>
        <Text
          style={{
            color: colors.dark,
            fontStyle: 'italic',
          }}>{`@ ${currencySymbol} ${commaNumber(
          parseFloat(item?.order_unit_selling_price || 0).toFixed(2),
        )}`}</Text>
        <Text style={{fontStyle: 'italic'}}>{` / ${formatUOMAbbrev(
          item?.uom_abbrev,
        )}`}</Text>
      </>
    );

    if (item.order_size_name) {
      textContent = (
        <>
          <Text
            style={{
              color: colors.dark,
              fontStyle: 'italic',
            }}>{`@ ${currencySymbol} ${commaNumber(
            parseFloat(item?.order_unit_selling_price || 0).toFixed(2),
          )}`}</Text>
          <Text style={{fontStyle: 'italic'}}>{` each`}</Text>
        </>
      );
    }
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        {textContent}
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
          parseFloat(item?.subtotal_amount || 0).toFixed(2),
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
                fontSize: 15,
                fontWeight: 'bold',
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

        {item.order_size_name && (
          <View style={(styles.wrappedRow, {marginTop: 5, marginBottom: 0})}>
            <Text
              style={[
                {
                  fontSize: 14,
                  color: colors.neutralTint1,
                  marginRight: 10,
                  flex: 1,
                },
                isHighlighted && {fontWeight: 'bold'},
              ]}
              numberOfLines={1}>
              {item.order_size_name}
            </Text>
          </View>
        )}

        {/* Comment out code below to display unit or size selling price */}

        {/* <View style={[styles.wrappedRow, {marginTop: 2}]}>
          {renderUnitSellingPrice()}
        </View> */}

        <Divider
          style={{marginTop: 10, backgroundColor: colors.neutralTint5}}
        />

        <View style={[styles.wrappedRow, {marginTop: 5}]}>
          {renderOrderQuantity()}
          {/* {renderUnitSellingPrice()}
          {renderSubtotal()} */}
        </View>

        <View style={[styles.wrappedRow, {marginTop: 5}]}>
          {renderFulfilledOrderQuantity()}
        </View>
      </View>

      {/* <Pressable
        style={styles.optionButtonContainer}
        onPress={onPressItemOptions}>
        <MaterialIcons name="more-horiz" size={20} color={colors.dark} />
      </Pressable> */}
    </>
  );

  if (isHighlighted) {
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

        onPressItem && onPressItem();
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
    marginBottom: 2,
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

export default SalesOrderItemListItem;
