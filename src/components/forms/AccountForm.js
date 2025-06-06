import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const UserValidationSchema = Yup.object().shape({
  username: Yup.string().required('Username field is required.'),
  password: Yup.string().required('Password field is required.'),
  confirm_password: Yup.string()
    .required('Please re-enter your password.')
    .oneOf([Yup.ref('password'), null], 'Passwords must match.'),
});

const AccountForm = props => {
  const {
    editMode = false,
    onSubmit,
    initialValues = {username: ''},
    disabledUsernameField,
    submitButtonText = 'Next',
    onCancel,
  } = props;
  const {colors} = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isReEnterPasswordVisible, setIsReEnterPasswordVisible] =
    useState(false);

  const renderFormError = (touched, errors) => {
    if (
      (errors.username && touched.username) ||
      (errors.password && touched.password) ||
      (errors.confirm_password && touched.confirm_password)
    ) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.username || errors.password || errors.confirm_password}
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
        username: initialValues.username || '',
        password: '',
        confirm_password: '',
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
            {!editMode && (
              <View style={{marginBottom: 40, paddingHorizontal: 25}}>
                <Text
                  style={{
                    fontWeight: 'bold',
                    fontSize: 16,
                    marginBottom: 10,
                    textAlign: 'center',
                  }}>
                  Create your local root user account
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.neutralTint2,
                    textAlign: 'center',
                  }}>
                  {`The root user is the primary account with full control. It can create and manage other local users like admins, encoders, and more.`}
                </Text>
              </View>
            )}
            <TextInput
              label="Username"
              onChangeText={handleChange('username')}
              onBlur={handleBlur('username')}
              value={values.username}
              autoCapitalize="none"
              disabled={disabledUsernameField}
              error={errors.username && touched.username ? true : false}
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
                onChangeText={handleChange('confirm_password')}
                onBlur={handleBlur('confirm_password')}
                value={values.confirm_password}
                secureTextEntry={isReEnterPasswordVisible ? false : true}
                style={[styles.textInput, {flex: 1}]}
                autoCapitalize="none"
                error={
                  errors.confirm_password && touched.confirm_password
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

export default AccountForm;
