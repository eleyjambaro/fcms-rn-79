import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {
  useTheme,
  Portal,
  Modal,
  Title,
  TextInput,
  Button,
} from 'react-native-paper';
import {
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import {expensesGroup} from '../__dummyData';
import routes from '../constants/routes';
import {
  getMonthlyExpenses,
  createMonthlyExpense,
} from '../localDbQueries/expenses';
import ExpenseList from '../components/foodCostAnalysis/ExpenseList';
import MonthPickerModal from '../components/modals/MonthPickerModal';
import MonthlyExpenseList from '../components/foodCostAnalysis/MonthlyExpenseList';
import MonthlyExpenseForm from '../components/forms/MonthlyExpenseForm';
import CurrentMonthYearHeading from '../components/foodCostAnalysis/CurrentMonthYearHeading';
import ExpensesList from '../components/foodCostAnalysis/ExpensesList';

function ExpenseView(props) {
  const {navigation} = props;
  const route = useRoute();
  const expenseGroupId = route?.params?.expense_group_id;
  const expenseGroupDate = route?.params?.expense_group_date || '';
  const expenseGroupName = route?.params?.expense_group_name || '';
  // Parse the date-only part as LOCAL midnight (component construction).
  // `new Date('YYYY-MM-DD')` parses as UTC midnight, which can shift the month
  // label back a day for negative-UTC users at month boundaries.
  const date = (() => {
    if (!expenseGroupDate) return new Date();
    const [y, m, d] = expenseGroupDate.split(' ')[0].split('-').map(Number);
    return new Date(y, m - 1, d);
  })();

  useEffect(() => {
    navigation.setOptions({headerTitle: `Expenses - ${expenseGroupName}`});
  }, []);

  return (
    <>
      <CurrentMonthYearHeading date={date} />
      <View style={{flex: 1}}>
        <View style={{flex: 1}}>
          <ExpensesList
            expenseGroupId={expenseGroupId}
            dateFilter={expenseGroupDate}
          />
        </View>
      </View>
    </>
  );
}

export default ExpenseView;

const styles = StyleSheet.create({});
