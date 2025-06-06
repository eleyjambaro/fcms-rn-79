import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';

const PasswordFormValidationSchema = Yup.object().shape({
  password: Yup.string().required('Please enter your password.'),
});

const ConfirmAccountDeletionUsingPasswordForm = props => {
  const {
    initialValues = {password: ''},
    onSubmit,
    onCancel,
    submitButtonTitle = 'Submit',
  } = props;
  const {colors} = useTheme();

  const renderFormError = (touched, errors) => {
    if (errors.password && touched.password) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.password}
        </Text>
      );
    }
  };

  return (
    <Formik
      initialValues={{
        password: initialValues.password,
      }}
      validationSchema={PasswordFormValidationSchema}
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
              label="Re-enter Password"
              onChangeText={handleChange('password')}
              onBlur={handleBlur('password')}
              value={values.password}
              error={errors.password && touched.password ? true : false}
              autoFocus={true}
              secureTextEntry
            />

            {renderFormError(touched, errors)}

            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!isValid || isSubmitting}
              loading={isSubmitting}
              style={{marginTop: 20}}>
              {submitButtonTitle}
            </Button>
            <Button onPress={onCancel} style={{marginTop: 15}}>
              Cancel
            </Button>
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({});

export default ConfirmAccountDeletionUsingPasswordForm;
