import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {StyleSheet, Text, View, BackHandler} from 'react-native';
import {
  Button,
  useTheme,
  Paragraph,
  Dialog,
  Portal,
  Provider,
} from 'react-native-paper';
import {Tabs, TabScreen} from 'react-native-paper-tabs';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import routes from '../constants/routes';
import ItemStockSummary from '../components/items/ItemStockSummary';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import OptionsList from '../components/buttons/OptionsList';
import {getItem, deleteItem} from '../localDbQueries/items';
import {getItemInventoryLogsGrandTotal} from '../localDbQueries/inventoryLogs';
import Entries from '../components/purchases/Entries';
import ItemLogList from '../components/items/ItemLogList';
import GrandTotal from '../components/purchases/GrandTotal';

const ItemView = props => {
  const {backAction} = props;
  const {colors} = useTheme();
  const route = useRoute();
  const itemId = route.params?.item_id;
  const viewMode = route.params?.viewMode;
  const {status, data} = useQuery(['item', {id: itemId}], getItem);
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const deleteItemMutation = useMutation(deleteItem, {
    onSuccess: () => {
      queryClient.invalidateQueries('items');
      navigation.goBack();
    },
  });
  const item = data?.result;
  const purchaseEntriesFilter = {
    'items.id': itemId,
    'items.category_id': item?.category_id,
    'operations.id': 2, // Operation id 2 is equal to: Add stock - New Purchase (inventory operation)
  };
  const stockUsageEntriesFilter = {
    'items.id': itemId,
    'items.category_id': item?.category_id,
    'operations.id': 6, // Operation id 6 is equal to: Remove stock - Stock Usage (inventory operation)
  };
  /**
   * NOTE: Previous version has seperate database query
   * to get item's grand total. This line of code can be
   * removed permanently in the future release.
   */
  // const {
  //   status: itemInventoryLogsGrandTotalStatus,
  //   data: itemInventoryLogsGrandTotalData,
  // } = useQuery(
  //   [
  //     'itemInventoryLogsGrandTotal',
  //     {filter: {'items.id': itemId, 'items.category_id': item?.category_id}},
  //   ],
  //   getItemInventoryLogsGrandTotal,
  //   {enabled: item ? true : false},
  // );

  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const showDeleteDialog = () => setDeleteDialogVisible(true);

  const hideDeleteDialog = () => setDeleteDialogVisible(false);

  const itemOptions = [
    {
      label: 'Manage Stock',
      icon: 'text-box-check-outline',
      handler: () => {
        navigation.navigate('ManageStock', {item_id: itemId});
        closeOptionsBottomSheet();
      },
    },
    /**
     * Uncomment code below to add View Puchase Entries option
     */
    // {
    //   label: 'View Purchase Entries',
    //   icon: 'basket-fill',
    //   handler: () => {
    //     navigation.navigate(routes.itemPurchaseEntries(), {
    //       item_id: itemId,
    //     });
    //     closeOptionsBottomSheet();
    //   },
    // },
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        navigation.navigate(routes.editItem(), {item_id: itemId});
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Delete',
      labelColor: colors.notification,
      icon: 'delete-outline',
      iconColor: colors.notification,
      handler: () => {
        showDeleteDialog();
        closeOptionsBottomSheet();
      },
    },
  ];

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        backAction && backAction();
        closeOptionsBottomSheet();
      },
    );

    return () => backHandler.remove();
  }, []);

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, itemOptions.length * 75 + 30],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmDeleteItem = async () => {
    try {
      await deleteItemMutation.mutateAsync({
        id: itemId,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      hideDeleteDialog();
    }
  };

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const renderBottomSheetBackdrop = useCallback(
    props => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={1}
      />
    ),
    [],
  );

  const renderOptions = () => {
    return (
      <BottomSheetView style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Item options'}
        </Text>
        <OptionsList options={itemOptions} />
      </BottomSheetView>
    );
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

  if (!item) return null;

  const deleteDialog = (
    <Portal>
      <Dialog visible={deleteDialogVisible} onDismiss={hideDeleteDialog}>
        <Dialog.Title>Delete item?</Dialog.Title>
        <Dialog.Content>
          <Paragraph>
            Are you sure you want to delete the item from inventory? You can't
            undo this action.
          </Paragraph>
        </Dialog.Content>
        <Dialog.Actions style={{justifyContent: 'space-around'}}>
          <Button onPress={hideDeleteDialog}>Cancel</Button>
          <Button
            icon={'delete-outline'}
            onPress={handleConfirmDeleteItem}
            color={colors.notification}>
            Delete item
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  if (viewMode === 'purchases') {
    return (
      <>
        {deleteDialog}
        <View style={styles.container}>
          {item && (
            <ItemStockSummary
              item={item}
              containerStyle={{marginBottom: 9}}
              onPressItemOptions={openOptionsBottomSheet}
            />
          )}
          <View
            style={{
              justifyContent: 'center',
              paddingHorizontal: 20,
              paddingVertical: 18,
              borderBottomWidth: 2,
              borderColor: colors.background,
              backgroundColor: colors.surface,
            }}>
            <Text style={{fontWeight: 'bold'}}>Purchases</Text>
          </View>
          <Entries
            filter={purchaseEntriesFilter}
            totalLabel="Total Purchases"
          />
        </View>
        <BottomSheetModal
          ref={optionsBottomSheetModalRef}
          index={1}
          snapPoints={optionsBottomSheetSnapPoints}
          backdropComponent={renderBottomSheetBackdrop}
          onChange={handleBottomSheetChange}>
          {renderOptions()}
        </BottomSheetModal>
      </>
    );
  }

  return (
    <>
      {deleteDialog}
      <View style={styles.container}>
        {item && (
          <ItemStockSummary
            item={item}
            containerStyle={{marginBottom: 9}}
            onPressItemOptions={openOptionsBottomSheet}
          />
        )}
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
          // disableSwipe={false} // (default=false) disable swipe to left/right gestures
        >
          <TabScreen label="Item Logs">
            <>
              <ItemLogList filter={{'items.id': itemId}} />
              <GrandTotal
                label="Grand Total (Net)"
                value={item?.current_stock_cost_net || 0}
              />
            </>
          </TabScreen>
          <TabScreen label="Purchases">
            <Entries
              entryType="purchase"
              filter={purchaseEntriesFilter}
              totalLabel="Total Purchases"
              showTotal={false}
            />
          </TabScreen>
          <TabScreen label="Stock Usage">
            <Entries
              entryType="stock-usage"
              filter={stockUsageEntriesFilter}
              totalLabel="Total Stock Usage"
              showTotal={false}
            />
          </TabScreen>
        </Tabs>
      </View>
      {/* <GrandTotal value={item?.current_stock_cost || 0} /> */}
      <BottomSheetModal
        ref={optionsBottomSheetModalRef}
        index={1}
        snapPoints={optionsBottomSheetSnapPoints}
        backdropComponent={renderBottomSheetBackdrop}
        onChange={handleBottomSheetChange}>
        {renderOptions()}
      </BottomSheetModal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default ItemView;
