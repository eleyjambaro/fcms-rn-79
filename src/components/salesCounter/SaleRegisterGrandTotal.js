import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';
import useSalesCounterContext from '../../hooks/useSalesCounterContext';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {useNavigation, useRoute} from '@react-navigation/native';

const SalesRegisterGrandTotal = () => {
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

  return (
    <View
      style={{
        marginTop: 5,
        marginHorizontal: 5,
        paddingHorizontal: 10,
        paddingTop: 5,
        paddingBottom: 15,
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

export default SalesRegisterGrandTotal;

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
