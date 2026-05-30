import React, {useState} from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  useTheme,
  HelperText,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useMutation} from '@tanstack/react-query';

import routes from '../constants/routes';
import appDefaults from '../constants/appDefaults';
import CloudAppIcon from '../components/icons/CloudAppIcon';
import {signUp} from '../serverDbQueries/v2/auth';

const schema = Yup.object({
  email: Yup.string()
    .email('Enter a valid email')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords do not match')
    .required('Please re-type your password'),
});

const CloudV2SignUpStep2 = ({navigation, route}) => {
  const {colors} = useTheme();
  const {companyName, companyAddress, companyEmail} = route.params ?? {};
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [serverError, setServerError] = useState('');

  const mutation = useMutation(signUp);

  const handleSubmit = async (values, actions) => {
    setServerError('');
    try {
      const payload = {
        company_name: companyName,
        company_address: companyAddress ?? '',
        company_email: companyEmail,
        email: values.email,
        password: values.password,
      };

      const data = await mutation.mutateAsync(payload);

      if (data?.status === 'success') {
        // Navigate to OTP verification; email is needed to request OTP
        navigation.navigate(routes.cloudV2OTPVerification(), {
          email: values.email,
        });
      } else {
        setServerError(data?.message || 'Sign up failed. Please try again.');
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.errors?.email?.[0] ||
        'Unable to connect. Check your network and try again.';
      setServerError(msg);
    } finally {
      actions.setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {backgroundColor: colors.surface},
      ]}
      keyboardShouldPersistTaps="handled">
      <CloudAppIcon
        mainText={`${appDefaults.appDisplayName}`}
        subText=""
        containerStyle={{marginBottom: 0}}
      />

      <View style={styles.stepHeader}>
        <Text style={[styles.stepLabel, {color: colors.primary}]}>
          Step 2 of 2
        </Text>
        <Text style={styles.stepTitle}>Login Details</Text>
        <Text style={styles.stepSubtitle}>
          This will be your {appDefaults.appDisplayName} login.
        </Text>
      </View>

      <Formik
        initialValues={{
          email: companyEmail ?? '',
          password: '',
          confirmPassword: '',
        }}
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
              label="Email *"
              value={values.email}
              onChangeText={handleChange('email')}
              onBlur={handleBlur('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              error={touched.email && !!errors.email}
              style={styles.input}
            />
            {touched.email && errors.email ? (
              <HelperText type="error">{errors.email}</HelperText>
            ) : null}

            <TextInput
              label="Password *"
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
              label="Re-type Password *"
              value={values.confirmPassword}
              onChangeText={handleChange('confirmPassword')}
              onBlur={handleBlur('confirmPassword')}
              secureTextEntry={!confirmPasswordVisible}
              mode="outlined"
              error={touched.confirmPassword && !!errors.confirmPassword}
              style={styles.input}
              right={
                <TextInput.Icon
                  icon={confirmPasswordVisible ? 'eye-off' : 'eye'}
                  onPress={() => setConfirmPasswordVisible(v => !v)}
                />
              }
            />
            {touched.confirmPassword && errors.confirmPassword ? (
              <HelperText type="error">{errors.confirmPassword}</HelperText>
            ) : null}

            {serverError ? (
              <HelperText type="error" style={styles.serverError}>
                {serverError}
              </HelperText>
            ) : null}

            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                contentStyle={styles.buttonContent}>
                Back
              </Button>
              <Button
                mode="contained"
                onPress={formikSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
                style={styles.nextButton}
                contentStyle={styles.buttonContent}>
                Create Account
              </Button>
            </View>
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
  stepHeader: {
    marginBottom: 24,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    opacity: 0.65,
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  backButton: {
    flex: 1,
    borderRadius: 8,
  },
  nextButton: {
    flex: 2,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});

export default CloudV2SignUpStep2;
