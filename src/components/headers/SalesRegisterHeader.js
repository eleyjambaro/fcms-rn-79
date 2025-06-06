import {StyleSheet} from 'react-native';
import React, {useEffect, useState} from 'react';

import useSalesCounterContext from '../../hooks/useSalesCounterContext';
import {useNavigation, useRoute} from '@react-navigation/native';
import PreventGoBackSalesCounter from '../utils/PreventGoBackSalesCounter';
import SalesRegisterGrandTotal from '../salesCounter/SaleRegisterGrandTotal';

const SalesRegisterHeader = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [state, actions] = useSalesCounterContext();

  /**
   * Context level state (global state)
   */
  const saleItems = state?.saleItems;

  /**
   * Component level state (local state)
   */
  const [localStateItems, setLocalStateItems] = useState(saleItems);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(
    Object.keys(saleItems).length,
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

  return (
    <>
      <PreventGoBackSalesCounter
        navigation={navigation}
        hasUnsavedChanges={hasUnsavedChanges}
      />
      <SalesRegisterGrandTotal />
    </>
  );
};

export default SalesRegisterHeader;

const styles = StyleSheet.create({
  container: {
    margin: 5,
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
