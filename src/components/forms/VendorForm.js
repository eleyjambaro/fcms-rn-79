import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import TextInputLabel from './TextInputLabel';
import FormRequiredFieldHelperText from './FormRequiredFieldsHelperText';

const TaxValidationSchema = Yup.object().shape({
  vendor_display_name: Yup.string().max(150, 'Too Long!').required('Required'),
});

const VendorForm = props => {
  const {
    editMode = false,
    initialValues = {
      first_name: '',
      last_name: '',
      company_name: '',
      vendor_display_name: '',
      tin: '',
      email: '',
      phone_number: '',
      mobile_number: '',
      remarks: '',
    },
    onSubmit,
    onCancel,
    submitButtonTitle = 'Create',
  } = props;

  return (
    <Formik
      initialValues={{
        first_name: initialValues.first_name || '',
        last_name: initialValues.last_name || '',
        company_name: initialValues.company_name || '',
        vendor_display_name: initialValues.vendor_display_name || '',
        tin: initialValues.tin || '',
        email: initialValues.email || '',
        phone_number: initialValues.phone_number || '',
        mobile_number: initialValues.mobile_number || '',
        remarks: initialValues.remarks || '',
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
            <FormRequiredFieldHelperText containerStyle={{marginBottom: 10}} />
            <TextInput
              label="First Name"
              onChangeText={handleChange('first_name')}
              onBlur={handleBlur('first_name')}
              autoCapitalize="words"
              value={values.first_name}
              error={errors.first_name && touched.first_name ? true : false}
            />
            <TextInput
              label="Last Name"
              onChangeText={handleChange('last_name')}
              onBlur={handleBlur('last_name')}
              autoCapitalize="words"
              value={values.last_name}
              error={errors.last_name && touched.last_name ? true : false}
            />
            <TextInput
              label="Company Name"
              onChangeText={handleChange('company_name')}
              onBlur={handleBlur('company_name')}
              autoCapitalize="words"
              value={values.company_name}
              error={errors.company_name && touched.company_name ? true : false}
            />
            <TextInput
              label={
                <TextInputLabel
                  label="Vendor Display Name"
                  required
                  error={
                    errors.vendor_display_name && touched.vendor_display_name
                      ? true
                      : false
                  }
                />
              }
              onChangeText={handleChange('vendor_display_name')}
              onBlur={handleBlur('vendor_display_name')}
              autoCapitalize="words"
              value={values.vendor_display_name}
              error={
                errors.vendor_display_name && touched.vendor_display_name
                  ? true
                  : false
              }
            />
            <TextInput
              label="TIN"
              onChangeText={handleChange('tin')}
              onBlur={handleBlur('tin')}
              keyboardType="numeric"
              value={values.tin}
              error={errors.tin && touched.tin ? true : false}
            />
            <TextInput
              label="Email"
              onChangeText={handleChange('email')}
              onBlur={handleBlur('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              value={values.email}
              error={errors.email && touched.email ? true : false}
            />
            <TextInput
              label="Phone Number"
              onChangeText={handleChange('phone_number')}
              onBlur={handleBlur('phone_number')}
              keyboardType="numeric"
              value={values.phone_number}
              error={errors.phone_number && touched.phone_number ? true : false}
            />
            <TextInput
              label="Mobile Number"
              onChangeText={handleChange('mobile_number')}
              onBlur={handleBlur('mobile_number')}
              keyboardType="numeric"
              value={values.mobile_number}
              error={
                errors.mobile_number && touched.mobile_number ? true : false
              }
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

export default VendorForm;
