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
  TextInput,
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
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';
import moment from 'moment';

import {expensesGroup} from '../../__dummyData';
import ExpenseGroupListItem from './ExpenseGroupListItem';
import routes from '../../constants/routes';
import GrandTotal from '../purchases/GrandTotal';
import ManageListButton from '../buttons/ManageListButton';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import ListEmpty from '../../components/stateIndicators/ListEmpty';
import TestModeLimitModal from '../modals/TestModeLimitModal';
import OptionsList from '../buttons/OptionsList';
import {
  createExpense,
  createExpenseGroup,
  deleteExpense,
  deleteExpenseGroup,
  getExpenseGroups,
  getExpenseGroupsGrandTotal,
  updateExpense,
  updateExpenseGroup,
} from '../../localDbQueries/expenses';
import ExpenseGroupForm from '../forms/ExpenseGroupForm';

const ExpenseGroupList = props => {
  const {backAction, viewMode = 'list', dateFilter} = props;
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
  } = useInfiniteQuery(['expenseGroups', {dateFilter}], getExpenseGroups, {
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
  const {
    status: expenseGroupsGrandTotalStatus,
    data: expenseGroupsGrandTotalData,
  } = useQuery(
    ['expenseGroupsGrandTotal', {dateFilter}],
    getExpenseGroupsGrandTotal,
  );

  const createExpenseGroupMutation = useMutation(createExpenseGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenseGroups');
      queryClient.invalidateQueries('expenseGroupsGrandTotal');
    },
  });
  const updateExpenseGroupMutation = useMutation(updateExpenseGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenseGroups');
    },
  });
  const deleteExpenseGroupMutation = useMutation(deleteExpenseGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenseGroups');
      queryClient.invalidateQueries('expenseGroupsGrandTotal');
    },
  });

  const createExpenseMutation = useMutation(createExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenseGroups');
      queryClient.invalidateQueries('expenseGroupsGrandTotal');
      queryClient.invalidateQueries('expenses');
    },
  });
  const updateExpenseMutation = useMutation(updateExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenseGroups');
      queryClient.invalidateQueries('expenseGroupsGrandTotal');
      queryClient.invalidateQueries('expenses');
    },
  });
  const deleteExpenseMutation = useMutation(deleteExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenseGroups');
      queryClient.invalidateQueries('expenseGroupsGrandTotal');
      queryClient.invalidateQueries('expenses');
    },
  });

  const [createExpenseGroupModalVisible, setCreateExpenseGroupModalVisible] =
    useState(false);
  const [updateExpenseGroupModalVisible, setUpdateExpenseGroupModalVisible] =
    useState(false);

  const [createExpenseModalVisible, setCreateExpenseModalVisible] =
    useState(false);

  const [deleteExpenseGroupDialogVisible, setDeleteExpenseGroupDialogVisible] =
    useState(false);

  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const showCreateExpenseGroupModal = () =>
    setCreateExpenseGroupModalVisible(true);
  const hideCreateExpenseGroupModal = () =>
    setCreateExpenseGroupModalVisible(false);
  const showUpdateExpenseGroupModal = () =>
    setUpdateExpenseGroupModalVisible(true);
  const hideUpdateExpenseGroupModal = () =>
    setUpdateExpenseGroupModalVisible(false);

  const showCreateExpenseModal = () => setCreateExpenseModalVisible(true);
  const hideCreateExpenseModal = () => setCreateExpenseModalVisible(false);

  const showDeleteExpenseGroupDialog = () =>
    setDeleteExpenseGroupDialogVisible(true);
  const hideDeleteExpenseGroupDialog = () =>
    setDeleteExpenseGroupDialogVisible(false);

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

  const itemOptions =
    viewMode === 'manage-list'
      ? [
          {
            label: 'Update expense group',
            icon: 'pencil-outline',
            handler: () => {
              showUpdateExpenseGroupModal();
              closeOptionsBottomSheet();
            },
          },
          {
            label: 'Delete',
            labelColor: colors.notification,
            icon: 'delete-outline',
            iconColor: colors.notification,
            handler: () => {
              showDeleteExpenseGroupDialog();
              closeOptionsBottomSheet();
            },
          },
        ]
      : [];

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

  const handleConfirmDeleteExpenseGroup = async () => {
    try {
      await deleteExpenseGroupMutation.mutateAsync({
        id: focusedItem?.id,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      hideDeleteExpenseGroupDialog();
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
          {'Expense group options'}
        </Text>
        <OptionsList options={itemOptions} />
      </BottomSheetView>
    );
  };

  const handleCancelCreateExpenseGroupForm = () => {
    hideCreateExpenseGroupModal();
  };

  const handleCancelUpdateExpenseGroupForm = () => {
    hideUpdateExpenseGroupModal();
  };

  const handleSubmitUpdateExpenseGroupForm = async (values, actions) => {
    console.log(values);
    try {
      await updateExpenseGroupMutation.mutateAsync({
        id: focusedItem?.id,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideUpdateExpenseGroupModal();
    }
  };

  const handleSubmitCreateExpenseGroupForm = async (values, actions) => {
    console.log(values);
    try {
      await createExpenseGroupMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideCreateExpenseGroupModal();
    }
  };

  const renderItem = ({item}) => {
    return (
      <ExpenseGroupListItem
        viewMode={viewMode}
        item={item}
        onPress={() => {
          setFocusedItem(() => item);
          if (viewMode === 'list') {
            navigation.navigate(routes.expenseView(), {
              expense_group_id: item.id,
              expense_group_date: dateFilter,
              expense_group_name: item.name,
            });
          } else {
            showUpdateExpenseGroupModal();
          }
        }}
        onPressItemOptions={() => {
          setFocusedItem(() => item);
          openOptionsBottomSheet();
        }}
      />
    );
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
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

  const expenseGroups = getAllPagesData();

  const updateExpenseGroupFormInitialValues = {
    name: focusedItem?.name || '',
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createExpenseGroupModalVisible}
          onDismiss={hideCreateExpenseGroupModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Expense Group
          </Title>
          <ExpenseGroupForm
            onSubmit={handleSubmitCreateExpenseGroupForm}
            onCancel={handleCancelCreateExpenseGroupForm}
          />
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={updateExpenseGroupModalVisible}
          onDismiss={hideUpdateExpenseGroupModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Update Expense Group
          </Title>
          <ExpenseGroupForm
            initialValues={updateExpenseGroupFormInitialValues}
            editMode
            autoFocus
            submitButtonTitle="Update"
            onSubmit={handleSubmitUpdateExpenseGroupForm}
            onCancel={handleCancelUpdateExpenseGroupForm}
          />
        </Modal>
      </Portal>
      <Portal>
        <Dialog
          visible={deleteExpenseGroupDialogVisible}
          onDismiss={hideDeleteExpenseGroupDialog}>
          <Dialog.Title>Delete expense group?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete expense group? You can't undo this
              action.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteExpenseGroupDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteExpenseGroup}
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
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <FlatList
        style={{backgroundColor: colors.surface}}
        data={expenseGroups}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <ListEmpty
            actions={[
              {
                label: 'Create expense group',
                handler: () => {
                  showCreateExpenseGroupModal();
                },
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
      {viewMode === 'list' && expenseGroups.length > 0 && (
        <ManageListButton
          label="Manage expense group list"
          onPress={() => navigation.navigate(routes.manageExpenseGroups())}
        />
      )}
      {viewMode === 'list' && (
        <GrandTotal value={expenseGroupsGrandTotalData || 0} />
      )}
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button
          mode="contained"
          icon="plus"
          onPress={showCreateExpenseGroupModal}>
          Create New Expense Group
        </Button>
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

export default ExpenseGroupList;
