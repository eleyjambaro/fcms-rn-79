import React, {useState, useRef, useMemo, useCallback} from 'react';
import {StyleSheet, Text, View, FlatList, Pressable, RefreshControl} from 'react-native';
import {
  Button,
  useTheme,
  Paragraph,
  Dialog,
  Portal,
  Modal,
  Title,
} from 'react-native-paper';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {useInfiniteQuery, useQueryClient, useMutation} from '@tanstack/react-query';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import {
  getRevenueSources,
  createRevenueSource,
  updateRevenueSource,
  deleteRevenueSource,
} from '../../localDbQueries/revenues';
import RevenueSourceForm from '../forms/RevenueSourceForm';
import OptionsList from '../buttons/OptionsList';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import ListEmpty from '../../components/stateIndicators/ListEmpty';
import TestModeLimitModal from '../modals/TestModeLimitModal';
import ErrorMessageModal from '../modals/ErrorMessageModal';

const RevenueSourceList = () => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const [focusedItem, setFocusedItem] = useState(null);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch,
    isRefetching,
  } = useInfiniteQuery(['revenueSources', {scope: 'manage'}], getRevenueSources, {
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

  const createRevenueSourceMutation = useMutation(createRevenueSource, {
    onSuccess: () => queryClient.invalidateQueries('revenueSources'),
  });
  const updateRevenueSourceMutation = useMutation(updateRevenueSource, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueSources');
      queryClient.invalidateQueries('revenueEntries');
    },
  });
  const deleteRevenueSourceMutation = useMutation(deleteRevenueSource, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueSources');
      queryClient.invalidateQueries('revenueGroups');
      queryClient.invalidateQueries('revenueGroupsGrandTotal');
      queryClient.invalidateQueries('revenueEntries');
    },
  });

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const optionsBottomSheetModalRef = useRef(null);
  const itemOptions = [
    {
      label: `Rename ${focusedItem?.name || ''} source`,
      icon: 'pencil-outline',
      handler: () => {
        setUpdateModalVisible(true);
        optionsBottomSheetModalRef.current?.dismiss();
      },
    },
    {
      label: 'Delete',
      labelColor: colors.notification,
      icon: 'delete-outline',
      iconColor: colors.notification,
      handler: () => {
        setDeleteDialogVisible(true);
        optionsBottomSheetModalRef.current?.dismiss();
      },
    },
  ];
  // Two options (rename / delete): 2 * 75 + 30 = 180.
  const optionsBottomSheetSnapPoints = useMemo(() => [120, 180], []);

  const renderBottomSheetBackdrop = useCallback(
    backdropProps => (
      <BottomSheetBackdrop
        {...backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={1}
      />
    ),
    [],
  );

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];
    if (data?.pages) {
      for (let page of data.pages) {
        pagesData.push(...page.result);
      }
    }
    return pagesData;
  };

  const handleSubmitCreateForm = async (values, actions) => {
    try {
      await createRevenueSourceMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) =>
          setLimitReachedMessage(() => message),
        onFormValidationError: ({errorMessage}) =>
          setFormErrorMessage(() => errorMessage),
      });
    } catch (error) {
      console.debug(error);
      return;
    } finally {
      actions.resetForm();
    }
    setCreateModalVisible(false);
  };

  const handleSubmitUpdateForm = async (values, actions) => {
    try {
      await updateRevenueSourceMutation.mutateAsync({
        id: focusedItem?.id,
        updatedValues: values,
        onFormValidationError: ({errorMessage}) =>
          setFormErrorMessage(() => errorMessage),
      });
    } catch (error) {
      console.debug(error);
      return;
    } finally {
      actions.resetForm();
    }
    setUpdateModalVisible(false);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteRevenueSourceMutation.mutateAsync({id: focusedItem?.id});
    } catch (error) {
      console.debug(error);
    } finally {
      setDeleteDialogVisible(false);
    }
  };

  const renderItem = ({item}) => {
    return (
      <Pressable
        style={[styles.row, {borderColor: colors.neutralTint5, backgroundColor: colors.surface}]}
        onPress={() => {
          setFocusedItem(() => item);
          optionsBottomSheetModalRef.current?.present();
        }}>
        <Text style={{fontSize: 14, color: colors.dark, flex: 1}} numberOfLines={1}>
          {item.name}
        </Text>
        <MaterialIcons name="more-horiz" size={20} color={colors.dark} />
      </Pressable>
    );
  };

  if (status === 'loading') {
    return <DefaultLoadingScreen />;
  }
  if (status === 'error') {
    return (
      <DefaultErrorScreen errorTitle="Oops!" errorMessage="Something went wrong" />
    );
  }

  const revenueSources = getAllPagesData();

  return (
    <>
      <Portal>
        <Modal
          visible={createModalVisible}
          onDismiss={() => setCreateModalVisible(false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Revenue Source
          </Title>
          <RevenueSourceForm
            onSubmit={handleSubmitCreateForm}
            onCancel={() => setCreateModalVisible(false)}
          />
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={updateModalVisible}
          onDismiss={() => setUpdateModalVisible(false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Rename Revenue Source
          </Title>
          <RevenueSourceForm
            editMode
            autoFocus
            submitButtonTitle="Update"
            revenueSource={focusedItem}
            initialValues={{name: focusedItem?.name || ''}}
            onSubmit={handleSubmitUpdateForm}
            onCancel={() => setUpdateModalVisible(false)}
          />
        </Modal>
      </Portal>
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Delete revenue source?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {`Are you sure you want to delete ${
                focusedItem?.name ? focusedItem.name + ' ' : ''
              }source? Its external revenue amounts in every month will also be removed. You can't undo this action.`}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDelete}
              color={colors.notification}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => setLimitReachedMessage(() => '')}
      />
      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => setFormErrorMessage(() => '')}
      />
      <FlatList
        style={{backgroundColor: colors.surface}}
        data={revenueSources}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={isFetchingNextPage ? <ListLoadingFooter /> : null}
        ListEmptyComponent={
          <ListEmpty
            actions={[
              {
                label: 'Create revenue source',
                handler: () => setCreateModalVisible(true),
              },
            ]}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            colors={[colors.primary, colors.accent, colors.dark]}
          />
        }
      />
      <View style={{backgroundColor: 'white', padding: 10}}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => setCreateModalVisible(true)}>
          Create New Revenue Source
        </Button>
      </View>
      <BottomSheetModal
        ref={optionsBottomSheetModalRef}
        index={1}
        snapPoints={optionsBottomSheetSnapPoints}
        backdropComponent={renderBottomSheetBackdrop}>
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
          <OptionsList options={itemOptions} />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default RevenueSourceList;
