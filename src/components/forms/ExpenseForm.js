import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  Button,
  useTheme,
  TextInput,
  Text,
  Subheading,
  Modal,
  Title,
  Paragraph,
  Dialog,
  Portal,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import moment from 'moment';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';

import {
  createRevenueGroup,
  getRevenueGroups,
} from '../../localDbQueries/revenues';
import {getExpenseRevenueGroupIds} from '../../localDbQueries/expenses';
import SelectionButtonList from '../buttons/SelectionButtonList';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import ListEmpty from '../stateIndicators/ListEmpty';
import TestModeLimitModal from '../modals/TestModeLimitModal';
import RevenueGroupForm from './RevenueGroupForm';
import ErrorMessageModal from '../modals/ErrorMessageModal';

const ExpenseValidationSchema = Yup.object().shape({
  name: Yup.string().max(50, 'Too Long!').required('Required'),
  amount: Yup.string().required('Required'),
  revenue_group_ids: Yup.array().min(
    1,
    'Must have at least one selected revenue group',
  ),
});

const ExpenseForm = props => {
  const {
    editMode = false,
    expense,
    initialValues = {
      revenue_group_ids: [],
      expense_group_id: '',
      expense_group_date: '',
      name: '',
      amount: '',
    },
    onSubmit,
    onCancel,
    submitButtonTitle = 'Create',
  } = props;
  const {colors} = useTheme();
  const {status: revenueGroupsStatus, data: revenueGroupsData} = useQuery(
    ['revenueGroups', {}],
    getRevenueGroups,
  );
  const queryClient = useQueryClient();
  const createRevenueGroupMutation = useMutation(createRevenueGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueGroups');
    },
  });
  const {
    status: monthlyExpenseRevenueGroupIdsStatus,
    data: monthlyExpenseRevenueGroupIdsData,
  } = useQuery(
    ['expenseRevenueGroupIds', {id: expense?.id}],
    getExpenseRevenueGroupIds,
    {enabled: editMode && expense ? true : false},
  );

  const [createRevenueGroupModalVisible, setCreateRevenueGroupModalVisible] =
    useState(false);

  const [isUpdateConfirmed, setIsUpdateConfirmed] = useState(false);

  const [updateExpenseDialogVisible, setUpdateExpenseDialogVisible] =
    useState(false);

  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const showUpdateExpenseDialog = () => setUpdateExpenseDialogVisible(true);
  const hideUpdateExpenseDialog = () => setUpdateExpenseDialogVisible(false);

  const showCreateRevenueGroupModal = () =>
    setCreateRevenueGroupModalVisible(true);
  const hideCreateRevenueGroupModal = () =>
    setCreateRevenueGroupModalVisible(false);

  const handleRevenueGroupIdsChange = (value, actions) => {
    value &&
      value.length > 0 &&
      actions.setFieldTouched('revenue_group_ids', true);
    actions.setFieldValue('revenue_group_ids', value);
  };

  const handleCancelCreateRevenueGroupForm = () => {
    hideCreateRevenueGroupModal();
  };

  const handleSubmitCreateRevenueGroupForm = async (values, actions) => {
    console.log(values);
    try {
      await createRevenueGroupMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onFormValidationError: ({errorMessage}) => {
          setFormErrorMessage(() => errorMessage);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideCreateRevenueGroupModal();
    }
  };

  const handleFormSubmit = (values, actions) => {
    if (editMode && !isUpdateConfirmed) {
      actions.setSubmitting(false);
      showUpdateExpenseDialog();
    } else {
      onSubmit(values, actions);
    }
  };

  const renderRevenueGroupsSelection = ({
    errors,
    touched,
    setFieldTouched,
    setFieldValue,
  }) => {
    if (
      revenueGroupsStatus === 'loading' ||
      (editMode && monthlyExpenseRevenueGroupIdsStatus === 'loading')
    ) {
      return <DefaultLoadingScreen />;
    }

    if (
      revenueGroupsStatus === 'error' ||
      (editMode && monthlyExpenseRevenueGroupIdsStatus === 'error')
    ) {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    const revenueGroups = revenueGroupsData?.result;

    if (!revenueGroups?.length > 0) {
      return (
        <ListEmpty
          containerStyle={{flex: 0, paddingBottom: 10}}
          message="In order to create expense, there must be at least one revenue group to deduct expense from."
          actions={[
            {
              label: 'Create revenue group',
              handler: () => {
                showCreateRevenueGroupModal();
              },
            },
          ]}
        />
      );
    }

    const revenueGroupSelections = revenueGroups.map(revenueGroup => {
      return {
        label: revenueGroup.name,
        value: revenueGroup.id,
      };
    });

    const selectionDefaultValue = editMode
      ? monthlyExpenseRevenueGroupIdsData?.result
      : null;

    return (
      <>
        <Subheading style={{marginTop: 20, marginBottom: 15}}>
          {'Select revenue group(s) to deduct expense from'}
        </Subheading>
        <SelectionButtonList
          selections={revenueGroupSelections}
          selectMany
          defaultValue={selectionDefaultValue}
          onChange={value => {
            handleRevenueGroupIdsChange(value, {
              setFieldValue,
              setFieldTouched,
            });
          }}
        />
        {errors.revenue_group_ids && touched.revenue_group_ids && (
          <Text style={{color: colors.error, marginTop: 10}}>
            {errors.revenue_group_ids}
          </Text>
        )}
      </>
    );
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createRevenueGroupModalVisible}
          onDismiss={hideCreateRevenueGroupModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Revenue Group
          </Title>
          <RevenueGroupForm
            onSubmit={handleSubmitCreateRevenueGroupForm}
            onCancel={handleCancelCreateRevenueGroupForm}
          />
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
      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => {
          setFormErrorMessage(() => '');
        }}
      />
      <Formik
        initialValues={{
          expense_group_ids: initialValues.expense_group_ids || [],
          expense_group_id: initialValues.expense_group_id || '',
          expense_group_date: initialValues.expense_group_date || '',
          name: initialValues.name || '',
          amount: initialValues.amount || '',
        }}
        validationSchema={ExpenseValidationSchema}
        onSubmit={handleFormSubmit}>
        {props => {
          const {
            handleChange,
            handleBlur,
            handleSubmit,
            values,
            errors,
            touched,
            dirty,
            isSubmitting,
            isValid,
            setFieldTouched,
            setFieldValue,
          } = props;

          return (
            <>
              <Portal>
                <Dialog
                  visible={updateExpenseDialogVisible}
                  onDismiss={hideUpdateExpenseDialog}>
                  <Dialog.Title>Update expense?</Dialog.Title>
                  <Dialog.Content>
                    <Paragraph>
                      {`You are about to update ${
                        expense?.name + ' ' || ''
                      }expense for the month of ${moment(
                        expense?.expense_group_date
                          ? new Date(expense?.expense_group_date?.split(' ')[0])
                          : new Date(),
                      ).format('MMMM YYYY')}.`}
                    </Paragraph>
                  </Dialog.Content>
                  <Dialog.Actions style={{justifyContent: 'space-around'}}>
                    <Button onPress={hideUpdateExpenseDialog}>Cancel</Button>
                    <Button
                      loading={isSubmitting}
                      disabled={isSubmitting}
                      icon={'check-outline'}
                      onPress={() => {
                        setIsUpdateConfirmed(() => true);
                        handleSubmit();
                      }}
                      color={colors.accent}>
                      Confirm
                    </Button>
                  </Dialog.Actions>
                </Dialog>
              </Portal>
              <TextInput
                label="Name"
                onChangeText={handleChange('name')}
                onBlur={handleBlur('name')}
                value={values.name}
                error={errors.name && touched.name ? true : false}
              />
              <TextInput
                label="Amount"
                onChangeText={handleChange('amount')}
                onBlur={handleBlur('amount')}
                value={values.amount}
                error={errors.amount && touched.amount ? true : false}
                keyboardType="numeric"
              />
              {renderRevenueGroupsSelection({
                errors,
                touched,
                setFieldValue,
                setFieldTouched,
              })}
              <Button
                mode="contained"
                onPress={handleSubmit}
                disabled={(!editMode && !dirty) || !isValid || isSubmitting}
                loading={isSubmitting}
                style={{marginTop: 20}}>
                {submitButtonTitle}
              </Button>
              <Button onPress={onCancel} style={{marginTop: 10}}>
                Cancel
              </Button>
            </>
          );
        }}
      </Formik>
    </>
  );
};

const styles = StyleSheet.create({});

export default ExpenseForm;
