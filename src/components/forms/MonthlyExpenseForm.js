import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Subheading,
  Modal,
  Title,
  Portal,
} from 'react-native-paper';
import {Formik, FieldArray} from 'formik';
import * as Yup from 'yup';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';

import {revenues} from '../../__dummyData';
import SelectionButtonList from '../buttons/SelectionButtonList';
import {
  createRevenueGroup,
  getRevenueGroups,
} from '../../localDbQueries/revenues';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import ListEmpty from '../stateIndicators/ListEmpty';
import RevenueGroupForm from './RevenueGroupForm';
import {getMonthlyExpenseRevenueGroupIds} from '../../localDbQueries/expenses';
import ErrorMessageModal from '../modals/ErrorMessageModal';

const MonthlyExpenseValidationSchema = Yup.object().shape({
  name: Yup.string().max(50, 'Too Long!').required('Required'),
  revenue_group_ids: Yup.array().min(
    1,
    'Must have at least one selected revenue group',
  ),
});

const MonthlyExpenseForm = props => {
  const {
    editMode = false,
    monthlyExpense,
    initialValues = {revenue_group_ids: [], expense_group_id: '', name: ''},
    onSubmit,
    onCancel,
    submitButtonTitle = 'Create',
  } = props;
  const {colors} = useTheme();
  const {status: revenueGroupsStatus, data: revenueGroupsData} = useQuery(
    ['revenueGroups', {}],
    getRevenueGroups,
  );
  const {
    status: monthlyExpenseRevenueGroupIdsStatus,
    data: monthlyExpenseRevenueGroupIdsData,
  } = useQuery(
    ['monthlyExpenseRevenueGroupIds', {id: monthlyExpense?.id}],
    getMonthlyExpenseRevenueGroupIds,
    {enabled: editMode && monthlyExpense ? true : false},
  );

  const queryClient = useQueryClient();
  const createRevenueGroupMutation = useMutation(createRevenueGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueGroups');
    },
  });

  const [createRevenueGroupModalVisible, setCreateRevenueGroupModalVisible] =
    useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

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
          message="In order to create monthly expense, there must be at least one revenue group to deduct expense from."
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
          revenue_group_ids: initialValues.revenue_group_ids || [],
          expense_group_id: initialValues.expense_group_id || '',
          name: initialValues.name || '',
        }}
        validationSchema={MonthlyExpenseValidationSchema}
        onSubmit={onSubmit}>
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
              <TextInput
                label="Monthly Expense Name"
                onChangeText={handleChange('name')}
                onBlur={handleBlur('name')}
                value={values.name}
                error={errors.name && touched.name ? true : false}
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

export default MonthlyExpenseForm;
