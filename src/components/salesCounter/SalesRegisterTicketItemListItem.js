import React, {useState, useMemo} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';

import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const SalesRegisterTicketItemListItem = props => {
  const {
    item,
    isHighlighted,
    isHighlightedUpdating,
    onPressItem,
    onPressItemOnHighlighted,
    saleQty,
    disabled,
  } = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  const costMarkers = useMemo(
    () => ({
      taxable: 'T',
      taxExempt: 'E',
    }),
    [],
  );

  const renderSaleQuantity = () => {
    if (!saleQty) return null;

    let textValue = isHighlightedUpdating
      ? '...'
      : `${commaNumber(
          parseFloat(saleQty || 0).toFixed(saleQty % 1 ? 2 : 0),
        )} ${formatUOMAbbrev(item.uom_abbrev)}`;

    // for item with selected size option
    if (item.option_name) {
      textValue = isHighlightedUpdating
        ? '...'
        : `x ${commaNumber(
            parseFloat(saleQty || 0).toFixed(saleQty % 1 ? 2 : 0),
          )}`;
    }

    // for sales order
    if (item.order_size_name) {
      textValue = isHighlightedUpdating
        ? '...'
        : `x ${commaNumber(
            parseFloat(saleQty || 0).toFixed(saleQty % 1 ? 2 : 0),
          )}`;
    }

    return (
      <View
        style={{
          marginRight: 'auto',
          flexDirection: 'row',
        }}>
        <Text style={{fontWeight: 'bold'}}>{textValue}</Text>
      </View>
    );
  };

  const renderUnitSellingPrice = () => {
    // Pick the unit price to display:
    // - Sales-order fulfillment lines carry the price quoted at order time on
    //   order_unit_selling_price. The item's base unit_selling_price is often 0
    //   for size-priced items, so using it here renders "@ 0.00" (the Review
    //   Sales fulfilling-order bug). Mirrors the subtotal computed in
    //   updateSaleItemFromSalesOrder, which also uses order_unit_selling_price.
    // - Regular size-option lines use option_selling_price.
    // - Everything else uses the item's base unit_selling_price.
    const isSalesOrderLine = item?.order_unit_selling_price != null;
    let unitSellingPrice = item?.unit_selling_price;

    if (isSalesOrderLine) {
      unitSellingPrice = item?.order_unit_selling_price;
    } else if (item.option_name) {
      unitSellingPrice = item?.option_selling_price;
    }

    // Size-priced lines (a regular size option, or a sales order placed with a
    // size) omit the "/ uom" suffix because the price is per size, not per uom.
    const isSizePriced = item.option_name || item.order_size_name;

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: 'auto',
        }}>
        <Text
          style={{
            color: colors.neutralTint2,
            fontStyle: 'italic',
          }}>{`@ ${currencySymbol} ${commaNumber(
          parseFloat(unitSellingPrice || 0).toFixed(2),
        )}`}</Text>
        {!isSizePriced && (
          <Text style={{fontStyle: 'italic'}}>{` / ${formatUOMAbbrev(
            item?.uom_abbrev,
          )}`}</Text>
        )}
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
            fontWeight: '600',
          }}>{`${currencySymbol} ${commaNumber(
          parseFloat(item?.saleSubtotal || 0).toFixed(2),
        )}`}</Text>
        <Text style={{marginLeft: 5}}>{`${
          item?.sales_tax_id_effective
            ? costMarkers.taxable
            : costMarkers.taxExempt
        }`}</Text>
      </View>
    );
  };

  if (!item) return null;

  const content = (
    <>
      <View style={styles.wrapper}>
        <View style={styles.wrappedRow}>
          <Text
            style={[
              {
                fontSize: 15,
                fontWeight: '600',
                color: disabled ? colors.disabled : colors.dark,
                marginRight: 10,
                flex: 1,
              },
              isHighlighted && {fontWeight: '600'},
            ]}
            numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        {item.option_name && (
          <View style={styles.wrappedRow}>
            <Text
              style={[
                {
                  fontSize: 14,
                  color: colors.dark,
                  marginRight: 10,
                  flex: 1,
                },
              ]}
              numberOfLines={1}>
              {item.option_name}

              {item.in_option_qty && (
                <Text
                  style={[
                    {
                      fontSize: 14,
                      color: colors.neutralTint2,
                      marginLeft: 10,
                    },
                    isHighlighted && {fontWeight: 'bold'},
                  ]}
                  numberOfLines={1}>
                  {` (${item.in_option_qty} ${formatUOMAbbrev(
                    item.in_option_qty_uom_abbrev,
                  )?.toUpperCase()})`}
                </Text>
              )}
            </Text>
          </View>
        )}

        {item.order_size_name && (
          <View style={styles.wrappedRow}>
            <Text
              style={[
                {
                  fontSize: 14,
                  color: colors.dark,
                  marginRight: 10,
                  flex: 1,
                },
              ]}
              numberOfLines={1}>
              {item.order_size_name}
            </Text>
          </View>
        )}

        <View style={[styles.wrappedRow, {marginTop: 5}]}>
          {renderSaleQuantity()}
          {renderUnitSellingPrice()}
          {renderSubtotal()}
        </View>
      </View>
    </>
  );

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
    marginVertical: 3,
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

export default SalesRegisterTicketItemListItem;
