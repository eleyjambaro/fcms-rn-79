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

import BatchPurchaseAddStockForm from '../forms/BatchPurchaseAddStockForm';
import {createBatchPurchaseEntry} from '../../localDbQueries/batchPurchase';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const PurchaseListItem = props => {
  const {item, onDismiss} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const [detailsDialogVisible, setDetailsDialogVisible] = useState(false);
  const [unitCostModalVisible, setUnitCostModalVisible] = useState(false);
  const [addStockModalVisible, setAddStockModalVisible] = useState(false);
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

  const hideDialog = () => setDetailsDialogVisible(false);

  const showDialog = () => setDetailsDialogVisible(true);

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await createBatchPurchaseEntryMutation.mutateAsync({
        values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      setAddStockModalVisible(false);
    }
  };

  const modalContainerStyle = {backgroundColor: 'white', padding: 20};

  if (!item) return null;

  const totalCost = item.total_cost?.toFixed(2);

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
          visible={addStockModalVisible}
          onDismiss={() => setAddStockModalVisible(false)}
          contentContainerStyle={modalContainerStyle}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Add Number of Stocks Quantity to Purchase
          </Title>
          {/* <TextInput label="Purchase Quantity" keyboardType="numeric" />
          <Button
            mode="contained"
            onPress={() => setAddStockModalVisible(() => false)}
            style={{marginTop: 20}}>
            Save
          </Button>
          <Button
            onPress={() => setAddStockModalVisible(() => false)}
            style={{marginTop: 10}}>
            Cancel
          </Button> */}
          <BatchPurchaseAddStockForm
            item={item}
            onSubmit={handleSubmit}
            onCancel={() => setAddStockModalVisible(false)}
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
                    ? colors.notification
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
                    ? colors.notification
                    : colors.neutralTint2,
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
              }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color:
                    item.current_stock_qty <= item.low_stock_level &&
                    colors.notification,
                }}>{`${item.current_stock_qty} ${formatUOMAbbrev(
                item.uom_abbrev,
              )}`}</Text>
            </View>
          </View>
        </View>
        <View style={styles.body}>
          <View style={styles.col}>
            <View style={styles.colHeader}>
              <Text style={styles.colHeading}>Unit cost</Text>
            </View>
            <Pressable
              style={styles.costFrame}
              onPress={() => {
                // setUnitCostModalVisible(true)
              }}>
              <Text style={styles.costText}>{`${currencySymbol} ${
                item.add_stock_unit_cost?.toFixed(2) ||
                item.unit_cost?.toFixed(2)
              }`}</Text>
            </Pressable>
          </View>
          <View style={styles.col}>
            <View style={styles.colHeader}>
              <Text style={styles.colHeading}>Add stock</Text>
            </View>
            <Button
              style={{
                marginLeft: 5,
              }}
              mode="contained"
              color={item.add_stock_qty > 0 ? colors.accent : colors.primary}
              onPress={() => {
                setAddStockModalVisible(true);
              }}>
              {item.add_stock_qty > 0
                ? `+ ${item.add_stock_qty} ${formatUOMAbbrev(item.uom_abbrev)}`
                : '+'}
            </Button>
          </View>
        </View>
        <View style={[styles.footer, {backgroundColor: colors.neutralTint5}]}>
          <Text style={{fontWeight: 'bold'}}>Total Cost</Text>
          <Text
            style={{
              marginLeft: 'auto',
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${currencySymbol} ${commaNumber(totalCost)}`}
          </Text>
        </View>
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
  },
});

export default PurchaseListItem;
