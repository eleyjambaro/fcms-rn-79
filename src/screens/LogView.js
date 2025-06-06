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
  Modal,
  Title,
} from 'react-native-paper';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import routes from '../constants/routes';
import ItemLogDetails from '../components/items/ItemLogDetails';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import OptionsList from '../components/buttons/OptionsList';
import {
  getInventoryLog,
  getYieldStockInventoryLogByYieldRefId,
  updateInventoryLogRemarks,
  voidInventoryLog,
} from '../localDbQueries/inventoryLogs';
import InventoryLogRemarksForm from '../components/forms/InventoryLogRemarksForm';

const LogView = props => {
  const {backAction} = props;
  const {colors} = useTheme();
  const route = useRoute();
  const logId = route.params?.log_id;
  const itemId = route.params.item_id;

  const {status, data} = useQuery(
    ['inventoryLog', {id: logId}],
    getInventoryLog,
  );

  const [yieldStockLogYieldRefId, setYieldStockLogYieldRefId] = useState(null);

  /**
   * Get the yield stock if the removed stock is used in recipe yield
   */
  const {
    isLoading: getYieldStockLogIsLoading,
    status: getYieldStockLogStatus,
    data: getYieldStockLogData,
    refetch: refetchYieldStockLog,
  } = useQuery(
    ['inventoryYieldStockLog', {yieldRefId: yieldStockLogYieldRefId}],
    getYieldStockInventoryLogByYieldRefId,
    {
      enabled: yieldStockLogYieldRefId ? true : false,
    },
  );

  const [isUpdateLogOptionDisabled, setIsUpdateLogOptionDisabled] =
    useState(false);
  const [isVoidLogOptionDisabled, setIsVoidLogOptionDisabled] = useState(false);
  const [voidDialogVisible, setVoidDialogVisible] = useState(false);
  const [unableToVoidDialogVisible, setUnableToVoidDialogVisible] =
    useState(false);

  useEffect(() => {
    const log = data?.result;
    if (log) {
      if (
        // disable 'Update Log' option:
        // on any remove_stock operation
        log.operation_type === 'remove_stock' ||
        // on New Yield Stock (id: 11)
        (log.operation_type === 'add_stock' &&
          parseInt(log.operation_id) === 11)
      ) {
        setIsUpdateLogOptionDisabled(() => true);
      }

      if (
        // disable 'Void Log' option:
        // on Pre-App Stock
        parseInt(log.operation_id) === 1
      ) {
        setIsVoidLogOptionDisabled(() => true);
      }

      if (log.voided) {
        setIsUpdateLogOptionDisabled(() => true);
        setIsVoidLogOptionDisabled(() => true);
      }
    }
  }, [data]);

  useEffect(() => {
    const log = data?.result;
    const yieldStockLog = getYieldStockLogData?.result;

    if (
      log &&
      log.operation_type === 'remove_stock' &&
      log.yield_ref_id &&
      log.recipe_id &&
      !yieldStockLog
    ) {
      setYieldStockLogYieldRefId(() => log.yield_ref_id);
      refetchYieldStockLog();
    }
  }, [data, getYieldStockLogData]);

  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const updateInventoryLogRemarksMutation = useMutation(
    updateInventoryLogRemarks,
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['inventoryLog', {id: logId}]);
        queryClient.invalidateQueries('inventoryLogs');
      },
    },
  );
  const voidInventoryLogMutation = useMutation(voidInventoryLog, {
    onSuccess: () => {
      queryClient.invalidateQueries('inventoryLogs');
    },
  });

  const [updateLogRemarksModalVisible, setUpdateLogRemarksModalVisible] =
    useState(false);

  const showUpdateLogRemarksModal = () => setUpdateLogRemarksModalVisible(true);
  const hideUpdateLogRemarksModal = () =>
    setUpdateLogRemarksModalVisible(false);

  const options = [
    {
      label: 'Update Log',
      icon: 'pencil-outline',
      handler: () => {
        navigation.navigate(routes.updateInventoryLog(), {
          log_id: logId,
          item_id: itemId,
        });
        closeOptionsBottomSheet();
      },
      disabled: isUpdateLogOptionDisabled,
      iconColor: isUpdateLogOptionDisabled ? colors.disabled : null,
    },
    {
      label: 'Edit Remarks',
      icon: 'note-edit-outline',
      handler: () => {
        showUpdateLogRemarksModal();
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Void',
      labelColor: colors.notification,
      icon: 'delete-alert-outline',

      handler: () => {
        if (
          log.operation_type === 'remove_stock' &&
          log.yield_ref_id &&
          log.recipe_id &&
          yieldStockLog
        ) {
          if (yieldStockLog.voided) {
            setVoidDialogVisible(() => true);
            closeOptionsBottomSheet();
          } else {
            setUnableToVoidDialogVisible(() => true);
            closeOptionsBottomSheet();
          }

          return;
        }

        setVoidDialogVisible(() => true);
        closeOptionsBottomSheet();
      },
      disabled: isVoidLogOptionDisabled,
      iconColor: isVoidLogOptionDisabled
        ? colors.disabled
        : colors.notification,
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
    () => [120, options.length * 75 + 60],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await updateInventoryLogRemarksMutation.mutateAsync({
        id: logId,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideUpdateLogRemarksModal();
    }
  };

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const handleConfirmVoidInventoryLog = async () => {
    try {
      await voidInventoryLogMutation.mutateAsync({
        id: logId,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      setVoidDialogVisible(() => false);
    }
  };

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

  const renderOptions = (status, data) => {
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

    return (
      <BottomSheetView style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Options'}
        </Text>
        <OptionsList options={options} />
      </BottomSheetView>
    );
  };

  const renderYieldStockLog = () => {
    const yieldStockLog = getYieldStockLogData?.result;

    if (!yieldStockLog) return null;

    let content = (
      <>
        <View
          style={{
            backgroundColor: colors.neutralTint5,
            borderRadius: 15,
            padding: 10,
            paddingVertical: 15,
          }}>
          <Text style={{fontSize: 12, fontWeight: 'bold'}}>
            {yieldStockLog.yield_ref_id}
          </Text>
          <Text style={{fontSize: 16, color: colors.dark}}>
            {yieldStockLog.operation_name}
          </Text>
          <Text
            style={{fontSize: 18, color: colors.dark, fontWeight: 'bold'}}
            numberOfLines={4}>
            {yieldStockLog.item_name}
          </Text>
        </View>
        <View style={{marginTop: 20}}>
          <Button
            mode="contained"
            loading={getYieldStockLogIsLoading}
            disabled={getYieldStockLogIsLoading}
            onPress={() => {
              setUnableToVoidDialogVisible(() => false);
              navigation.navigate(routes.logView(), {log_id: yieldStockLog.id});
            }}>
            Go to the Yield Stock
          </Button>
        </View>
      </>
    );

    if (getYieldStockLogStatus === 'error') {
      content = (
        <Text
          style={{
            fontStyle: 'italic',
          }}>{`Something went wrong while fetching yield stock log.`}</Text>
      );
    }

    return <View style={{marginTop: 15}}>{content}</View>;
  };

  if (!logId) return null;

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

  const log = data?.result;
  const yieldStockLog = getYieldStockLogData?.result;

  if (!log) return null;

  const remarksFormInitialValues = {
    remarks: log.remarks || '',
  };

  return (
    <>
      <Portal>
        <Modal
          visible={updateLogRemarksModalVisible}
          onDismiss={hideUpdateLogRemarksModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Log Remarks
          </Title>
          <InventoryLogRemarksForm
            initialValues={remarksFormInitialValues}
            autoFocus
            onSubmit={handleSubmit}
            onCancel={hideUpdateLogRemarksModal}
          />
        </Modal>
      </Portal>
      <Portal>
        <Dialog
          visible={voidDialogVisible}
          onDismiss={() => setVoidDialogVisible(() => false)}>
          <Dialog.Title>Void inventory operation?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to void this inventory operation? You cannot
              undo this action.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={() => setVoidDialogVisible(() => false)}>
              Cancel
            </Button>
            <Button
              icon={'delete-alert-outline'}
              onPress={handleConfirmVoidInventoryLog}
              color={colors.notification}>
              Void
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={unableToVoidDialogVisible}
          onDismiss={() => setUnableToVoidDialogVisible(() => false)}>
          <Dialog.Title>Unable to Void</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Stock used in recipe yield cannot be voided. To void this
              transaction, you should void the yield stock instead:
            </Paragraph>
            {renderYieldStockLog()}
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={() => setUnableToVoidDialogVisible(() => false)}>
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <View style={styles.container}>
        {log && (
          <ItemLogDetails
            log={log}
            containerStyle={{marginBottom: 0}}
            onPressItemOptions={openOptionsBottomSheet}
            onPressEditRemarks={showUpdateLogRemarksModal}
          />
        )}
      </View>
      <BottomSheetModal
        ref={optionsBottomSheetModalRef}
        index={1}
        snapPoints={optionsBottomSheetSnapPoints}
        backdropComponent={renderBottomSheetBackdrop}
        onChange={handleBottomSheetChange}>
        {renderOptions(status, data)}
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

export default LogView;
