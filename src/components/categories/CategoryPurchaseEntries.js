import React from 'react';
import {useRoute} from '@react-navigation/native';
import {StyleSheet, Text, View, FlatList} from 'react-native';
import {Button, useTheme, DataTable, Modal, Portal} from 'react-native-paper';
import commaNumber from 'comma-number';

import {items, purchasedItems} from '../../__dummyData';
import GrandTotal from '../purchases/GrandTotal';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const CategoryPurchaseEntries = props => {
  const {categoryId, containerStyle} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  if (!categoryId) return null;

  const purchases = purchasedItems.filter(
    purchase => purchase.category_id === categoryId,
  );

  const grandTotal = purchases.reduce((currentTotal, purchase) => {
    const totalCost = purchase.add_stock_qty * purchase.unit_cost;
    return totalCost + currentTotal;
  }, 0);

  const renderItem = ({item}) => {
    return (
      <DataTable.Row>
        <DataTable.Cell>{item.purchase_date}</DataTable.Cell>
        <DataTable.Cell>{item.item_name}</DataTable.Cell>
        <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
          item.unit_cost,
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>{`${item.add_stock_qty} ${formatUOMAbbrev(
          item.uom_abbrev,
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>
          {`${currencySymbol} ${commaNumber(
            item.unit_cost * item.add_stock_qty,
          )}`}
        </DataTable.Cell>
      </DataTable.Row>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <DataTable
        style={{flex: 1, backgroundColor: colors.surface}}
        collapsable={true}>
        <DataTable.Header>
          <DataTable.Title>Purchase Date</DataTable.Title>
          <DataTable.Title>Item</DataTable.Title>
          <DataTable.Title numeric>Unit Cost</DataTable.Title>
          <DataTable.Title numeric>Quantity</DataTable.Title>
          <DataTable.Title numeric>Total Cost</DataTable.Title>
        </DataTable.Header>
        <FlatList
          data={purchases}
          keyExtractor={item => item.name}
          renderItem={renderItem}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                padding: 20,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text>No data to display</Text>
            </View>
          }
        />
      </DataTable>
      <GrandTotal value={grandTotal} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default CategoryPurchaseEntries;
