import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {
  Button,
  Paragraph,
  Dialog,
  Modal,
  Portal,
  TextInput,
  Title,
  useTheme,
  Surface,
  DataTable,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import {useQueryClient, useMutation} from '@tanstack/react-query';

import BatchPurchaseAddStockForm from '../forms/BatchPurchaseAddStockForm';
import BatchStockUsageRemoveStockForm from '../forms/BatchStockUsageRemoveStockForm';
import EndingInventoryForm from '../forms/EndingInventoryForm';
import {createBatchPurchaseEntry} from '../../localDbQueries/batchPurchase';
import {createBatchStockUsageEntry} from '../../localDbQueries/batchStockUsage';
import {useNavigation} from '@react-navigation/native';
import routes from '../../constants/routes';
import {createItemEndingInventoryEntry} from '../../localDbQueries/endingInventory';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const ItemEndingInventoryListItem = props => {
  const {
    item,
    mode = 'purchase',
    onDismiss,
    highlightedItemId,
    index,
    monthYearDateFilter,
  } = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const currencySymbol = useCurrencySymbol();
  const [detailsDialogVisible, setDetailsDialogVisible] = useState(false);
  const [unitCostModalVisible, setUnitCostModalVisible] = useState(false);
  const [addOrRemoveStockModalVisible, setAddOrRemoveStockModalVisible] =
    useState(false);
  const [endingInventoryModalVisible, setEndingInventoryModalVisible] =
    useState(false);
  const queryClient = useQueryClient();
  const createBatchPurchaseEntryMutation = useMutation(
    createBatchPurchaseEntry,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('itemsAndBatchPurchaseEntries');
        queryClient.invalidateQueries('batchPurchaseEntries');
        queryClient.invalidateQueries('batchPurchaseEntriesCount');
        queryClient.invalidateQueries('batchPurchaseGroups');
        onDismiss && onDismiss();
      },
    },
  );
  const createBatchStockUsageEntryMutation = useMutation(
    createBatchStockUsageEntry,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('itemsAndBatchStockUsageEntries');
        queryClient.invalidateQueries('batchStockUsageEntries');
        queryClient.invalidateQueries('batchStockUsageEntriesCount');
        queryClient.invalidateQueries('batchStockUsageGroups');
        onDismiss && onDismiss();
      },
    },
  );

  const createItemEndingInventoryEntryMutation = useMutation(
    createItemEndingInventoryEntry,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('itemsMonthlyReport');
        onDismiss && onDismiss();
      },
    },
  );

  const hideDialog = () => setDetailsDialogVisible(false);

  const showDialog = () => setDetailsDialogVisible(true);

  const modalContainerStyle = {backgroundColor: 'white', padding: 20};

  if (!item) return null;

  const addStockTotalCost = parseFloat(item.total_cost || 0);
  const removeStockTotalCost = parseFloat(item.total_cost || 0);
  const totalCost =
    mode === 'purchase' ? addStockTotalCost : removeStockTotalCost;

  const handleSubmit = async (values, actions) => {
    try {
      await createItemEndingInventoryEntryMutation.mutateAsync({
        itemId: item.id,
        monthYearDateFilter,
        values,
      });
    } catch (error) {
      console.debug(error);
    }

    actions.resetForm();
    setEndingInventoryModalVisible(() => false);
  };

  const renderUnitCostOrAverageUnitCost = () => {
    const heading = mode === 'purchase' ? 'Unit Cost' : 'Unit Cost';
    const cost =
      mode === 'purchase'
        ? item.add_stock_unit_cost || item.unit_cost
        : item.remove_stock_unit_cost || item.unit_cost;

    return (
      <>
        <View style={styles.colHeader}>
          <Text style={styles.colHeading}>{heading}</Text>
        </View>
        <Pressable
          style={styles.costFrame}
          onPress={() => {
            // setUnitCostModalVisible(true)
            setAddOrRemoveStockModalVisible(true);
          }}>
          <Text style={styles.costText}>{`${currencySymbol} ${cost}`}</Text>
        </Pressable>
      </>
    );
  };

  const renderAddOrRemoveStockButton = () => {
    const heading = mode === 'purchase' ? 'Add Stock' : 'Remove Stock';
    const addStockButtonValue =
      item.add_stock_qty > 0
        ? `+ ${item.add_stock_qty} ${formatUOMAbbrev(item.uom_abbrev)}`
        : '+';
    const removeStockButtonValue =
      item.remove_stock_qty > 0
        ? `- ${item.remove_stock_qty} ${formatUOMAbbrev(item.uom_abbrev)}`
        : '-';
    const addStockButtonColor =
      item.add_stock_qty > 0 ? colors.accent : colors.primary;
    const removeStockButtonColor =
      item.remove_stock_qty > 0 ? colors.accent : colors.primary;

    return (
      <>
        <View style={styles.colHeader}>
          <Text style={styles.colHeading}>{heading}</Text>
        </View>
        <Button
          style={{
            marginLeft: 5,
          }}
          mode="contained"
          color={
            mode === 'purchase' ? addStockButtonColor : removeStockButtonColor
          }
          onPress={() => {
            setAddOrRemoveStockModalVisible(true);
          }}>
          {mode === 'purchase' ? addStockButtonValue : removeStockButtonValue}
        </Button>
      </>
    );
  };

  const tableRowStyle =
    item.id === highlightedItemId
      ? {backgroundColor: colors.highlighted}
      : {
          backgroundColor: index % 2 === 0 ? 'none' : colors.neutralTint5,
        };
  const selectedMonthGrandTotalCost = item.selected_month_grand_total_cost || 0;
  const selectedMonthGrandTotalCostNet =
    item.selected_month_grand_total_cost_net || 0;
  const selectedMonthTotalRemovedStockCost =
    item.selected_month_total_removed_stock_cost || 0;
  const selectedMonthTotalRemovedStockCostNet =
    item.selected_month_total_removed_stock_cost_net || 0;
  const selectedMonthRevenueGroupTotalAmount =
    item.selected_month_revenue_group_total_amount || 0;
  const itemCostPercentage = selectedMonthRevenueGroupTotalAmount
    ? (selectedMonthTotalRemovedStockCostNet /
        selectedMonthRevenueGroupTotalAmount) *
      100
    : 0;
  const avgUnitCost = selectedMonthGrandTotalCost
    ? selectedMonthGrandTotalCost / (item.selected_month_grand_total_qty || 0)
    : 0;
  const avgUnitCostNet = selectedMonthGrandTotalCostNet
    ? selectedMonthGrandTotalCostNet /
      (item.selected_month_grand_total_qty || 0)
    : 0;

  return (
    <>
      <Portal>
        <Dialog visible={detailsDialogVisible} onDismiss={hideDialog}>
          <Dialog.Title>Item Name</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{item.item_name}</Paragraph>
          </Dialog.Content>
        </Dialog>
      </Portal>
      <Portal>
        <Modal
          visible={unitCostModalVisible}
          onDismiss={() => setUnitCostModalVisible(false)}
          contentContainerStyle={modalContainerStyle}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Update Unit Cost
          </Title>
          <TextInput label="Unit Cost" keyboardType="numeric" />
          <Button
            mode="contained"
            onPress={() => setUnitCostModalVisible(() => false)}
            style={{marginTop: 20}}>
            Save
          </Button>
          <Button
            onPress={() => setUnitCostModalVisible(() => false)}
            style={{marginTop: 10}}>
            Cancel
          </Button>
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={addOrRemoveStockModalVisible}
          onDismiss={() => setAddOrRemoveStockModalVisible(false)}
          contentContainerStyle={modalContainerStyle}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            {mode === 'purchase'
              ? 'Enter Number of Stock to Purchase'
              : 'Enter Number of Used Stocks'}
          </Title>
          {mode === 'purchase' ? (
            <BatchPurchaseAddStockForm
              item={item}
              onSubmit={handleSubmit}
              onCancel={() => setAddOrRemoveStockModalVisible(() => false)}
            />
          ) : (
            <BatchStockUsageRemoveStockForm
              item={item}
              onSubmit={handleSubmit}
              onCancel={() => setAddOrRemoveStockModalVisible(() => false)}
            />
          )}
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={endingInventoryModalVisible}
          onDismiss={() => setEndingInventoryModalVisible(false)}
          contentContainerStyle={modalContainerStyle}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            {'Enter Ending Inventory'}
          </Title>
          <EndingInventoryForm
            item={item}
            monthYearDateFilter={monthYearDateFilter}
            onSubmit={handleSubmit}
            onCancel={() => setEndingInventoryModalVisible(false)}
            onDismiss={() => setEndingInventoryModalVisible(false)}
          />
        </Modal>
      </Portal>
      <Surface style={[styles.container, {borderColor: colors.neutralTint4}]}>
        <View style={styles.header}>
          <Pressable style={{flex: 1}} onPress={showDialog}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: colors.dark,
                marginRight: 10,
              }}
              numberOfLines={1}>
              {item.item_name}
            </Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <DataTable style={[styles.table, {backgroundColor: colors.surface}]}>
            <DataTable.Header>
              <DataTable.Title style={styles.tableColumn}>
                Beginning Inventory
              </DataTable.Title>
              <DataTable.Title style={styles.tableColumn} numeric>
                Added Stocks
              </DataTable.Title>
              <DataTable.Title style={styles.tableColumn} numeric>
                Ending Inventory
              </DataTable.Title>
            </DataTable.Header>

            <DataTable.Row style={[tableRowStyle]}>
              <DataTable.Cell>{`${
                item.previous_month_grand_total_qty || 0
              } ${formatUOMAbbrev(item.item_uom_abbrev)}`}</DataTable.Cell>
              <DataTable.Cell
                numeric
                style={styles.dataTableCell}
                onPress={() => {
                  navigation.navigate(routes.itemAddedStocks(), {
                    item_id: item.id,
                    month_year_date_filter: monthYearDateFilter,
                  });
                }}>
                <Text
                  style={[
                    styles.dataTableCellText,
                    {color: colors.primary},
                  ]}>{`${
                  item.selected_month_total_added_stock_qty || 0
                } ${formatUOMAbbrev(item.item_uom_abbrev)}`}</Text>
              </DataTable.Cell>
              <DataTable.Cell
                numeric
                style={[
                  styles.dataTableCell,
                  {
                    borderWidth: 1,
                    marginLeft: 7,
                    borderRadius: 4,
                    marginVertical: 5,
                  },
                ]}
                onPress={() => {
                  setEndingInventoryModalVisible(true);
                }}>{`${
                item.selected_month_grand_total_qty || 0
              } ${formatUOMAbbrev(item.item_uom_abbrev)}`}</DataTable.Cell>
            </DataTable.Row>
          </DataTable>
        </View>
        {/* <View style={[styles.footer, {backgroundColor: colors.neutralTint5}]}>
          <Text style={{fontWeight: 'bold'}}>Total Cost</Text>
          <Text
            style={{
              marginLeft: 'auto',
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${currencySymbol} ${commaNumber(totalCost.toFixed(2))}`}
          </Text>
        </View> */}
      </Surface>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 5,
    padding: 10,
    width: '100%',
    backgroundColor: 'white',
    elevation: 5,
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
  dataTableCell: {
    paddingRight: 7,
  },
  dataTableCellText: {
    fontWeight: 'bold',
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

export default ItemEndingInventoryListItem;
