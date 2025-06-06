import React, {useState} from 'react';
import {StyleSheet, ScrollView} from 'react-native';
import {useTheme} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useQueryClient, useMutation} from '@tanstack/react-query';

import ExpenseForm from '../components/forms/ExpenseForm';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import {createExpense} from '../localDbQueries/expenses';

const AddExpense = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const createExpenseMutation = useMutation(createExpense, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenses');
    },
  });
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const handleSubmit = async (values, actions) => {
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
      navigation.goBack();
    }
  };

  const expenseFormInitialValues = {
    expense_group_id: route?.params?.expense_group_id?.toString(),
    expense_group_date: route?.params?.expense_group_date,
  };

  return (
    <ScrollView style={styles.container}>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <ExpenseForm
        onSubmit={handleSubmit}
        initialValues={expenseFormInitialValues}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 7,
  },
  surface: {
    padding: 8,
    height: 80,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});

export default AddExpense;
