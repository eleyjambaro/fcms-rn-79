import {StyleSheet, Text, View} from 'react-native';
import {Button} from 'react-native-paper';
import React from 'react';
import MonthlyExpenseList from '../components/foodCostAnalysis/MonthlyExpenseList';

const ManageMonthlyExpenses = props => {
  const {route} = props;
  const expenseGroupId = route?.params?.expense_group_id;
  const expenseGroupDate = route?.params?.expense_group_date;

  return (
    <View style={styles.container}>
      <MonthlyExpenseList
        expenseGroupId={expenseGroupId}
        dateFilter={expenseGroupDate}
        viewMode="manage-list"
      />
    </View>
  );
};

export default ManageMonthlyExpenses;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
