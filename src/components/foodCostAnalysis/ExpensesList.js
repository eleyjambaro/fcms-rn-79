import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  Button,
  useTheme,
  Paragraph,
  Portal,
  Dialog,
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

import {expenses} from '../../__dummyData';
import MonthlyExpenseListItem from './MonthlyExpenseListItem';
import routes from '../../constants/routes';
import GrandTotal from '../purchases/GrandTotal';
import ManageListButton from '../buttons/ManageListButton';
import ListLoadingFooter from '../stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import ListEmpty from '../stateIndicators/ListEmpty';
import TestModeLimitModal from '../modals/TestModeLimitModal';
import OptionsList from '../buttons/OptionsList';
import {
  getExpenses,
  getExpensesGrandTotal,
  createMonthlyExpense,
  updateMonthlyExpense,
  deleteMonthlyExpense,
  createExpense,
  deleteExpense,
  getMonthlyExpensesTotalAmount,
  updateExpense,
} from '../../localDbQueries/expenses';
import ExpenseForm from '../forms/ExpenseForm';
import MonthlyExpenseForm from '../forms/MonthlyExpenseForm';
import ExpenseListItem from './ExpensesListItem';

const ExpenseList = props => {
  const {expenseGroupId, viewMode = 'list', dateFilter} = props;
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
  } = useInfiniteQuery(
    ['expenses', {expenseGroupId, dateFilter}],
    getExpenses,
    {
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
    },
  );
  const queryClient = useQueryClient();
  const {status: expensesGrandTotalStatus, data: expensesGrandTotalData} =
    useQuery(
      ['expensesGrandTotal', {expenseGroupId, dateFilter}],
      getExpensesGrandTotal,
    );
  const createExpenseMutation = useMutation(createExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenses');
    },
  });
  const updateExpenseMutation = useMutation(updateExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenses');
    },
  });
  const deleteExpenseMutation = useMutation(deleteExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenses');
    },
  });

  const [createExpenseModalVisible, setCreateExpenseModalVisible] =
    useState(false);
  const [updateExpenseModalVisible, setUpdateExpenseModalVisible] =
    useState(false);
  const [deleteExpenseDialogVisible, setDeleteExpenseDialogVisible] =
    useState(false);
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const showCreateExpenseModal = () => setCreateExpenseModalVisible(true);
  const hideCreateExpenseModal = () => setCreateExpenseModalVisible(false);

  const showUpdateExpenseModal = () => setUpdateExpenseModalVisible(true);
  const hideUpdateExpenseModal = () => setUpdateExpenseModalVisible(false);

  const showDeleteExpenseDialog = () => setDeleteExpenseDialogVisible(true);
  const hideDeleteExpenseDialog = () => setDeleteExpenseDialogVisible(false);

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

  const itemOptions = [
    {
      label: 'Update',
      icon: 'pencil-outline',
      handler: () => {
        showUpdateExpenseModal();
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Delete',
      labelColor: colors.notification,
      icon: 'delete-outline',
      iconColor: colors.notification,
      handler: () => {
        showDeleteExpenseDialog();
        closeOptionsBottomSheet();
      },
    },
  ];

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

  const handleConfirmDeleteExpense = async () => {
    try {
      await deleteExpenseMutation.mutateAsync({
        id: focusedItem?.id,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      hideDeleteExpenseDialog();
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
          {'Options'}
        </Text>
        <OptionsList options={itemOptions} />
      </BottomSheetView>
    );
  };

  const handleCancelCreateExpenseForm = () => {
    hideCreateExpenseModal();
  };

  const handleCancelUpdateExpenseForm = () => {
    hideUpdateExpenseModal();
  };

  const handleSubmitCreateExpenseForm = async (values, actions) => {
    console.log(values);
    try {
      await createExpenseMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideCreateExpenseModal();
    }
  };

  const handleSubmitUpdateExpenseForm = async (values, actions) => {
    console.log(values);
    try {
      await updateExpenseMutation.mutateAsync({
        id: focusedItem?.id,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideUpdateExpenseModal();
    }
  };

  const renderItem = ({item}) => {
    return (
      <ExpenseListItem
        viewMode={viewMode}
        item={item}
        onPress={() => {
          setFocusedItem(() => item);
          setUpdateExpenseModalVisible(() => true);
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

  const expenses = getAllPagesData();

  const createExpenseFormInitialValues = {
    expense_group_id: expenseGroupId?.toString() || '',
    expense_group_date: dateFilter || '',
    name: '',
    amount: '',
  };

  const updateExpenseFormInitialValues = {
    expense_group_id: expenseGroupId?.toString() || '',
    expense_group_date: dateFilter || '',
    name: focusedItem?.name || '',
    amount: focusedItem?.amount?.toString() || '',
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createExpenseModalVisible}
          onDismiss={hideCreateExpenseModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <View
            style={{alignItems: 'center', marginBottom: 20, marginBottom: 15}}>
            <Title style={{textAlign: 'center'}}>{`Create Expense`}</Title>
          </View>
          <ExpenseForm
            initialValues={createExpenseFormInitialValues}
            onSubmit={handleSubmitCreateExpenseForm}
            onCancel={handleCancelCreateExpenseForm}
          />
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={updateExpenseModalVisible}
          onDismiss={hideUpdateExpenseModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <View
            style={{alignItems: 'center', marginBottom: 20, marginBottom: 15}}>
            <Title style={{textAlign: 'center'}}>{`Update Expense`}</Title>
          </View>
          <ExpenseForm
            editMode
            expense={focusedItem}
            initialValues={updateExpenseFormInitialValues}
            onSubmit={handleSubmitUpdateExpenseForm}
            onCancel={handleCancelUpdateExpenseForm}
            submitButtonTitle="Save"
          />
        </Modal>
      </Portal>
      <Portal>
        <Dialog
          visible={deleteExpenseDialogVisible}
          onDismiss={hideDeleteExpenseDialog}>
          <Dialog.Title>Delete expense?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {`Are you sure you want to delete ${
                focusedItem?.name + ' ' || ''
              }expense for the month of ${moment(
                focusedItem?.expense_group_date
                  ? new Date(focusedItem?.expense_group_date?.split(' ')[0])
                  : new Date(),
              ).format('MMMM YYYY')}? You can't undo this action.`}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteExpenseDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteExpense}
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
        data={expenses}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <ListEmpty
            actions={[
              {
                label: 'Create expense',
                handler: () => {
                  showCreateExpenseModal();
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
      {viewMode === 'list' && (
        <GrandTotal value={expensesGrandTotalData || 0} />
      )}
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button mode="contained" onPress={showCreateExpenseModal}>
          Add Expense
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

export default ExpenseList;
