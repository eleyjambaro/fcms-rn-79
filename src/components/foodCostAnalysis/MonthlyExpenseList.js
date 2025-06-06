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
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import ListEmpty from '../../components/stateIndicators/ListEmpty';
import TestModeLimitModal from '../modals/TestModeLimitModal';
import OptionsList from '../buttons/OptionsList';
import {
  getMonthlyExpenses,
  getMonthlyExpenseGrandTotal,
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

const MonthlyExpenseList = props => {
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
    ['monthlyExpenses', {expenseGroupId, dateFilter}],
    getMonthlyExpenses,
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
  const {
    status: monthlyExpenseGrandTotalStatus,
    data: monthlyExpenseGrandTotalData,
  } = useQuery(
    ['monthlyExpenseGrandTotal', {expenseGroupId, dateFilter}],
    getMonthlyExpenseGrandTotal,
  );
  const {
    status: monthlyExpensesTotalAmountStatus,
    data: monthlyExpensesTotalAmountData,
  } = useQuery(['monthlyExpensesTotalAmount'], getMonthlyExpensesTotalAmount);
  const createMonthlyExpenseMutation = useMutation(createMonthlyExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('monthlyExpenses');
    },
  });
  const updateMonthlyExpenseMutation = useMutation(updateMonthlyExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('monthlyExpenses');
    },
  });
  const deleteMonthlyExpenseMutation = useMutation(deleteMonthlyExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('monthlyExpenses');
    },
  });

  const updateExpenseMutation = useMutation(updateExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('monthlyExpenses');
    },
  });
  const deleteExpenseMutation = useMutation(deleteExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('monthlyExpenses');
    },
  });

  const createExpenseMutation = useMutation(createExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('monthlyExpenses');
    },
  });

  const [
    createMonthlyExpenseModalVisible,
    setCreateMonthlyExpenseModalVisible,
  ] = useState(false);
  const [
    updateMonthlyExpenseModalVisible,
    setUpdateMonthlyExpenseModalVisible,
  ] = useState(false);
  const [
    deleteMonthlyExpenseDialogVisible,
    setDeleteMonthlyExpenseDialogVisible,
  ] = useState(false);

  const [createExpenseModalVisible, setCreateExpenseModalVisible] =
    useState(false);
  const [deleteExpenseDialogVisible, setDeleteExpenseDialogVisible] =
    useState(false);

  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const showCreateMonthlyExpenseModal = () =>
    setCreateMonthlyExpenseModalVisible(true);
  const hideCreateMonthlyExpenseModal = () =>
    setCreateMonthlyExpenseModalVisible(false);
  const showUpdateMonthlyExpenseModal = () =>
    setUpdateMonthlyExpenseModalVisible(true);
  const hideUpdateMonthlyExpenseModal = () =>
    setUpdateMonthlyExpenseModalVisible(false);

  const showCreateExpenseModal = () => setCreateExpenseModalVisible(true);
  const hideCreateExpenseModal = () => setCreateExpenseModalVisible(false);

  const showDeleteMonthlyExpenseDialog = () =>
    setDeleteMonthlyExpenseDialogVisible(true);
  const hideDeleteMonthlyExpenseDialog = () =>
    setDeleteMonthlyExpenseDialogVisible(false);

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

  const itemOptions =
    viewMode === 'list'
      ? [
          {
            label: 'Update expense amount',
            icon: 'pencil-outline',
            handler: () => {
              showCreateExpenseModal();
              closeOptionsBottomSheet();
            },
          },
          {
            label: 'Delete expense amount',
            labelColor: colors.notification,
            icon: 'delete-outline',
            iconColor: focusedItem?.expense_id
              ? colors.notification
              : colors.disabled,
            disabled: focusedItem?.expense_id ? false : true,
            handler: () => {
              showDeleteExpenseDialog();
              closeOptionsBottomSheet();
            },
          },
        ]
      : [
          {
            label: 'Update',
            icon: 'pencil-outline',
            handler: () => {
              showUpdateMonthlyExpenseModal();
              closeOptionsBottomSheet();
            },
          },
          {
            label: 'Delete',
            labelColor: colors.notification,
            icon: 'delete-outline',
            iconColor: colors.notification,
            handler: () => {
              showDeleteMonthlyExpenseDialog();
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

  const handleConfirmDeleteMonthlyExpense = async () => {
    try {
      await deleteMonthlyExpenseMutation.mutateAsync({
        id: focusedItem?.id,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      hideDeleteMonthlyExpenseDialog();
    }
  };

  const handleConfirmDeleteExpense = async () => {
    try {
      await deleteExpenseMutation.mutateAsync({
        id: focusedItem?.expense_id,
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

  const handleCancelCreateMonthlyExpenseForm = () => {
    hideCreateMonthlyExpenseModal();
  };

  const handleCancelUpdateMonthlyExpenseForm = () => {
    hideUpdateMonthlyExpenseModal();
  };

  const handleSubmitUpdateMonthlyExpenseForm = async (values, actions) => {
    console.log(values);

    if (!values.name || !values.revenue_group_ids?.length > 0) {
      return;
    }

    try {
      await updateMonthlyExpenseMutation.mutateAsync({
        id: focusedItem?.id,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideUpdateMonthlyExpenseModal();
    }
  };

  const handleSubmitCreateMonthlyExpenseForm = async (values, actions) => {
    console.log(values);

    if (!values.name || !values.revenue_group_ids?.length > 0) {
      return;
    }

    try {
      await createMonthlyExpenseMutation.mutateAsync({
        values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideCreateMonthlyExpenseModal();
    }
  };

  const renderItem = ({item}) => {
    return (
      <MonthlyExpenseListItem
        viewMode={viewMode}
        item={item}
        onPress={() => {
          setFocusedItem(() => item);

          if (viewMode === 'list') {
            setCreateExpenseModalVisible(() => true);
          } else {
            showUpdateMonthlyExpenseModal();
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

  const monthlyExpenses = getAllPagesData();

  const createMonthlyExpenseFormInitialValues = {
    expense_group_id: expenseGroupId?.toString() || '',
    name: '',
  };

  const updateMonthlyExpenseFormInitialValues = {
    expense_group_id: expenseGroupId?.toString() || '',
    name: focusedItem?.name || '',
  };

  const expenseFormInitialValues = {
    expense_group_id: expenseGroupId?.toString() || '',
    expense_group_date: dateFilter || '',
    monthly_expense_id: focusedItem?.id?.toString() || '',
    amount: focusedItem?.amount?.toString() || '',
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createMonthlyExpenseModalVisible}
          onDismiss={hideCreateMonthlyExpenseModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Monthly Expense Group
          </Title>
          <MonthlyExpenseForm
            initialValues={createMonthlyExpenseFormInitialValues}
            onSubmit={handleSubmitCreateMonthlyExpenseForm}
            onCancel={handleCancelCreateMonthlyExpenseForm}
          />
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={updateMonthlyExpenseModalVisible}
          onDismiss={hideUpdateMonthlyExpenseModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Update Monthly Expense
          </Title>
          <MonthlyExpenseForm
            monthlyExpense={focusedItem}
            initialValues={updateMonthlyExpenseFormInitialValues}
            editMode
            autoFocus
            submitButtonTitle="Update"
            onSubmit={handleSubmitUpdateMonthlyExpenseForm}
            onCancel={handleCancelUpdateMonthlyExpenseForm}
          />
        </Modal>
      </Portal>
      <Portal>
        <Dialog
          visible={deleteMonthlyExpenseDialogVisible}
          onDismiss={hideDeleteMonthlyExpenseDialog}>
          <Dialog.Title>Delete monthly expense?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete monthly expense? You can't undo
              this action.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteMonthlyExpenseDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteMonthlyExpense}
              color={colors.notification}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Modal
          visible={createExpenseModalVisible}
          onDismiss={hideCreateExpenseModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <View
            style={{alignItems: 'center', marginBottom: 20, marginBottom: 15}}>
            <Title style={{textAlign: 'center'}}>
              {`${focusedItem?.name} Expense Amount`}
            </Title>
            <Text>{`For the month of ${moment(
              new Date(dateFilter?.split(' ')?.[0]) || new Date(),
            ).format('MMMM YYYY')}`}</Text>
          </View>
          <ExpenseForm
            editMode={focusedItem?.expense_id ? true : false}
            expense={focusedItem}
            initialValues={expenseFormInitialValues}
            onSubmit={handleSubmitCreateExpenseForm}
            onCancel={handleCancelCreateExpenseForm}
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
        data={monthlyExpenses}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <ListEmpty
            actions={[
              {
                label: 'Create monthly expense',
                handler: () => {
                  showCreateMonthlyExpenseModal();
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
      {viewMode === 'list' && monthlyExpenses.length > 0 && (
        <ManageListButton
          label="Manage monthly expense list"
          onPress={() =>
            navigation.navigate(routes.manageMonthlyExpenses(), {
              expense_group_id: expenseGroupId,
              expense_group_date: dateFilter,
            })
          }
        />
      )}
      {viewMode === 'list' && (
        <GrandTotal value={monthlyExpenseGrandTotalData || 0} />
      )}
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button mode="contained" onPress={showCreateMonthlyExpenseModal}>
          Create Monthly Expense
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

export default MonthlyExpenseList;
