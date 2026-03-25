import React, {useState, useEffect, useRef} from 'react';
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
  TabsProvider,
} from 'react-native-paper-tabs';
import {
  useQuery,
  useQueryClient,
  useMutation,
  useQueryErrorResetBoundary,
} from '@tanstack/react-query';
import {useRoute, useFocusEffect} from '@react-navigation/native';

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
  const [currentTabIndex, setCurrentTabIndex] = useState(0);

  // Reset to Add tab when screen comes into focus (skip first mount)
  const isMounted = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      if (isMounted.current) {
        // Only reset if not first mount
        setCurrentTabIndex(0);
      } else {
        isMounted.current = true;
      }
    }, []),
  );

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

  const handleTabChange = newIndex => {
    // Prevent changing to Remove tab if fromEndingInventory
    if (fromEndingInventory && newIndex === 1) {
      return;
    }
    setCurrentTabIndex(newIndex);
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
        containerStyle={{marginBottom: 10}}
      />
      <TabsProvider defaultIndex={currentTabIndex}>
        <Tabs
          uppercase={false}
          style={{
            backgroundColor: colors.surface,
            borderBottomWidth: 2,
            borderBottomColor: colors.neutralTint5,
          }}
          disableSwipe={fromEndingInventory ? true : false}
          onChangeIndex={handleTabChange}>
          <TabScreen label="Add" icon="plus-box-outline">
            <KeyboardAvoidingView
              style={{flex: 1, backgroundColor: 'white', padding: 10}}>
              <ScrollView
                style={{flex: 1}}
                showsVerticalScrollIndicator={false}>
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
              <ScrollView
                style={{flex: 1}}
                showsVerticalScrollIndicator={false}>
                <RemoveStockForm
                  itemId={itemId}
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                />
              </ScrollView>
            </KeyboardAvoidingView>
          </TabScreen>
        </Tabs>
      </TabsProvider>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ManageStock;
