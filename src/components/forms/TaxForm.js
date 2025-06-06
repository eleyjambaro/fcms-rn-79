import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';

const TaxValidationSchema = Yup.object().shape({
  name: Yup.string().max(50, 'Too Long!').required('Required'),
  rate_percentage: Yup.string().required('Required'),
});

const TaxForm = props => {
  const {
    editMode = false,
    initialValues = {name: '', rate_percentage: ''},
    onSubmit,
    onCancel,
    submitButtonTitle = 'Create',
  } = props;

  return (
    <Formik
      initialValues={{
        name: initialValues.name,
        rate_percentage: initialValues.rate_percentage,
      }}
      validationSchema={TaxValidationSchema}
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
              label="Name (e.g. VAT)"
              onChangeText={handleChange('name')}
              onBlur={handleBlur('name')}
              value={values.name}
              error={errors.name && touched.name ? true : false}
              autoFocus={editMode ? true : false}
            />
            <TextInput
              label="Rate (%)"
              onChangeText={handleChange('rate_percentage')}
              onBlur={handleBlur('rate_percentage')}
              value={values.rate_percentage}
              error={
                errors.rate_percentage && touched.rate_percentage ? true : false
              }
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

export default TaxForm;
