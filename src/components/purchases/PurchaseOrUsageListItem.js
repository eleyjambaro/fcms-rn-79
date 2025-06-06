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
} from 'react-native-paper';
import commaNumber from 'comma-number';
import {useQueryClient, useMutation} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import BatchPurchaseAddStockForm from '../forms/BatchPurchaseAddStockForm';
import BatchStockUsageRemoveStockForm from '../forms/BatchStockUsageRemoveStockForm';
import {createBatchPurchaseEntry} from '../../localDbQueries/batchPurchase';
import {createBatchStockUsageEntry} from '../../localDbQueries/batchStockUsage';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const PurchaseOrUsageListItem = props => {
  const {item, isListRefetching, mode = 'purchase', onDismiss} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const [detailsDialogVisible, setDetailsDialogVisible] = useState(false);
  const [unitCostModalVisible, setUnitCostModalVisible] = useState(false);
  const [addOrRemoveStockModalVisible, setAddOrRemoveStockModalVisible] =
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

  const hideDialog = () => setDetailsDialogVisible(false);

  const showDialog = () => setDetailsDialogVisible(true);

  const modalContainerStyle = {
    backgroundColor: 'white',
    paddingVertical: 20,
    paddingHorizontal: 10,
  };

  if (!item) return null;

  const addStockTotalCost = parseFloat(item.total_cost || 0);
  const removeStockTotalCost = parseFloat(item.total_cost || 0);
  const totalCost =
    mode === 'purchase' ? addStockTotalCost : removeStockTotalCost;

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      if (mode === 'purchase') {
        await createBatchPurchaseEntryMutation.mutateAsync({
          values,
        });
      } else {
        // TODO: Refactor this validation by refactoring getItemsAndBatchPurchaseEntries query
        // and get accurate item's current stock qty
        if (values.remove_stock_qty > item.current_stock_qty) {
          actions.setFieldError(
            'remove_stock_qty',
            `Remove stock quantity cannot be greater than item's current stock quantity.`,
          );
          return;
        }
        await createBatchStockUsageEntryMutation.mutateAsync({
          values,
        });
      }
    } catch (error) {
      console.debug(error);
    }

    actions.resetForm();
    setAddOrRemoveStockModalVisible(() => false);
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
          <Text style={styles.costText}>{`${currencySymbol} ${commaNumber(
            parseFloat(cost || 0).toFixed(2),
          )}`}</Text>
        </Pressable>
      </>
    );
  };

  const renderAddOrRemoveStockButton = () => {
    const heading = mode === 'purchase' ? 'Add Stock to Cart' : 'Remove Stock';
    const addStockButtonValue =
      item.add_stock_qty > 0
        ? ` + ${commaNumber(item.add_stock_qty.toFixed(2))} ${formatUOMAbbrev(
            item.uom_abbrev,
          )}`
        : '+';
    const removeStockButtonValue =
      item.remove_stock_qty > 0
        ? `- ${commaNumber(item.remove_stock_qty.toFixed(2))} ${formatUOMAbbrev(
            item.uom_abbrev,
          )}`
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

  const renderTotalCost = () => {
    if (totalCost) {
      return (
        <View style={[styles.footer, {backgroundColor: colors.neutralTint5}]}>
          <MaterialCommunityIcons
            name="cart-outline"
            size={16}
            color={colors.dark}
            style={{marginRight: 5}}
          />
          <Text style={{fontWeight: 'bold'}}>Cart Total Amount</Text>
          <Text
            style={{
              marginLeft: 'auto',
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${currencySymbol} ${commaNumber(totalCost.toFixed(2))}`}
          </Text>
        </View>
      );
    } else {
      return null;
    }
  };

  return (
    <>
      <Portal>
        <Dialog visible={detailsDialogVisible} onDismiss={hideDialog}>
          <Dialog.Title>Item Name</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{item.name}</Paragraph>
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
              isListRefetching={isListRefetching}
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
              {item.name}
            </Text>
          </Pressable>
          <View style={styles.qtyContainer}>
            <View
              style={{
                justifyContent: 'center',
                padding: 4,
                backgroundColor:
                  item.current_stock_qty <= item.low_stock_level
                    ? colors.error
                    : colors.neutralTint2,
                borderTopLeftRadius: 4,
                borderBottomLeftRadius: 4,
              }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: 'white',
                  textAlign: 'center',
                }}>
                Current
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: 'white',
                  textAlign: 'center',
                }}>
                Qty
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                flex: 1,
                paddingHorizontal: 8,
                alignItems: 'center',
                borderWidth: 1,
                borderColor:
                  item.current_stock_qty <= item.low_stock_level
                    ? colors.error
                    : colors.neutralTint2,
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
              }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color:
                    item.current_stock_qty <= item.low_stock_level
                      ? colors.error
                      : colors.neutralTint2,
                }}>{`${commaNumber(
                parseFloat(item.current_stock_qty?.toFixed(2)) || 0,
              )} ${formatUOMAbbrev(item.uom_abbrev)}`}</Text>
            </View>
          </View>
        </View>
        <View style={styles.body}>
          <View style={styles.col}>{renderUnitCostOrAverageUnitCost()}</View>
          <View style={styles.col}>{renderAddOrRemoveStockButton()}</View>
        </View>
        {renderTotalCost()}
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
    alignItems: 'center',
  },
});

export default PurchaseOrUsageListItem;
