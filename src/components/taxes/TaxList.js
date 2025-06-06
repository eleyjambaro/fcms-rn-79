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

import TaxListItem from './TaxListItem';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import TaxForm from '../forms/TaxForm';
import {deleteTax, getTaxes, updateTax} from '../../localDbQueries/taxes';

const TaxList = props => {
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
  } = useInfiniteQuery(['taxes', {filter}], getTaxes, {
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
  const updateTaxMutation = useMutation(updateTax, {
    onSuccess: () => {
      queryClient.invalidateQueries('taxes');
    },
  });
  const deleteTaxMutation = useMutation(deleteTax, {
    onSuccess: () => {
      queryClient.invalidateQueries('taxes');
    },
  });

  const [updateTaxModalVisible, setUpdateTaxModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const showUpdateTaxModal = () => setUpdateTaxModalVisible(true);
  const hideUpdateTaxModal = () => setUpdateTaxModalVisible(false);

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
    hideUpdateTaxModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await updateTaxMutation.mutateAsync({
        id: focusedItem?.id,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideUpdateTaxModal();
    }
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const taxOptions = [
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        showUpdateTaxModal();
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
    () => [120, taxOptions.length * 80 + 70],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmDeleteCategory = async () => {
    try {
      await deleteTaxMutation.mutateAsync({
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
          {'Tax options'}
        </Text>
        <OptionsList options={taxOptions} />
      </BottomSheetView>
    );
  };

  const renderItem = ({item}) => {
    return (
      <TaxListItem
        item={item}
        onPressItem={() => {
          setFocusedItem(() => item);

          // Reference code from categories
          // if (viewMode === 'purchases') {
          //   navigation.navigate(routes.purchaseCategoryView(), {
          //     category_id: item.id,
          //   });
          // } else if (viewMode === 'manage-taxes') {
          //   showUpdateTaxModal();
          // } else {
          //   navigation.navigate(routes.categoryView(), {
          //     category_id: item.id,
          //   });
          // }

          if (viewMode === 'manage-taxes') {
            showUpdateTaxModal();
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
          visible={updateTaxModalVisible}
          onDismiss={() => setUpdateTaxModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Update Tax
          </Title>
          <TaxForm
            editMode={true}
            initialValues={{
              name: focusedItem?.name || '',
              rate_percentage: focusedItem?.rate_percentage?.toString() || '',
            }}
            submitButtonTitle="Update"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </Modal>
      </Portal>
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={hideDeleteDialog}>
          <Dialog.Title>Delete tax?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete tax? You can't undo this action.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteCategory}
              color={colors.notification}>
              Delete tax
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

export default TaxList;
