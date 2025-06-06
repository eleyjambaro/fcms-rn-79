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

import VendorListItem from './VendorListItem';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import VendorForm from '../forms/VendorForm';
import {
  deleteVendor,
  getVendors,
  updateVendor,
} from '../../localDbQueries/vendors';

const VendorList = props => {
  const {backAction, viewMode, filter} = props;
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
  } = useInfiniteQuery(['vendors', {filter}], getVendors, {
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
  const updateVendorMutation = useMutation(updateVendor, {
    onSuccess: () => {
      queryClient.invalidateQueries('vendors');
    },
  });
  const deleteVendorMutation = useMutation(deleteVendor, {
    onSuccess: () => {
      queryClient.invalidateQueries('vendors');
    },
  });

  const [updateVendorModalVisible, setUpdateVendorModalVisible] =
    useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const showUpdateVendorModal = () => setUpdateVendorModalVisible(true);
  const hideUpdateVendorModal = () => setUpdateVendorModalVisible(false);

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
    hideUpdateVendorModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await updateVendorMutation.mutateAsync({
        id: focusedItem?.id,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideUpdateVendorModal();
    }
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const vendorOptions = [
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        showUpdateVendorModal();
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
    () => [120, vendorOptions.length * 80 + 70],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmDeleteVendor = async () => {
    try {
      await deleteVendorMutation.mutateAsync({
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
          {'Vendor options'}
        </Text>
        <OptionsList options={vendorOptions} />
      </BottomSheetView>
    );
  };

  const renderItem = ({item}) => {
    return (
      <VendorListItem
        item={item}
        onPressItem={() => {
          setFocusedItem(() => item);

          // Reference code from categories
          // if (viewMode === 'purchases') {
          //   navigation.navigate(routes.purchaseCategoryView(), {
          //     category_id: item.id,
          //   });
          // } else if (viewMode === 'manage-taxes') {
          //   showUpdateVendorModal();
          // } else {
          //   navigation.navigate(routes.categoryView(), {
          //     category_id: item.id,
          //   });
          // }

          if (viewMode === 'list') {
            showUpdateVendorModal();
          }

          if (viewMode === 'manage-vendors') {
            showUpdateVendorModal();
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
          visible={updateVendorModalVisible}
          onDismiss={() => setUpdateVendorModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Update Vendor
          </Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            <VendorForm
              editMode={true}
              initialValues={{
                first_name: focusedItem?.first_name || '',
                last_name: focusedItem?.last_name || '',
                company_name: focusedItem?.company_name || '',
                vendor_display_name: focusedItem?.vendor_display_name || '',
                tin: focusedItem?.tin || '',
                email: focusedItem?.email || '',
                phone_number: focusedItem?.phone_number || '',
                mobile_number: focusedItem?.mobile_number || '',
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
          <Dialog.Title>Delete vendor?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete vendor? You can't undo this
              action.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteVendor}
              color={colors.notification}>
              Delete vendor
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

export default VendorList;
