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
import {useRoute} from '@react-navigation/native';

import ItemStockSummary from '../components/items/ItemStockSummary';
import AddStockForm from '../components/forms/AddStockForm';
import RemoveStockForm from '../components/forms/RemoveStockForm';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import {getItem, deleteItem} from '../localDbQueries/items';
import {addInventoryLog} from '../localDbQueries/inventoryLogs';

const ManageStock = props => {
  const {navigation} = props;
  const route = useRoute();
  const itemId = route.params?.item_id;
  const adjustmentQty = route.params?.adjustment_qty;
  const monthYearDate = route.params?.month_year_date;
  const operationID = route.params?.operation_id;
  const fromEndingInventory = route.params?.from_ending_inventory;
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const {status, data} = useQuery(['item', {id: itemId}], getItem);
  const [showItemStockDetails, setShowItemStockDetails] = useState(false);
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const addInventoryLogMutation = useMutation(addInventoryLog, {
    onSuccess: () => {
      queryClient.invalidateQueries('inventoryLogs');
      queryClient.invalidateQueries('items');
      queryClient.invalidateQueries(['item', {id: itemId}]);
      queryClient.invalidateQueries('itemAvgUnitCost');
    },
  });

  const handleSubmit = async (values, actions) => {
    console.log(values);

    try {
      await addInventoryLogMutation.mutateAsync({
        log: values,
        onError: ({errorMessage}) => {
          actions.setFieldError('adjustment_qty', errorMessage);
        },
        onLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: () => {
          actions.resetForm();
          navigation.goBack();
        },
      });
    } catch (error) {
      console.debug(error);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (!itemId) return null;

  if (status === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const item = data.result;

  if (!item) return null;

  return (
    <View style={styles.container}>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <ItemStockSummary
        item={item}
        showActions={false}
        showStockDetails={showItemStockDetails}
        showItemOptionsButton={false}
      />
      <Tabs
        // defaultIndex={0} // default = 0
        uppercase={false} // true/false | default=true | labels are uppercase
        // showTextLabel={false} // true/false | default=false (KEEP PROVIDING LABEL WE USE IT AS KEY INTERNALLY + SCREEN READERS)
        // iconPosition // leading, top | default=leading
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 2,
          borderBottomColor: colors.neutralTint5,
        }} // works the same as AppBar in react-native-paper
        // dark={false} // works the same as AppBar in react-native-paper
        // theme={} // works the same as AppBar in react-native-paper
        // mode="scrollable" // fixed, scrollable | default=fixed
        // onChangeIndex={(newIndex) => {}} // react on index change
        // showLeadingSpace={true} //  (default=true) show leading space in scrollable tabs inside the header
        disableSwipe={fromEndingInventory ? true : false} // (default=false) disable swipe to left/right gestures
      >
        <TabScreen label="Add" icon="plus-box-outline">
          <KeyboardAvoidingView
            style={{flex: 1, backgroundColor: 'white', padding: 10}}>
            <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
              <AddStockForm
                itemId={itemId}
                fromEndingInventory={fromEndingInventory}
                initialValues={{
                  adjustment_qty: adjustmentQty,
                  adjustment_date: monthYearDate,
                  operation_id: operationID,
                  cost_input_mode: 'unit_cost',
                }}
                onFocus={() => {
                  setShowItemStockDetails(() => false);
                }}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </TabScreen>
        <TabScreen
          label="Remove"
          icon="minus-box-outline"
          disabled={fromEndingInventory}>
          <KeyboardAvoidingView
            style={{flex: 1, backgroundColor: 'white', padding: 10}}>
            <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
              <RemoveStockForm
                itemId={itemId}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </TabScreen>
      </Tabs>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ManageStock;
