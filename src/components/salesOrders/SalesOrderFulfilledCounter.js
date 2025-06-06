import {StyleSheet, Text, View, Pressable} from 'react-native';
import React, {useEffect, useState} from 'react';
import {useTheme, TextInput, Divider} from 'react-native-paper';
import commaNumber from 'comma-number';
import {useQuery} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useSalesCounterContext from '../../hooks/useSalesCounterContext';
import {extractNumber, formatUOMAbbrev} from '../../utils/stringHelpers';
import useDebounce from '../../hooks/useDebounce';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {useNavigation, useRoute} from '@react-navigation/native';
import PreventGoBackSalesCounter from '../utils/PreventGoBackSalesCounter';

const SalesOrderFulfilledCounter = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const currencySymbol = useCurrencySymbol();
  const [state, actions] = useSalesCounterContext();

  /**
   * Context level state (global state)
   */
  const saleItems = state?.saleItems;
  const saleFocusedItem = state?.focusedItem;
  const saleGrandTotal = state?.saleGrandTotal;
  const saleTotals = state?.saleTotals;
  const saleErrors = state?.errors;

  /**
   * Component level state (local state)
   */
  const [isItemQtyChanging, setIsItemQtyChanging] = useState(false);
  const [localStateItems, setLocalStateItems] = useState(saleItems);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(
    Object.keys(saleItems).length,
  );

  const buttonWidth = 57;
  const buttonHeight = 57;

  useDebounce(
    () => {
      if (!saleFocusedItem) return;

      if (isItemQtyChanging) {
        setIsItemQtyChanging(() => false);

        actions?.updateSaleItemQty(
          saleFocusedItem?.id,
          localStateItems?.[saleFocusedItem?.id]?.saleQty,
          true,
        );

        actions?.setIsLocalStateUpdating(() => false);
      }
    },
    200,
    [localStateItems, saleFocusedItem, isItemQtyChanging],
  );

  // sync local state with context level state
  useEffect(() => {
    setLocalStateItems(() => saleItems);

    /**
     * setHasUnsavedChanges on context level state change
     */
    setHasUnsavedChanges(() => {
      if (Object.keys(saleItems).length) {
        return true;
      } else {
        return false;
      }
    });
  }, [saleItems]);

  useEffect(() => {
    /**
     * setHasUnsavedChanges on mount
     */
    setHasUnsavedChanges(() => {
      if (Object.keys(saleItems).length) {
        return Date.now().toString(); // instead of boolean to force rerendering
      } else {
        return false;
      }
    });

    return () => {
      actions?.setIsLocalStateUpdating(() => false);
      actions?.resetSalesCounter();
    };
  }, []);

  useEffect(() => {
    if (route?.params?.goBackedFromConfirmation) {
      setHasUnsavedChanges(() => {
        if (Object.keys(saleItems).length) {
          return Date.now().toString(); // instead of boolean to force rerendering
        } else {
          return false;
        }
      });
    }
  }, [route?.params?.goBackedFromConfirmation]);

  const renderGrandTotal = () => {
    return (
      <View
        style={{
          marginTop: 5,
          marginHorizontal: 5,
          paddingHorizontal: 10,
          paddingTop: 5,
          paddingBottom: 15,
          // flexDirection: 'row',
          // alignItems: 'center',
          borderRadius: 5,
          backgroundColor: colors.primary,
        }}>
        <View style={{marginBottom: 5}}>
          <Text
            style={{
              color: colors.surface,
              fontWeight: 'bold',
              fontSize: 14,
            }}>
            Grand Total
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            paddingVertical: 5,
            paddingHorizontal: 15,
            borderRadius: 20,
          }}>
          <Text
            style={{
              fontSize: 25,
              fontWeight: 'bold',
              color: colors.dark,
              marginLeft: 'auto',
            }}>
            {`${currencySymbol} ${commaNumber(
              (saleTotals?.grandTotalAmount || 0)?.toFixed(2),
            )}`}
          </Text>
        </View>
      </View>
    );
  };

  const renderNoSellingPriceWarning = () => {
    return (
      <View style={{flexDirection: 'row', marginTop: 5, alignItems: 'center'}}>
        <MaterialIcons name="warning" size={20} color={'orange'} />
        <Text
          style={{
            marginLeft: 6,
            fontWeight: '500',
            fontSize: 16,
            fontStyle: 'italic',
          }}>
          Item has no selling price.
        </Text>
      </View>
    );
  };

  const renderInputError = errorMessage => {
    if (!errorMessage) return null;

    return (
      <View style={{flexDirection: 'row', marginTop: 5, alignItems: 'center'}}>
        <MaterialIcons name="error" size={16} color={colors.error} />
        <Text
          style={{
            color: colors.error,
            marginLeft: 5,
            fontSize: 14,
            fontStyle: 'italic',
          }}>
          {errorMessage}
        </Text>
      </View>
    );
  };

  const renderOrderStatus = () => {
    if (!saleFocusedItem) return null;
    const item = saleFocusedItem;

    const notYetCompletedOrderQty =
      parseFloat(saleFocusedItem?.order_qty || 0) -
      parseFloat(saleFocusedItem?.fulfilled_order_qty || 0);

    if (notYetCompletedOrderQty) {
      return (
        <View style={{flexDirection: 'row', marginTop: 5}}>
          <Text style={{fontWeight: 'bold'}}>Status: </Text>
          <Text
            style={{
              color: colors.dark,
              fontWeight: 'bold',
            }}>{`${commaNumber(
            parseFloat(notYetCompletedOrderQty || 0).toFixed(2),
          )}`}</Text>
          <Text style={{fontWeight: 'bold'}}>{` ${formatUOMAbbrev(
            item.uom_abbrev,
          )}`}</Text>
          <Text
            style={{
              marginLeft: 5,
            }}>{`left to complete`}</Text>
        </View>
      );
    }
  };

  const renderFocusedItem = () => {
    if (saleFocusedItem) {
      const item = saleFocusedItem;
      const errorMessage = saleErrors[item.id];

      return (
        <View style={{marginTop: 0}}>
          <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.dark}}>
            {item.name}
          </Text>

          <View style={{flexDirection: 'row', marginTop: 5}}>
            <Text style={{fontWeight: 'bold'}}>Stock: </Text>
            <Text
              style={{
                color: colors.dark,
                fontWeight: 'bold',
              }}>{`${commaNumber(
              parseFloat(item.current_stock_qty || 0).toFixed(2),
            )}`}</Text>
            <Text style={{fontWeight: 'bold'}}>{` ${formatUOMAbbrev(
              item.uom_abbrev,
            )}`}</Text>
            <Text
              style={{
                fontStyle: 'italic',
                marginLeft: 10,
              }}>{`(${currencySymbol} ${commaNumber(
              parseFloat(item.unit_selling_price || 0).toFixed(2),
            )}`}</Text>
            <Text
              style={{
                fontStyle: 'italic',
              }}>{` / ${formatUOMAbbrev(item.uom_abbrev)})`}</Text>
          </View>

          <Divider style={{marginTop: 10}} />

          <View style={{flexDirection: 'row', marginTop: 10}}>
            <Text style={{fontWeight: 'bold'}}>Order: </Text>
            <Text
              style={{
                color: colors.dark,
                fontWeight: 'bold',
              }}>{`${commaNumber(
              parseFloat(item.order_qty || 0).toFixed(2),
            )}`}</Text>
            <Text style={{fontWeight: 'bold'}}>{` ${formatUOMAbbrev(
              item.uom_abbrev,
            )}`}</Text>
            <Text
              style={{
                fontStyle: 'italic',
                marginLeft: 10,
              }}>{`(${currencySymbol} ${commaNumber(
              parseFloat(item.unit_selling_price || 0).toFixed(2),
            )}`}</Text>
            <Text
              style={{
                fontStyle: 'italic',
              }}>{` / ${formatUOMAbbrev(item.uom_abbrev)})`}</Text>
          </View>

          {renderOrderStatus()}

          {!item?.unit_selling_price && renderNoSellingPriceWarning()}
          {errorMessage && renderInputError(errorMessage)}
        </View>
      );
    }
  };

  const renderQuantityInput = () => {
    if (
      saleFocusedItem?.fulfilled_order_qty > 0 &&
      saleFocusedItem?.fulfilled_order_qty >= saleFocusedItem?.order_qty
    ) {
      return (
        <View
          style={{marginTop: 10, flexDirection: 'row', alignItems: 'center'}}>
          <MaterialCommunityIcons
            name={'check-circle'}
            size={20}
            color={colors.accent}
          />
          <Text
            style={{
              marginLeft: 5,
              fontSize: 16,
              fontWeight: 'bold',
              color: colors.accent,
            }}>{`Order Fulfilled`}</Text>
        </View>
      );
    }

    return (
      <>
        <Text
          style={{
            marginLeft: 5,
            marginTop: 20,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.primary,
          }}>{`Enter new fulfilled order quantity:`}</Text>
        <View
          style={{flexDirection: 'row', alignItems: 'center', marginTop: 10}}>
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: colors.surface,
                borderColor: colors.neutralTint3,
                height: buttonHeight,
                width: buttonWidth,
              },
            ]}
            onPress={() => {
              if (!saleFocusedItem) return;

              setIsItemQtyChanging(() => true);
              actions?.setIsLocalStateUpdating(() => true);

              const saleQty = localStateItems?.[saleFocusedItem.id]?.saleQty
                ? parseFloat(localStateItems?.[saleFocusedItem.id]?.saleQty) - 1
                : '';
              const saleSubtotal =
                parseFloat(saleFocusedItem?.unit_selling_price || 0) *
                parseFloat(saleQty || 0);

              setLocalStateItems(currentState => {
                return {
                  ...currentState,
                  [saleFocusedItem.id]: {
                    ...localStateItems?.[saleFocusedItem.id],
                    saleQty,
                    saleSubtotal,
                  },
                };
              });
            }}>
            <MaterialCommunityIcons
              name="minus"
              size={37}
              color={colors.dark}
            />
          </Pressable>
          <TextInput
            label="Quantity"
            mode="outlined"
            keyboardType="numeric"
            error={
              Object.keys(saleErrors).length && saleErrors[saleFocusedItem?.id]
            }
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              marginHorizontal: 15,
              fontWeight: 'bold',
              fontSize: 20,
            }}
            value={
              commaNumber(
                isItemQtyChanging
                  ? localStateItems?.[saleFocusedItem?.id]?.saleQty
                  : saleItems?.[saleFocusedItem?.id]?.saleQty,
              )?.toString() || ''
            }
            onChangeText={value => {
              if (!saleFocusedItem) return;

              setIsItemQtyChanging(() => true);
              actions?.setIsLocalStateUpdating(() => true);

              const extractedValue = extractNumber(value);
              const saleQty = extractedValue ? parseFloat(extractedValue) : '';
              const saleSubtotal =
                parseFloat(saleFocusedItem?.unit_selling_price || 0) *
                parseFloat(saleQty || 0);

              setLocalStateItems(currentState => {
                return {
                  ...currentState,
                  [saleFocusedItem?.id]: {
                    ...saleItems?.[saleFocusedItem?.id],
                    saleQty,
                    saleSubtotal,
                  },
                };
              });
            }}
          />
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: colors.surface,
                borderColor: colors.neutralTint3,
                height: buttonHeight,
                width: buttonWidth,
              },
            ]}
            onPress={() => {
              if (!saleFocusedItem) return;

              setIsItemQtyChanging(() => true);
              actions?.setIsLocalStateUpdating(() => true);

              const saleQty = localStateItems?.[saleFocusedItem.id]?.saleQty
                ? parseFloat(localStateItems?.[saleFocusedItem.id]?.saleQty) + 1
                : 1;
              const saleSubtotal =
                parseFloat(saleFocusedItem?.unit_selling_price || 0) *
                parseFloat(saleQty || 0);

              setLocalStateItems(currentState => {
                return {
                  ...currentState,
                  [saleFocusedItem.id]: {
                    ...localStateItems?.[saleFocusedItem.id],
                    saleQty,
                    saleSubtotal,
                  },
                };
              });
            }}>
            <MaterialCommunityIcons name="plus" size={37} color={colors.dark} />
          </Pressable>
        </View>
      </>
    );
  };

  if (!state?.focusedItem) {
    return (
      <>
        {/* {renderGrandTotal()} */}
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface,
              minHeight: 90,
              justifyContent: 'center',
            },
          ]}>
          <View style={{alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{fontStyle: 'italic', fontSize: 16}}>
              Select an order to fulfill from the list
            </Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <PreventGoBackSalesCounter
        navigation={navigation}
        hasUnsavedChanges={hasUnsavedChanges}
      />
      {/* {renderGrandTotal()} */}
      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        {renderFocusedItem()}
        {renderQuantityInput()}
      </View>
    </>
  );
};

export default SalesOrderFulfilledCounter;

const styles = StyleSheet.create({
  container: {
    margin: 5,
    marginBottom: 10,
    padding: 15,
    borderRadius: 5,
  },
  button: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {},
  detailsListItem: {
    marginLeft: 0,
    marginVertical: 3,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECECEC',
    padding: 10,
    borderRadius: 15,
  },
});
