import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const OTPValidationSchema = Yup.object().shape({
  otp: Yup.string()
    .max(6, 'OTP must be at most 6 digits')
    .required('You must enter your One-Time Pin.'),
});

const OTPForm = props => {
  const {item, onSubmit, onCancel} = props;
  const {colors} = useTheme();

  const renderFormError = (touched, errors) => {
    if (errors.otp && touched.otp) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>{errors.otp}</Text>
      );
    }
  };

  return (
    <Formik
      initialValues={{
        otp: '',
        timezone: 'Asia/Manila',
      }}
      validationSchema={OTPValidationSchema}
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
          isValid,
          isSubmitting,
        } = props;

        return (
          <>
            <TextInput
              label="Enter 6-digit Code"
              placeholder="XXXXXX"
              onChangeText={handleChange('otp')}
              onBlur={handleBlur('otp')}
              value={values.otp}
              autoCapitalize="none"
              keyboardType="number-pad"
              error={errors.otp && touched.otp ? true : false}
            />
            {renderFormError(touched, errors)}

            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!dirty || !isValid || isSubmitting}
              loading={isSubmitting}
              style={{marginTop: 20}}>
              Verify
            </Button>
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({
  textInput: {},
});

export default OTPForm;
