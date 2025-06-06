import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const UserValidationSchema = Yup.object().shape({
  name: Yup.string().required('Name field is required.'),
  company: Yup.string().required('Company Name field is required.'),
  email: Yup.string()
    .email('Email must be a valid email.')
    .required('Email field is required.'),
  password: Yup.string().required('Password field is required.'),
  password_confirmation: Yup.string()
    .required('Please re-enter your password.')
    .oneOf([Yup.ref('password'), null], 'Passwords must match.'),
});

const CloudAccountForm = props => {
  const {
    editMode = false,
    onSubmit,
    initialValues = {email: '', company: ''},
    disabledNameField,
    disabledEmailField,
    submitButtonText = 'Next',
    onCancel,
  } = props;
  const {colors} = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isReEnterPasswordVisible, setIsReEnterPasswordVisible] =
    useState(false);

  const renderFormError = (touched, errors) => {
    if (
      (errors.name && touched.name) ||
      (errors.company && touched.company) ||
      (errors.email && touched.email) ||
      (errors.password && touched.password) ||
      (errors.password_confirmation && touched.password_confirmation)
    ) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.name ||
            errors.company ||
            errors.email ||
            errors.password ||
            errors.password_confirmation}
        </Text>
      );
    }
  };

  const renderCancelButton = () => {
    if (editMode) {
      return (
        <Button
          onPress={() => {
            onCancel && onCancel();
          }}
          style={{marginTop: 15}}>
          Back
        </Button>
      );
    }
  };

  return (
    <Formik
      initialValues={{
        name: '',
        company: initialValues.company || '',
        email: initialValues.email || '',
        password: '',
        password_confirmation: '',
      }}
      validationSchema={UserValidationSchema}
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
              label="Name"
              onChangeText={handleChange('name')}
              onBlur={handleBlur('name')}
              value={values.name}
              autoCapitalize="sentences"
              disabled={disabledNameField}
              error={errors.name && touched.name ? true : false}
            />
            <TextInput
              label="Company Name"
              onChangeText={handleChange('company')}
              onBlur={handleBlur('company')}
              value={values.company}
              autoCapitalize="sentences"
              error={errors.company && touched.company ? true : false}
            />
            <TextInput
              label="Email"
              onChangeText={handleChange('email')}
              onBlur={handleBlur('email')}
              value={values.email}
              autoCapitalize="none"
              keyboardType="email-address"
              disabled={disabledEmailField}
              error={errors.email && touched.email ? true : false}
            />
            <View style={{flexDirection: 'row'}}>
              <TextInput
                label={editMode ? 'New Password' : 'Password'}
                onChangeText={handleChange('password')}
                onBlur={handleBlur('password')}
                value={values.password}
                secureTextEntry={isPasswordVisible ? false : true}
                style={[styles.textInput, {flex: 1}]}
                autoCapitalize="none"
                error={errors.password && touched.password ? true : false}
              />
              <MaterialCommunityIcons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={25}
                color={colors.dark}
                onPress={() => setIsPasswordVisible(() => !isPasswordVisible)}
                style={{position: 'absolute', top: 18, right: 15}}
              />
            </View>
            <View style={{flexDirection: 'row'}}>
              <TextInput
                label={editMode ? 'Re-enter New Password' : 'Re-enter Password'}
                onChangeText={handleChange('password_confirmation')}
                onBlur={handleBlur('password_confirmation')}
                value={values.password_confirmation}
                secureTextEntry={isReEnterPasswordVisible ? false : true}
                style={[styles.textInput, {flex: 1}]}
                autoCapitalize="none"
                error={
                  errors.password_confirmation && touched.password_confirmation
                    ? true
                    : false
                }
              />
              <MaterialCommunityIcons
                name={
                  isReEnterPasswordVisible ? 'eye-off-outline' : 'eye-outline'
                }
                size={25}
                color={colors.dark}
                onPress={() =>
                  setIsReEnterPasswordVisible(() => !isReEnterPasswordVisible)
                }
                style={{position: 'absolute', top: 18, right: 15}}
              />
            </View>
            {renderFormError(touched, errors)}

            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!dirty || !isValid || isSubmitting}
              loading={isSubmitting}
              style={{marginTop: 20}}>
              {submitButtonText}
            </Button>
            {renderCancelButton()}
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({
  textInput: {},
});

export default CloudAccountForm;
