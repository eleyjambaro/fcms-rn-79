import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';

const ExpenseGroupValidationSchema = Yup.object().shape({
  name: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
});

const ExpenseGroupForm = props => {
  const {
    autoFocus = false,
    editMode = false,
    initialValues = {name: ''},
    onSubmit,
    onCancel,
    submitButtonTitle = 'Create',
  } = props;

  return (
    <Formik
      initialValues={{
        name: initialValues.name,
      }}
      validationSchema={ExpenseGroupValidationSchema}
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
        } = props;

        return (
          <>
            <TextInput
              label="Group Name (e.g. Managers Meal)"
              onChangeText={handleChange('name')}
              onBlur={handleBlur('name')}
              value={values.name}
              error={errors.name && touched.name ? true : false}
              autoFocus={autoFocus}
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

export default ExpenseGroupForm;
