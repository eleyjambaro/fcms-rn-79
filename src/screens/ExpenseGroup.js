import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  Checkbox,
  Divider,
  Button,
  Modal,
  Portal,
  TextInput,
  Title,
} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useQueryClient, useMutation, useQuery} from '@tanstack/react-query';

import {expensesGroup} from '../__dummyData';
import routes from '../constants/routes';
import useExpenseFormContext from '../hooks/useExpenseFormContext';
import CheckboxSelection from '../components/forms/CheckboxSelection';
import ExpenseGroupForm from '../components/forms/ExpenseGroupForm';
import ListLoadingFooter from '../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import {getExpenseGroups, createExpenseGroup} from '../localDbQueries/expenses';

const ExpenseGroup = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {formikActions} = useExpenseFormContext();
  const {expense_group_id: defaultSelectedExpenseGroupId} = route.params;
  const [createExpenseGroupModalVisible, setCreateExpenseGroupModalVisible] =
    useState(false);
  const [limitReachedMessage, setLimitReachedMessage] = useState('');
  const [selectedExpenseGroup, setSelectedExpenseGroup] = useState(
    defaultSelectedExpenseGroupId,
  );
  const queryClient = useQueryClient();
  const createExpenseGroupMutation = useMutation(createExpenseGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenseGroups');
    },
  });
  const {status, data} = useQuery(['expenseGroups'], getExpenseGroups);

  const showCreateExpenseGroupModal = () =>
    setCreateExpenseGroupModalVisible(true);
  const hideCreateExpenseGroupModal = () =>
    setCreateExpenseGroupModalVisible(false);

  const handleExpenseGroupChange = selectedOption => {
    setSelectedExpenseGroup(() => selectedOption);
  };

  const handleCancel = () => {
    hideCreateExpenseGroupModal();
  };

  const handleSubmit = async (values, actions) => {
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

  const expenseGroups = data.result;

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
          <ExpenseGroupForm onSubmit={handleSubmit} onCancel={handleCancel} />
        </Modal>
      </Portal>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <View style={styles.container}>
        <Button
          mode="outlined"
          onPress={showCreateExpenseGroupModal}
          style={{marginVertical: 20}}>
          Create Expense Group
        </Button>
        <Divider />
        <CheckboxSelection
          value={selectedExpenseGroup}
          options={expenseGroups}
          optionLabelKey="name"
          optionValueKey="id"
          onChange={handleExpenseGroupChange}
        />
        <Button
          mode="contained"
          onPress={() => {
            formikActions.setFieldValue(
              'expense_group_id',
              selectedExpenseGroup,
            );
            navigation.goBack();
          }}
          style={{marginVertical: 20}}>
          Done
        </Button>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 7,
    backgroundColor: 'white',
  },
});

export default React.memo(ExpenseGroup);
