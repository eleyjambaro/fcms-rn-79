import React, {useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import {useTheme} from 'react-native-paper';
import {
  Tabs,
  TabScreen,
  useTabIndex,
  useTabNavigation,
} from 'react-native-paper-tabs';
import {
  useQuery,
  useQueryClient,
  useMutation,
  useQueryErrorResetBoundary,
} from '@tanstack/react-query';

import ItemStockSummary from '../components/items/ItemStockSummary';
import AddStockForm from '../components/forms/AddStockForm';
import RemoveStockForm from '../components/forms/RemoveStockForm';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {getItem, deleteItem} from '../localDbQueries/items';
import {
  addInventoryLog,
  getInventoryLog,
  updateInventoryLog,
} from '../localDbQueries/inventoryLogs';
import {useRoute} from '@react-navigation/native';

const UpdateInventoryLog = props => {
  const {navigation} = props;
  const route = useRoute();
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const itemId = route.params?.item_id;
  const logId = route.params?.log_id;

  const {status: getInventoryLogStatus, data: getInventoryLogData} = useQuery(
    ['inventoryLog', {id: logId}],
    getInventoryLog,
  );

  const [showItemStockDetails, setShowItemStockDetails] = useState(false);
  const updateInventoryLogMutation = useMutation(updateInventoryLog, {
    onSuccess: () => {
      queryClient.invalidateQueries(['inventoryLog', {id: logId}]);
      queryClient.invalidateQueries('inventoryLogs');
    },
  });

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await updateInventoryLogMutation.mutateAsync({
        id: logId,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      navigation.goBack();
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (!itemId || !logId) return null;

  if (getInventoryLogStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (getInventoryLogStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const log = getInventoryLogData?.result;

  const formInitValues = {
    operation_id: log.operation_id,
    adjustment_unit_cost: log.adjustment_unit_cost,
    adjustment_qty: log.adjustment_qty,
    cost_input_mode: log.item_uom_abbrev_per_piece ? 'total_cost' : 'unit_cost',
    adjustment_date: log.adjustment_date,
    beginning_inventory_date: log.beginning_inventory_date,
    official_receipt_number: log.official_receipt_number,
    remarks: log.remarks,
  };

  const tabsDefaultIndex = log.operation_type === 'add_stock' ? 0 : 1;

  let content = (
    <AddStockForm
      itemId={itemId}
      logId={logId}
      initialValues={formInitValues}
      editMode
      onFocus={() => {
        setShowItemStockDetails(() => false);
      }}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );

  if (log.operation_type === 'remove_stock') {
    content = (
      <RemoveStockForm
        itemId={itemId}
        logId={logId}
        initialValues={formInitValues}
        editMode
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{flex: 1, backgroundColor: 'white', padding: 10}}>
        <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default UpdateInventoryLog;
