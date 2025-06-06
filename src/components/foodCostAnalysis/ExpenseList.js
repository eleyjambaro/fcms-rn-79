import React, {useState} from 'react';
import {StyleSheet, Text, View, FlatList, Pressable} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  Button,
  useTheme,
  Portal,
  Modal,
  TextInput,
  Title,
} from 'react-native-paper';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import {expenses} from '../../__dummyData';
import ExpenseListItem from './ExpenseListItem';
import routes from '../../constants/routes';
import GrandTotal from '../purchases/GrandTotal';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import {
  createExpense,
  deleteExpense,
  getExpenses,
  getExpenseGroupsGrandTotal,
  updateExpense,
  getExpenseGroupGrandTotal,
} from '../../localDbQueries/expenses';

const ExpenseList = props => {
  const {expenseGroupId, dateFilter} = props;
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
      ['expenseGroupGrandTotal', {expenseGroupId, dateFilter}],
      getExpenseGroupGrandTotal,
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

  const showCreateExpenseModal = () => setCreateExpenseModalVisible(true);
  const hideCreateExpenseModal = () => setCreateExpenseModalVisible(false);

  const handleCancel = () => {
    hideCreateExpenseModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await createExpenseMutation.mutateAsync({
        values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideCreateExpenseModal();
    }
  };

  const groupedExpenses = expenses.filter(
    expense => expense.group_id === expenseGroupId,
  );

  const renderItem = ({item}) => {
    return (
      <Pressable
        onPress={() => {
          setFocusedItem(() => item);
        }}>
        <ExpenseListItem item={item} />
      </Pressable>
    );
  };

  return (
    <>
      <FlatList
        style={{backgroundColor: colors.surface}}
        data={getAllPagesData()}
        renderItem={renderItem}
      />
      <GrandTotal value={expensesGrandTotalData || 0} />
    </>
  );
};

const styles = StyleSheet.create({});

export default ExpenseList;
