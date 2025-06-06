import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TouchableOpacity,
  BackHandler,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
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
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import PrinterListItem from './PrinterListItem';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import PrinterForm from '../forms/PrinterForm';
import {
  deletePrinter,
  getPrinters,
  setDefaultPrinter,
  updatePrinter,
} from '../../localDbQueries/printers';

const PrinterList = props => {
  const {backAction, defaultPrinter, viewMode, filter} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [focusedItem, setFocusedItem] = useState(null);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(['printers', {filter}], getPrinters, {
    getNextPageParam: (lastPage, pages) => {
      let pagesResult = [];

      for (let page of pages) {
        pagesResult.push(...page.result);
      }

      if (pagesResult.length < lastPage.totalCount) {
        return lastPage.page + 1;
      }
    },
    networkMode: 'always',
  });
  const queryClient = useQueryClient();
  const updatePrinterMutation = useMutation(updatePrinter, {
    onSuccess: () => {
      queryClient.invalidateQueries('printers');
    },
  });
  const deletePrinterMutation = useMutation(deletePrinter, {
    onSuccess: () => {
      queryClient.invalidateQueries('printers');
    },
  });
  const setDefaultPrinterMutation = useMutation(setDefaultPrinter, {
    onSuccess: () => {
      queryClient.invalidateQueries('defaultPrinter');
    },
  });

  const [updatePrinterModalVisible, setUpdatePrinterModalVisible] =
    useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const showUpdatePrinterModal = () => setUpdatePrinterModalVisible(true);
  const hideUpdatePrinterModal = () => setUpdatePrinterModalVisible(false);

  const showDeleteDialog = () => setDeleteDialogVisible(true);
  const hideDeleteDialog = () => setDeleteDialogVisible(false);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (data.pages) {
      for (let page of data.pages) {
        pagesData.push(...page.result);
      }
    }

    return pagesData;
  };

  const handleCancel = () => {
    hideUpdatePrinterModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await updatePrinterMutation.mutateAsync({
        id: focusedItem?.id,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideUpdatePrinterModal();
    }
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const printerOptions = [
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        showUpdatePrinterModal();
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Set as default printer',
      icon: 'printer-outline',
      handler: async () => {
        if (!focusedItem) return;

        try {
          await setDefaultPrinterMutation.mutateAsync({
            id: focusedItem?.id,
          });
        } catch (error) {
          console.debug(error);
        } finally {
          closeOptionsBottomSheet();
        }
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
    () => [120, printerOptions.length * 80 + 30],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmDeletePrinter = async () => {
    try {
      await deletePrinterMutation.mutateAsync({
        id: focusedItem.id,
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
          {'Printer options'}
        </Text>
        <OptionsList options={printerOptions} />
      </BottomSheetView>
    );
  };

  const renderItem = ({item}) => {
    return (
      <PrinterListItem
        item={item}
        isDefaultPrinter={defaultPrinter && defaultPrinter.id === item.id}
        onPressItem={() => {
          setFocusedItem(() => item);

          if (viewMode === 'list') {
            showUpdatePrinterModal();
          }

          if (viewMode === 'manage-printers') {
            showUpdatePrinterModal();
          }
        }}
        onPressItemOptions={() => {
          setFocusedItem(() => item);
          openOptionsBottomSheet();
        }}
      />
    );
  };

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
    <>
      <Portal>
        <Modal
          visible={updatePrinterModalVisible}
          onDismiss={() => setUpdatePrinterModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Update Printer
          </Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            <PrinterForm
              editMode={true}
              initialValues={{
                display_name: focusedItem?.display_name || '',
                device_name: focusedItem?.device_name || '',
                inner_mac_address: focusedItem?.inner_mac_address || '',
              }}
              submitButtonTitle="Update"
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </ScrollView>
        </Modal>
      </Portal>
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={hideDeleteDialog}>
          <Dialog.Title>Delete printer?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>Are you sure you want to delete printer?</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeletePrinter}
              color={colors.notification}>
              Delete printer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <FlatList
        style={{backgroundColor: colors.surface}}
        data={getAllPagesData()}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              padding: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text>No data to display</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            colors={[colors.primary, colors.accent, colors.dark]}
          />
        }
      />
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
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default PrinterList;
