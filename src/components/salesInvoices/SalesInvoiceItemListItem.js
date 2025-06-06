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

  const renderSaleQuantity = () => {
    let textValue = `${commaNumber(
      parseFloat(item.sale_qty || 0).toFixed(item.sale_qty % 1 ? 2 : 0),
    )} ${formatUOMAbbrev(item.uom_abbrev)}`;

    if (item.sale_size_name) {
      textValue = `x ${commaNumber(
        parseFloat(item.sale_qty || 0).toFixed(item.sale_qty % 1 ? 2 : 0),
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
    let textContent = (
      <>
        <Text
          style={{
            color: colors.neutralTint2,
            fontStyle: 'italic',
          }}>{`@ ${currencySymbol} ${commaNumber(
          parseFloat(item?.sale_unit_selling_price || 0).toFixed(2),
        )}`}</Text>
        <Text style={{fontStyle: 'italic'}}>{` / ${formatUOMAbbrev(
          item?.uom_abbrev,
        )}`}</Text>
      </>
    );

    if (item.sale_size_name) {
      textContent = (
        <>
          <Text
            style={{
              color: colors.neutralTint2,
              fontStyle: 'italic',
            }}>{`@ ${currencySymbol} ${commaNumber(
            parseFloat(item?.sale_unit_selling_price || 0).toFixed(2),
          )}`}</Text>
          {/* <Text style={{fontStyle: 'italic'}}>{` each`}</Text> */}
        </>
      );
    }
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: 'auto',
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
            fontWeight: '600',
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
                fontSize: 14,
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

        {item.sale_size_name && (
          <View
            style={
              (styles.wrappedRow,
              {
                marginTop: 5,
                marginBottom: 0,
                flexDirection: 'row',
              })
            }>
            <Text
              style={[
                {
                  fontSize: 14,
                  color: colors.neutralTint1,
                  flex: 1,
                },
                isHighlighted && {fontWeight: 'bold'},
              ]}
              numberOfLines={1}>
              {item.sale_size_name}

              {item.sale_in_size_qty && (
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
                  {` (${item.sale_in_size_qty} ${formatUOMAbbrev(
                    item.sale_in_size_qty_uom_abbrev,
                  )?.toUpperCase()})`}
                </Text>
              )}
            </Text>
          </View>
        )}

        <View style={[styles.wrappedRow, {marginTop: 5}]}>
          {renderSaleQuantity()}
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
