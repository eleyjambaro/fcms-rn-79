import React, {useState, useRef, useMemo, useCallback} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Dimensions,
  Pressable,
  RefreshControl,
} from 'react-native';
import {
  Button,
  useTheme,
  DataTable,
  Modal,
  Portal,
  Title,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import {Tabs, TabScreen} from 'react-native-paper-tabs';

import routes from '../../constants/routes';
import ListEmpty from '../../components/stateIndicators/ListEmpty';
import SectionHeading from '../headings/SectionHeading';
import {inventoryDefaultOperations} from '../../localDbQueries/operations';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import appDefaults from '../../constants/appDefaults';

const CategoryInventoryDetailsModal = props => {
  const {visible, onDismiss, contentContainerStyle, category} = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const currencySymbol = useCurrencySymbol();

  if (!category) return null;

  const renderTable = () => {
    const item = category;

    const selectedMonthGrandTotalCost =
      item.selected_month_grand_total_cost || 0;
    const selectedMonthGrandTotalCostNet =
      item.selected_month_grand_total_cost_net || 0;
    const selectedMonthTotalRemovedStockCost =
      item.selected_month_total_removed_stock_cost || 0;
    const selectedMonthTotalRemovedStockCostNet =
      item.selected_month_total_removed_stock_cost_net || 0;
    const previousMonthGrandTotalCost =
      item.previous_month_grand_total_cost || 0;
    const previousMonthGrandTotalCostNet =
      item.previous_month_grand_total_cost_net || 0;
    const selectedMonthRevenueGroupTotalAmount =
      item.selected_month_revenue_group_total_amount || 0;
    const categoryCostPercentage = selectedMonthRevenueGroupTotalAmount
      ? (selectedMonthTotalRemovedStockCostNet /
          selectedMonthRevenueGroupTotalAmount) *
        100
      : 0;
    const wholeMonthPurchasesTotalCost =
      item.whole_month_operation_id_2_total_cost || 0;
    const wholeMonthPurchasesTotalCostNet =
      item.whole_month_operation_id_2_total_cost_net || 0;
    const wholeMonthPurchasesTotalCostTax =
      item.whole_month_operation_id_2_total_cost_tax || 0;

    const wholeMonthTotalAddedStockCost =
      item.whole_month_total_added_stock_cost || 0;
    const wholeMonthTotalAddedStockCostNet =
      item.whole_month_total_added_stock_cost_net || 0;
    const wholeMonthTotalAddedStockCostTax =
      item.whole_month_total_added_stock_cost_tax || 0;

    const wholeMonthTotalRemovedStockCost =
      item.whole_month_total_removed_stock_cost || 0;
    const wholeMonthTotalRemovedStockCostNet =
      item.whole_month_total_removed_stock_cost_net || 0;
    const wholeMonthTotalRemovedStockCostTax =
      item.whole_month_total_removed_stock_cost_tax || 0;

    /**
     * Cost of Sales formula:
     * Beginning Inventory + Purchases - Ending Inventory
     * or
     * Prev. Month Grand Total Cost + Purchases Amount - Selected Month Grand Total Cost (Remaining Stock Total)
     */
    const costOfSalesNet =
      previousMonthGrandTotalCostNet +
      wholeMonthTotalAddedStockCostNet -
      selectedMonthGrandTotalCostNet;

    const netPurchasePercentage = selectedMonthRevenueGroupTotalAmount
      ? (wholeMonthPurchasesTotalCostNet /
          selectedMonthRevenueGroupTotalAmount) *
        100
      : 0;

    const added = [];
    const removed = [];

    inventoryDefaultOperations.forEach(operation => {
      if (operation.type === 'add_stock') {
        const operationName =
          operation.id === 1
            ? `Pre-${appDefaults.appDisplayName} Stock`
            : operation.name;
        added.push(
          <DataTable.Row key={operation.id}>
            <DataTable.Cell>{`${operationName}`}</DataTable.Cell>
            <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
              (
                item[
                  `whole_month_operation_id_${operation.id}_total_cost_net`
                ] || 0
              ).toFixed(2),
            )}`}</DataTable.Cell>
          </DataTable.Row>,
        );
      }

      if (operation.type === 'remove_stock' && operation.id !== 5) {
        removed.push(
          <DataTable.Row key={operation.id}>
            <DataTable.Cell>{`${operation.name}`}</DataTable.Cell>
            <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
              (
                item[
                  `whole_month_operation_id_${operation.id}_total_cost_net`
                ] || 0
              ).toFixed(2),
            )}`}</DataTable.Cell>
          </DataTable.Row>,
        );
      }
    });

    return (
      <>
        <SectionHeading
          headingText={'Added Stock Cost'}
          containerStyle={{marginTop: 0, paddingBottom: 5}}
          switchVisible={false}
        />
        <DataTable style={[{backgroundColor: colors.surface}]}>
          <DataTable.Header>
            <DataTable.Title style={styles.tableColumn}>
              {`Operation`}
            </DataTable.Title>
            <DataTable.Title style={styles.tableColumn} numeric>
              {`Net Cost`}
            </DataTable.Title>
          </DataTable.Header>
          {added}
          <DataTable.Row>
            <DataTable.Cell>
              <Text style={{fontWeight: 'bold'}}>{`Total`}</Text>
            </DataTable.Cell>
            <DataTable.Cell numeric>
              <Text
                style={{
                  fontWeight: 'bold',
                  color: colors.accent,
                }}>{`${currencySymbol} ${commaNumber(
                (item.whole_month_total_added_stock_cost_net || 0).toFixed(2),
              )}`}</Text>
            </DataTable.Cell>
          </DataTable.Row>
        </DataTable>

        <SectionHeading
          headingText={'Removed Stock Cost'}
          containerStyle={{marginTop: 10, paddingBottom: 5}}
          switchVisible={false}
        />

        <DataTable style={[{backgroundColor: colors.surface}]}>
          <DataTable.Header>
            <DataTable.Title style={styles.tableColumn}>
              {`Operation`}
            </DataTable.Title>
            <DataTable.Title style={styles.tableColumn} numeric>
              {`Net Cost`}
            </DataTable.Title>
          </DataTable.Header>
          {removed}
          <DataTable.Row>
            <DataTable.Cell>
              <Text style={{fontWeight: 'bold'}}>{`Total`}</Text>
            </DataTable.Cell>
            <DataTable.Cell numeric>
              <Text
                style={{
                  fontWeight: 'bold',
                  color: colors.accent,
                }}>{`${currencySymbol} ${commaNumber(
                (item.whole_month_total_removed_stock_cost_net || 0).toFixed(2),
              )}`}</Text>
            </DataTable.Cell>
          </DataTable.Row>
        </DataTable>
      </>
    );
  };

  return (
    <>
      <Portal>
        <Modal
          visible={visible}
          onDismiss={() => onDismiss && onDismiss()}
          contentContainerStyle={[
            {backgroundColor: 'white', padding: 20},
            contentContainerStyle,
          ]}>
          <Title style={{textAlign: 'center'}}>{category?.category_name}</Title>

          <ScrollView>{renderTable()}</ScrollView>
          <View
            style={{
              backgroundColor: 'white',
              padding: 10,
              paddingBottom: 20,
            }}>
            <Button
              mode="contained"
              icon="close"
              onPress={() => {
                onDismiss && onDismiss();
              }}>
              Close
            </Button>
          </View>
        </Modal>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  table: {
    flex: 1,
  },
  tableColumn: {},
});

export default CategoryInventoryDetailsModal;
