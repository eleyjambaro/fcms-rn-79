import React, {useState} from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {
  Button,
  useTheme,
  TextInput,
  Text,
  Subheading,
  RadioButton,
  Paragraph,
  Dialog,
  Portal,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import moment from 'moment';

const RevenueValidationSchema = Yup.object().shape({
  revenue_source_id: Yup.string().required('Select an external revenue source'),
  amount: Yup.string().required('Required'),
});

/**
 * Add / edit an external (per-source) revenue amount for a revenue group in a
 * month. In create mode the user picks one of the reusable revenue sources; in
 * edit mode the source is fixed and only the amount changes.
 */
const RevenueForm = props => {
  const {
    editMode = false,
    revenue,
    sources = [],
    initialValues = {
      revenue_group_id: '',
      revenue_group_date: '',
      revenue_source_id: '',
      amount: '',
    },
    onSubmit,
    onCancel,
    onManageSources,
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

  const renderSourceSelection = ({values, errors, touched, setFieldValue, setFieldTouched}) => {
    // In edit mode the source is fixed — just show its name.
    if (editMode) {
      return (
        <View style={{marginVertical: 10}}>
          <Subheading>Source</Subheading>
          <Text style={{fontWeight: 'bold', color: colors.dark}}>
            {revenue?.revenue_source_name || 'External revenue'}
          </Text>
        </View>
      );
    }

    if (!sources?.length) {
      return (
        <View style={{marginVertical: 15}}>
          <Text style={{marginBottom: 10}}>
            You don't have any external revenue source yet. Create one first
            (e.g. "External POS1", "Portable Terminal").
          </Text>
          {onManageSources && (
            <Button mode="outlined" icon="cog-outline" onPress={onManageSources}>
              Manage revenue sources
            </Button>
          )}
        </View>
      );
    }

    return (
      <View style={{marginVertical: 10}}>
        <Subheading style={{marginBottom: 5}}>
          Select external revenue source:
        </Subheading>
        <ScrollView style={{maxHeight: 220}}>
          <RadioButton.Group
            value={values.revenue_source_id}
            onValueChange={value => {
              setFieldTouched('revenue_source_id', true);
              setFieldValue('revenue_source_id', value);
            }}>
            {sources.map(source => (
              <RadioButton.Item
                key={source.id}
                label={source.name}
                value={source.id}
              />
            ))}
          </RadioButton.Group>
        </ScrollView>
        {errors.revenue_source_id && touched.revenue_source_id && (
          <Text style={{color: colors.error, marginTop: 5}}>
            {errors.revenue_source_id}
          </Text>
        )}
        {onManageSources && (
          <Button
            compact
            icon="cog-outline"
            onPress={onManageSources}
            style={{marginTop: 5}}>
            Manage revenue sources
          </Button>
        )}
      </View>
    );
  };

  return (
    <Formik
      initialValues={{
        revenue_group_id: initialValues.revenue_group_id || '',
        revenue_group_date: initialValues.revenue_group_date || '',
        revenue_source_id: initialValues.revenue_source_id || '',
        amount: initialValues.amount || '',
      }}
      validationSchema={RevenueValidationSchema}
      onSubmit={handleFormSubmit}>
      {formikProps => {
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
          setFieldValue,
          setFieldTouched,
        } = formikProps;

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
                      revenue?.revenue_source_name
                        ? revenue.revenue_source_name + ' '
                        : ''
                    }revenue for the month of ${(revenue?.revenue_group_date
                      ? moment(
                          revenue.revenue_group_date.split(' ')[0],
                          'YYYY-MM-DD',
                        )
                      : moment()
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
            {renderSourceSelection({
              values,
              errors,
              touched,
              setFieldValue,
              setFieldTouched,
            })}
            <TextInput
              label="Amount"
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
