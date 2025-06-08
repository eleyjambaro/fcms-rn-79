import React, {useState, useEffect, useReducer, useMemo} from 'react';
import {sign, decode} from 'react-native-pure-jwt';

import {SalesCounterContext} from '../types';
import keys from '../../keys';

const SalesCounterContextProvider = props => {
  const {children} = props;

  const [focusedItem, setFocusedItem] = useState(null);
  const [saleItems, setSaleItems] = useState({});
  const [saleItemIds, setSaleItemIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [isLocalStateUpdating, setIsLocalStateUpdating] = useState(false);
  const saleTotalsDefaults = {
    grandTotalAmount: 0,
    totalTaxableAmount: 0,
    totalTaxExemptAmount: 0,
    totalTaxAmount: 0,
  };
  const [saleTotals, setSaleTotals] = useState(saleTotalsDefaults);

  const state = {
    focusedItem,
    saleItems,
    saleItemIds,
    errors,
    isLocalStateUpdating,
    saleTotals,
  };

  useEffect(() => {
    let grandTotalAmount = 0;
    let totalTaxableAmount = 0;
    let totalTaxableNetAmount = 0;
    let totalTaxExemptAmount = 0;
    let totalTaxAmount = 0;

    for (let itemId in saleItems) {
      let item = saleItems[itemId];
      let itemSaleSubtotal = parseFloat(item?.saleSubtotal || 0);

      if (itemSaleSubtotal) {
        grandTotalAmount += itemSaleSubtotal;
      }

      if (item?.tax_id && itemSaleSubtotal) {
        totalTaxableAmount += itemSaleSubtotal;

        let taxRatePercentage = parseFloat(item?.tax_rate_percentage || 0);
        let itemSubtotalNet = itemSaleSubtotal / (taxRatePercentage / 100 + 1);
        let itemSubtotalTax = itemSaleSubtotal - itemSubtotalNet;

        totalTaxableNetAmount += itemSubtotalNet;
        totalTaxAmount += itemSubtotalTax;
      }

      if (!item?.tax_id && itemSaleSubtotal) {
        totalTaxExemptAmount += itemSaleSubtotal;
      }
    }

    setSaleTotals(() => {
      return {
        grandTotalAmount,
        totalTaxableAmount,
        totalTaxableNetAmount,
        totalTaxExemptAmount,
        totalTaxAmount,
      };
    });
  }, [saleItems]);

  const actions = useMemo(
    () => ({
      setFocusedItem,
      setIsLocalStateUpdating,
      // soon to deprecate in favor of updateSaleItemQty
      editSaleItemQty: value => {
        if (!focusedItem) return;

        setSaleItems(currentState => {
          return {
            ...currentState,
            [focusedItem.id]: {
              ...focusedItem,
              saleQty: value ? parseFloat(value) : '',
            },
          };
        });
      },
      // soon to deprecate in favor of updateSaleItemQty
      increaseSaleItemQty: (
        enableOrderQtyValidation = false,
        enableStockQtyValidation = false,
      ) => {
        if (!focusedItem) return;

        const saleQty = saleItems?.[focusedItem.id]?.saleQty
          ? parseFloat(saleItems?.[focusedItem.id]?.saleQty) + 1
          : 1;
        const saleSubtotal =
          parseFloat(focusedItem.unit_selling_price || 0) *
          parseFloat(saleQty || 0);
        const notYetCompletedOrderQty =
          parseFloat(focusedItem?.order_qty || 0) -
          parseFloat(focusedItem?.fulfilled_order_qty || 0);

        if (
          enableStockQtyValidation &&
          saleQty > focusedItem.current_stock_qty
        ) {
          setErrors(currentState => {
            return {
              ...currentState,
              [focusedItem.id]: 'Insufficient stock!',
            };
          });
        } else if (
          enableOrderQtyValidation &&
          saleQty > notYetCompletedOrderQty
        ) {
          setErrors(currentState => {
            return {
              ...currentState,
              [focusedItem.id]: 'Remaining order(s) quantity exceeded!',
            };
          });
        } else {
          setErrors(currentState => {
            let alteredState = {...currentState};
            delete alteredState[focusedItem.id];
            return alteredState;
          });
        }

        setSaleItems(currentState => {
          return {
            ...currentState,
            [focusedItem.id]: {
              ...focusedItem,
              saleQty,
              saleSubtotal,
              sale_qty: saleQty, // alias
              subtotal_amount: saleSubtotal, // alias
            },
          };
        });
      },
      // soon to deprecate in favor of updateSaleItemQty
      decreaseSaleItemQty: (
        enableOrderQtyValidation = false,
        enableStockQtyValidation = false,
      ) => {
        if (!focusedItem) return;

        const saleQty = saleItems?.[focusedItem.id]?.saleQty
          ? parseFloat(saleItems?.[focusedItem.id]?.saleQty) - 1
          : '';
        const saleSubtotal =
          parseFloat(focusedItem.unit_selling_price || 0) *
          parseFloat(saleQty || 0);
        const notYetCompletedOrderQty =
          parseFloat(focusedItem?.order_qty || 0) -
          parseFloat(focusedItem?.fulfilled_order_qty || 0);

        if (
          enableStockQtyValidation &&
          saleQty > focusedItem.current_stock_qty
        ) {
          setErrors(currentState => {
            return {
              ...currentState,
              [focusedItem.id]: 'Insufficient stock!',
            };
          });
        } else if (
          enableOrderQtyValidation &&
          saleQty > notYetCompletedOrderQty
        ) {
          setErrors(currentState => {
            return {
              ...currentState,
              [focusedItem.id]: 'Remaining order(s) quantity exceeded!',
            };
          });
        } else {
          setErrors(currentState => {
            let alteredState = {...currentState};
            delete alteredState[focusedItem.id];
            return alteredState;
          });
        }

        setSaleItems(currentState => {
          return {
            ...currentState,
            [focusedItem.id]: {
              ...focusedItem,
              saleQty,
              saleSubtotal,
              sale_qty: saleQty, // alias
              subtotal_amount: saleSubtotal, // alias
            },
          };
        });
      },
      // same with editSaleItemQty but in more efficient way using useDebounce hook
      updateSaleItemQty: (
        itemId,
        value,
        enableOrderQtyValidation = false,
        enableStockQtyValidation = false,
      ) => {
        if (!itemId || !focusedItem || itemId !== focusedItem.id) return;

        const saleQty = value ? parseFloat(value) : '';
        const saleSubtotal =
          parseFloat(focusedItem.unit_selling_price || 0) *
          parseFloat(saleQty || 0);
        const notYetCompletedOrderQty =
          parseFloat(focusedItem?.order_qty || 0) -
          parseFloat(focusedItem?.fulfilled_order_qty || 0);

        if (
          enableStockQtyValidation &&
          saleQty > focusedItem.current_stock_qty
        ) {
          setErrors(currentState => {
            return {
              ...currentState,
              [focusedItem.id]: 'Insufficient stock!',
            };
          });
        } else if (
          enableOrderQtyValidation &&
          saleQty > notYetCompletedOrderQty
        ) {
          setErrors(currentState => {
            return {
              ...currentState,
              [focusedItem.id]: 'Remaining order quantity exceeded!',
            };
          });
        } else {
          setErrors(currentState => {
            let alteredState = {...currentState};
            delete alteredState[focusedItem.id];
            return alteredState;
          });
        }

        setSaleItems(currentState => {
          return {
            ...currentState,
            [itemId]: {
              ...focusedItem,
              saleQty,
              saleSubtotal,
              sale_qty: saleQty, // alias
              subtotal_amount: saleSubtotal, // alias
            },
          };
        });
      },
      updateSaleItemWithUnitSellingPrice: (
        item,
        qty = '1',
        autoIncreaseSaleQty = true,
        enableStockQtyValidation = false,
      ) => {
        if (!item) return;

        // id to get item from saleItems
        const saleItemRefId = item.id;
        let saleQty = qty ? parseFloat(qty) : '';

        if (autoIncreaseSaleQty) {
          saleQty =
            parseFloat(saleItems?.[saleItemRefId]?.saleQty || 0) + saleQty;
        }

        const saleSubtotal =
          parseFloat(item.unit_selling_price || 0) * parseFloat(saleQty || 0);

        if (enableStockQtyValidation && saleQty > item.current_stock_qty) {
          setErrors(currentState => {
            return {
              ...currentState,
              [saleItemRefId]: 'Insufficient stock!',
            };
          });
        }

        setSaleItems(currentState => {
          return {
            ...currentState,
            [saleItemRefId]: {
              ...item,
              saleItemRefId,
              saleQty,
              saleSubtotal,
              sale_qty: saleQty, // alias
              subtotal_amount: saleSubtotal, // alias
            },
          };
        });
      },
      updateSaleItemWithSizeOption: (
        item,
        qty = '1',
        autoIncreaseSaleQty = true,
        enableStockQtyValidation = false,
      ) => {
        if (!item) return;

        // id to get item from saleItems
        const saleItemRefId = `${item.item_id}&&${item.option_id}`;
        let saleQty = qty ? parseFloat(qty) : '';

        if (autoIncreaseSaleQty) {
          saleQty =
            parseFloat(saleItems?.[saleItemRefId]?.saleQty || 0) + saleQty;
        }

        const saleSubtotal =
          parseFloat(item.option_selling_price || 0) * parseFloat(saleQty || 0);

        if (enableStockQtyValidation && saleQty > item.current_stock_qty) {
          setErrors(currentState => {
            return {
              ...currentState,
              [saleItemRefId]: 'Insufficient stock!',
            };
          });
        }

        setSaleItems(currentState => {
          return {
            ...currentState,
            [saleItemRefId]: {
              ...item,
              saleItemRefId,
              saleQty,
              saleSubtotal,
              sale_qty: saleQty, // alias
              subtotal_amount: saleSubtotal, // alias
            },
          };
        });
      },
      updateSaleItemFromSalesOrder: (
        item,
        qty = '1',
        autoIncreaseSaleQty = true,
        enableStockQtyValidation = false,
      ) => {
        if (!item) return;

        // id to get item from saleItems
        const saleItemRefId = `${item.order_id}`;
        let saleQty = qty ? parseFloat(qty) : '';

        if (autoIncreaseSaleQty) {
          saleQty =
            parseFloat(saleItems?.[saleItemRefId]?.saleQty || 0) + saleQty;
        }

        const saleSubtotal =
          parseFloat(item.order_unit_selling_price || 0) *
          parseFloat(saleQty || 0);

        if (enableStockQtyValidation && saleQty > item.current_stock_qty) {
          setErrors(currentState => {
            return {
              ...currentState,
              [saleItemRefId]: 'Insufficient stock!',
            };
          });
        }

        setSaleItems(currentState => {
          return {
            ...currentState,
            [saleItemRefId]: {
              ...item,
              saleItemRefId,
              saleQty,
              saleSubtotal,
              sale_qty: saleQty, // alias
              subtotal_amount: saleSubtotal, // alias
            },
          };
        });
      },
      updateSaleItemFromSalesRegisterTicket: (
        item,
        qty = '1',
        autoIncreaseSaleQty = true,
        enableStockQtyValidation = false,
      ) => {
        if (!item) return;

        // id to get item from saleItems
        const saleItemRefId = `${item.saleItemRefId}`;
        let saleQty = qty ? parseFloat(qty) : '';

        if (autoIncreaseSaleQty) {
          saleQty =
            parseFloat(saleItems?.[saleItemRefId]?.saleQty || 0) + saleQty;
        }

        const saleSubtotal =
          parseFloat(item.option_selling_price || 0) * parseFloat(saleQty || 0);

        if (enableStockQtyValidation && saleQty > item.current_stock_qty) {
          setErrors(currentState => {
            return {
              ...currentState,
              [saleItemRefId]: 'Insufficient stock!',
            };
          });
        }

        setSaleItems(currentState => {
          return {
            ...currentState,
            [saleItemRefId]: {
              ...item,
              saleItemRefId,
              saleQty,
              saleSubtotal,
              sale_qty: saleQty, // alias
              subtotal_amount: saleSubtotal, // alias
            },
          };
        });
      },
      removeSaleItemFromSalesRegisterTicket: item => {
        if (!item || !item?.saleItemRefId) return;

        // id to get item from saleItems
        const saleItemRefId = `${item.saleItemRefId}`;

        setSaleItems(currentState => {
          const currentStateCopy = {
            ...currentState,
          };

          delete currentStateCopy[saleItemRefId];

          return {
            ...currentStateCopy,
          };
        });
      },
      prepareToReviewSaleItems: () => {
        let sanitizedSaleItems = {};
        let saleItemIds = [];

        Object.keys(saleItems).forEach(key => {
          if (saleItems?.[key]?.saleQty) {
            // sale items with no zero or null saleQty value
            sanitizedSaleItems[key] = saleItems[key];

            // create item ids array
            saleItemIds.push(parseInt(key));
          }
        });

        setFocusedItem(() => null);
        setSaleItems(() => sanitizedSaleItems);
        setSaleItemIds(() => saleItemIds);
      },
      resetSalesCounter: () => {
        setFocusedItem(() => null);

        setSaleItems(() => {
          return {};
        });

        setSaleItemIds(() => {
          return [];
        });

        setErrors(() => {
          return {};
        });

        setSaleTotals(() => {
          return saleTotalsDefaults;
        });
      },
    }),
    [focusedItem, saleItems],
  );

  return (
    <SalesCounterContext.Provider value={[state, actions]}>
      {children}
    </SalesCounterContext.Provider>
  );
};

export default SalesCounterContextProvider;
