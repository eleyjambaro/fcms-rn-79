import React, {useState} from 'react';
import {View, StyleSheet, Pressable, ScrollView} from 'react-native';
import {
  Avatar,
  Button,
  Text,
  TextInput,
  useTheme,
  HelperText,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useMutation} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import {signIn} from '../serverDbQueries/v2/auth';
import routes from '../constants/routes';
import appDefaults from '../constants/appDefaults';
import CloudAppIcon from '../components/icons/CloudAppIcon';

const schema = Yup.object({
  email: Yup.string()
    .email('Enter a valid email')
    .required('Email is required'),
  password: Yup.string().required('Password is required'),
});

const CloudV2SubAccountSignIn = ({navigation}) => {
  const {colors} = useTheme();
  const [cloudAuthState, {signIn: dispatchSignIn}] = useCloudAuthContext();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [serverError, setServerError] = useState('');

  const mutation = useMutation(signIn);

  const handleSubmit = async (values, actions) => {
    setServerError('');
    try {
      const data = await mutation.mutateAsync({
        email: values.email,
        password: values.password,
        device_id: cloudAuthState.deviceId,
      });

      if (data?.status === 'success') {
        await dispatchSignIn(data);
      } else {
        setServerError(data?.message || 'Sign in failed. Please try again.');
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        'Unable to connect. Check your network and try again.';
      setServerError(msg);
    } finally {
      actions.setSubmitting(false);
    }
  };

  // Device not set up yet — show a blocking informational state before the form
  if (!cloudAuthState.deviceId) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {backgroundColor: colors.surface},
        ]}>
        <CloudAppIcon
          mainText={`${appDefaults.appDisplayName}`}
          subText=""
          containerStyle={{marginBottom: 0}}
        />
        <View style={styles.deviceNotReady}>
          <MaterialCommunityIcons
            name="devices"
            size={52}
            color={colors.primary}
            style={styles.deviceIcon}
          />
          <Text style={styles.deviceNotReadyTitle}>Device Not Ready</Text>
          <Text
            style={[
              styles.deviceNotReadyMessage,
              {color: colors.onSurfaceVariant ?? colors.placeholder},
            ]}>
            This device hasn't been set up by an account owner yet. Your manager
            needs to sign in on this device first to enable team member access.
          </Text>
        </View>
        <Button
          mode="contained"
          onPress={() => navigation.navigate(routes.cloudV2SignIn())}
          style={styles.button}
          contentStyle={styles.buttonContent}>
          Account Owner? Sign In Here
        </Button>
      </ScrollView>
    );
  }

  const companyInfo = cloudAuthState.deviceCompanyInfo;
  const branch = cloudAuthState.designatedBranch;
  const companyLabel = companyInfo?.display_name || companyInfo?.name || null;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {backgroundColor: colors.surface},
      ]}
      keyboardShouldPersistTaps="handled">
      {companyInfo ? (
        <View style={styles.companyHeader}>
          {companyInfo.logo_url ? (
            <Avatar.Image source={{uri: companyInfo.logo_url}} size={80} />
          ) : (
            <Avatar.Text
              label={(companyLabel || '?').charAt(0).toUpperCase()}
              size={80}
              color={colors.onPrimary ?? '#fff'}
              style={{backgroundColor: colors.primary}}
            />
          )}
          <View style={styles.companyHeaderText}>
            {companyLabel ? (
              <Text style={styles.companyName}>{companyLabel}</Text>
            ) : null}
            {branch ? (
              <Text
                style={[
                  styles.branchName,
                  {color: colors.onSurfaceVariant ?? colors.placeholder},
                ]}>
                {branch.display_name ?? branch.name}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <CloudAppIcon
          mainText={`${appDefaults.appDisplayName}`}
          subText=""
          containerStyle={{marginBottom: 0}}
        />
      )}
      <Text style={styles.subtitle}>
        Sign in as a team member to access this device.
      </Text>

      <Formik
        initialValues={{email: '', password: ''}}
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
              label="Email"
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
              label="Password"
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
              Sign In
            </Button>
          </View>
        )}
      </Formik>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Account owner?</Text>
        <Pressable
          style={styles.footerLink}
          onPress={() => navigation.navigate(routes.cloudV2SignIn())}>
          <Text style={[styles.footerLinkText, {color: colors.primary}]}>
            Sign in here
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    marginHorizontal: 8,
    marginBottom: 28,
    opacity: 0.7,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    gap: 6,
  },
  footerText: {
    fontSize: 15,
  },
  footerLink: {
    paddingVertical: 4,
  },
  footerLinkText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  companyHeader: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  companyHeaderText: {
    alignItems: 'center',
    gap: 2,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  branchName: {
    fontSize: 14,
    textAlign: 'center',
  },
  deviceNotReady: {
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 32,
  },
  deviceIcon: {
    marginBottom: 16,
    opacity: 0.85,
  },
  deviceNotReadyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  deviceNotReadyMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default CloudV2SubAccountSignIn;
