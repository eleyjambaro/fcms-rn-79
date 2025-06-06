import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  Button,
  useTheme,
  TextInput,
  Paragraph,
  Dialog,
  Portal,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import moment from 'moment';

const RevenueValidationSchema = Yup.object().shape({
  amount: Yup.string().required('Required'),
});

const RevenueForm = props => {
  const {
    editMode = false,
    revenue,
    initialValues = {
      revenue_group_id: '',
      revenue_group_date: '',
      amount: '',
    },
    onSubmit,
    onCancel,
    submitButtonTitle = 'Save',
  } = props;
  const {colors} = useTheme();
  const [isUpdateConfirmed, setIsUpdateConfirmed] = useState(false);

  const [updateRevenueDialogVisible, setUpdateRevenueDialogVisible] =
    useState(false);

  const showUpdateRevenueDialog = () => setUpdateRevenueDialogVisible(true);
  const hideUpdateRevenueDialog = () => setUpdateRevenueDialogVisible(false);

  const handleFormSubmit = (values, actions) => {
    if (editMode && !isUpdateConfirmed) {
      actions.setSubmitting(false);
      showUpdateRevenueDialog();
    } else {
      onSubmit(values, actions);
    }
  };

  return (
    <Formik
      initialValues={{
        revenue_group_id: initialValues.revenue_group_id || '',
        revenue_group_date: initialValues.revenue_group_date || '',
        amount: initialValues.amount || '',
      }}
      validationSchema={RevenueValidationSchema}
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
        } = props;

        return (
          <>
            <Portal>
              <Dialog
                visible={updateRevenueDialogVisible}
                onDismiss={hideUpdateRevenueDialog}>
                <Dialog.Title>Update revenue?</Dialog.Title>
                <Dialog.Content>
                  <Paragraph>
                    {`You are about to update ${
                      revenue?.name + ' ' || ''
                    }revenue for the month of ${moment(
                      revenue?.revenue_group_date
                        ? new Date(revenue?.revenue_group_date?.split(' ')[0])
                        : new Date(),
                    ).format('MMMM YYYY')}.`}
                  </Paragraph>
                </Dialog.Content>
                <Dialog.Actions style={{justifyContent: 'space-around'}}>
                  <Button onPress={hideUpdateRevenueDialog}>Cancel</Button>
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
              label="Total Revenue"
              onChangeText={handleChange('amount')}
              onBlur={handleBlur('amount')}
              value={values.amount}
              error={errors.amount && touched.amount ? true : false}
              keyboardType="numeric"
            />
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
  );
};

const styles = StyleSheet.create({});

export default RevenueForm;
