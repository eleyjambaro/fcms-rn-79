import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {useTheme, Subheading} from 'react-native-paper';
import commaNumber from 'comma-number';
import CurrentMonthYearHeading from '../foodCostAnalysis/CurrentMonthYearHeading';
import ItemStocksHeading from './ItemStocksHeading';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const ItemInventorySummary = props => {
  const {item, values, monthYearDateFilter, tax, containerStyle} = props;
  const {colors} = useTheme();

  if (!item) return null;

  const unitCost = parseFloat(
    item.unit_cost ||
      item.adjustment_unit_cost ||
      item.add_stock_unit_cost ||
      item.remove_stock_unit_cost ||
      0,
  );
  const qty = parseFloat(
    item.initial_stock_qty ||
      item.adjustment_qty ||
      item.add_stock_qty ||
      item.remove_stock_qty ||
      0,
  );
  const taxRatePercentage = parseFloat(tax?.rate_percentage || 0);

  const unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
  const unitCostTax = unitCost - unitCostNet;

  const grossPrice = unitCost * qty;
  const netPrice = grossPrice / (taxRatePercentage / 100 + 1);
  const taxAmount = grossPrice - netPrice;

  const previousMonthGrandTotalQty = item.previous_month_grand_total_qty || 0;
  const selectedMonthTotalAddedStockQty =
    item.selected_month_total_added_stock_qty || 0;
  const selectedMonthTotalRemovedStockQty =
    item.selected_month_total_removed_stock_qty || 0;

  let updateValuesAddedStock = selectedMonthTotalAddedStockQty;
  let updateValuesRemovedStock = selectedMonthTotalRemovedStockQty;

  let defaultCurrentStockQty =
    previousMonthGrandTotalQty +
    selectedMonthTotalAddedStockQty -
    selectedMonthTotalRemovedStockQty;

  let remainingStockQty = parseFloat(values.remaining_stock_qty || 0);

  let numberOfStocksToAdd = 0;
  let numberOfStocksToRemove = 0;

  if (remainingStockQty > defaultCurrentStockQty) {
    // add stock
    updateValuesAddedStock =
      updateValuesAddedStock + (remainingStockQty - defaultCurrentStockQty);

    numberOfStocksToAdd = remainingStockQty - defaultCurrentStockQty;
  } else if (remainingStockQty < defaultCurrentStockQty) {
    // remove stock
    updateValuesRemovedStock =
      updateValuesRemovedStock + (defaultCurrentStockQty - remainingStockQty);

    numberOfStocksToRemove = defaultCurrentStockQty - remainingStockQty;
  }

  return (
    <>
      <View
        style={[
          {
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'gray',
            borderTopColor: 'gray',
            borderBottomColor: 'gray',
            paddingTop: 15,
            paddingLeft: 10,
            paddingRight: 10,
            paddingBottom: 15,
          },
          containerStyle,
        ]}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Current Inventory Status'}
        </Text>
      </View>
      <View
        style={[
          {
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'gray',
            borderTopColor: 'gray',
            borderBottomColor: 'gray',
            paddingTop: 15,
            paddingLeft: 10,
            paddingRight: 10,
            paddingBottom: 15,
          },
        ]}>
        <View style={styles.listItemContainer}>
          <Text style={{fontSize: 16, color: 'gray', fontWeight: 'bold'}}>
            {`Beginning Inventory`}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginLeft: 'auto',
              marginRight: 3,
            }}>
            <Subheading
              numberOfLines={1}
              style={{
                color: colors.accent,
                marginRight: 5,
                fontWeight: 'bold',
              }}>
              {`${commaNumber(
                (item.previous_month_grand_total_qty || 0).toFixed(2),
              )} ${formatUOMAbbrev(item.item_uom_abbrev)}`}
            </Subheading>
          </View>
        </View>

        <View style={styles.listItemContainer}>
          <Text style={{fontSize: 16, color: 'gray'}}>Added Stocks</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginLeft: 'auto',
              marginRight: 3,
            }}>
            <Subheading
              numberOfLines={1}
              style={{color: colors.accent, marginRight: 5}}>
              {`+ ${commaNumber(
                (item.selected_month_total_added_stock_qty || 0).toFixed(2),
              )} ${formatUOMAbbrev(item.item_uom_abbrev)}`}
            </Subheading>
          </View>
        </View>

        <View style={styles.listItemContainer}>
          <Text style={{fontSize: 16, color: 'gray'}}>Removed Stocks</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginLeft: 'auto',
              marginRight: 3,
            }}>
            <Subheading
              numberOfLines={1}
              style={{color: colors.accent, marginRight: 5}}>
              {`- ${commaNumber(
                (item.selected_month_total_removed_stock_qty || 0).toFixed(2),
              )} ${formatUOMAbbrev(item.item_uom_abbrev)}`}
            </Subheading>
          </View>
        </View>

        <View style={styles.listItemContainer}>
          <Text style={{fontSize: 16, color: 'gray', fontWeight: 'bold'}}>
            {`Ending Inventory`}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginLeft: 'auto',
              marginRight: 3,
            }}>
            <Subheading
              numberOfLines={1}
              style={{
                color: colors.accent,
                marginRight: 5,
                fontWeight: 'bold',
              }}>
              {`${commaNumber(
                (item.selected_month_grand_total_qty || 0).toFixed(2),
              )} ${formatUOMAbbrev(item.item_uom_abbrev)}`}
            </Subheading>
          </View>
        </View>
      </View>

      <View
        style={[
          {
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'gray',
            borderTopColor: 'gray',
            borderBottomColor: 'gray',
            paddingTop: 15,
            paddingLeft: 10,
            paddingRight: 10,
            paddingBottom: 15,
            marginTop: -1,
          },
        ]}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Ending Inventory Adjustments'}
        </Text>
      </View>
      <View
        style={[
          {
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'gray',
            borderTopColor: 'gray',
            borderBottomColor: 'gray',
            paddingTop: 15,
            paddingLeft: 10,
            paddingRight: 10,
            paddingBottom: 15,
          },
        ]}>
        <View style={styles.listItemContainer}>
          <Text style={{fontSize: 16, color: 'gray'}}>Stocks to be Added</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginLeft: 'auto',
              marginRight: 3,
            }}>
            <Subheading
              numberOfLines={1}
              style={{color: colors.accent, marginRight: 5}}>
              {`+ ${commaNumber(
                numberOfStocksToAdd?.toFixed(2),
              )} ${formatUOMAbbrev(item.item_uom_abbrev)}`}
            </Subheading>
          </View>
        </View>

        <View style={styles.listItemContainer}>
          <Text style={{fontSize: 16, color: 'gray'}}>
            Stocks to be Removed
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginLeft: 'auto',
              marginRight: 3,
            }}>
            <Subheading
              numberOfLines={1}
              style={{color: colors.accent, marginRight: 5}}>
              {`- ${commaNumber(
                numberOfStocksToRemove?.toFixed(2),
              )} ${formatUOMAbbrev(item.item_uom_abbrev)}`}
            </Subheading>
          </View>
        </View>
      </View>
    </>
  );
};

export default ItemInventorySummary;

const styles = StyleSheet.create({
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
