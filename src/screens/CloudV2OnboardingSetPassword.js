import React, {useState} from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {Button, Text, TextInput, useTheme, HelperText} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useMutation} from '@tanstack/react-query';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import {onboardingSetPassword} from '../serverDbQueries/v2/auth';
import routes from '../constants/routes';
import appDefaults from '../constants/appDefaults';
import CloudAppIcon from '../components/icons/CloudAppIcon';

const schema = Yup.object({
  password: Yup.string()
    .min(8, 'At least 8 characters')
    .required('New password is required'),
  confirm: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords do not match')
    .required('Re-type your new password'),
});

/**
 * Screen 2 of the team-member/executive first-login flow. Replaces the one-time
 * password the owner set with the member's own. Authenticated by the grant token
 * from the OTP screen (passed in navigation params — in memory only). On success
 * the session is established and CloudAuthStackV2 auto-advances (device / branch
 * setup, or straight into the app).
 */
const CloudV2OnboardingSetPassword = ({route, navigation}) => {
  const {colors} = useTheme();
  const {email, grantToken} = route.params ?? {};
  const [, {setAuthFromVerify}] = useCloudAuthContext();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [serverError, setServerError] = useState('');

  const mutation = useMutation(onboardingSetPassword);

  // No grant means the OTP step wasn't completed (or the params were lost).
  // Send the user back to sign in, which re-triggers the OTP step.
  if (!grantToken) {
    return (
      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <CloudAppIcon
          mainText={`${appDefaults.appDisplayName}`}
          subText=""
          containerStyle={{marginBottom: 0}}
        />
        <Text style={styles.title}>Session expired</Text>
        <Text style={styles.subtitle}>
          Please sign in again to verify your email and set your password.
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.navigate(routes.cloudV2SignIn())}
          style={styles.button}
          contentStyle={styles.buttonContent}>
          Back to Sign In
        </Button>
      </View>
    );
  }

  const handleSubmit = async (values, actions) => {
    setServerError('');
    try {
      const data = await mutation.mutateAsync({
        grant_token: grantToken,
        password: values.password,
        password_confirmation: values.confirm,
      });
      if (data?.status === 'success') {
        // Same shape as OTP verify — establishes the session; the auth stack
        // takes it from here.
        await setAuthFromVerify(data);
      } else {
        setServerError(data?.message || 'Could not set your password.');
      }
    } catch (error) {
      const status = error?.response?.status;
      // The grant is short-lived (12h) and single-use; if it's gone the member
      // must sign in again to get a fresh one via the OTP step.
      if (status === 401 || status === 403) {
        setServerError(
          'Your verification expired. Please sign in again to continue.',
        );
      } else {
        setServerError(
          error?.response?.data?.message ||
            'Unable to connect. Check your network and try again.',
        );
      }
    } finally {
      actions.setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, {backgroundColor: colors.surface}]}
      keyboardShouldPersistTaps="handled">
      <CloudAppIcon
        mainText={`${appDefaults.appDisplayName}`}
        subText=""
        containerStyle={{marginBottom: 0}}
      />

      <Text style={styles.title}>Set Your Password</Text>
      <Text style={styles.subtitle}>
        Choose a new password
        {email ? (
          <>
            {' for '}
            <Text style={{fontWeight: 'bold'}}>{email}</Text>
          </>
        ) : null}{' '}
        to finish setting up your account.
      </Text>

      <Formik
        initialValues={{password: '', confirm: ''}}
        validationSchema={schema}
        onSubmit={handleSubmit}>
        {({
          handleChange,
          handleBlur,
          handleSubmit: formikSubmit,
          values,
          errors,
          touched,
          isSubmitting,
        }) => (
          <View style={styles.form}>
            <TextInput
              label="New password"
              value={values.password}
              onChangeText={handleChange('password')}
              onBlur={handleBlur('password')}
              secureTextEntry={!passwordVisible}
              mode="outlined"
              error={touched.password && !!errors.password}
              style={styles.input}
              right={
                <TextInput.Icon
                  icon={passwordVisible ? 'eye-off' : 'eye'}
                  onPress={() => setPasswordVisible(v => !v)}
                />
              }
            />
            {touched.password && errors.password ? (
              <HelperText type="error">{errors.password}</HelperText>
            ) : null}

            <TextInput
              label="Re-type new password"
              value={values.confirm}
              onChangeText={handleChange('confirm')}
              onBlur={handleBlur('confirm')}
              secureTextEntry={!passwordVisible}
              mode="outlined"
              error={touched.confirm && !!errors.confirm}
              style={styles.input}
            />
            {touched.confirm && errors.confirm ? (
              <HelperText type="error">{errors.confirm}</HelperText>
            ) : null}

            {serverError ? (
              <HelperText type="error" style={styles.serverError}>
                {serverError}
              </HelperText>
            ) : null}

            <Button
              mode="contained"
              onPress={formikSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.button}
              contentStyle={styles.buttonContent}>
              Set Password
            </Button>
          </View>
        )}
      </Formik>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    marginHorizontal: 8,
    marginBottom: 28,
    opacity: 0.7,
    lineHeight: 22,
  },
  form: {
    gap: 4,
  },
  input: {
    marginBottom: 2,
  },
  serverError: {
    fontSize: 14,
    marginBottom: 4,
  },
  button: {
    marginTop: 16,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});

export default CloudV2OnboardingSetPassword;
