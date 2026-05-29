import React, {useState} from 'react';
import {View, StyleSheet, Pressable, ScrollView} from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Text,
  TextInput,
  useTheme,
  HelperText,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useMutation} from '@tanstack/react-query';

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

const CloudV2SignIn = ({navigation}) => {
  const {colors} = useTheme();
  const [cloudAuthState, {signIn: dispatchSignIn}] = useCloudAuthContext();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [serverError, setServerError] = useState('');

  const mutation = useMutation(signIn);

  const handleSubmit = async (values, actions) => {
    setServerError('');
    try {
      const payload = {...values};
      if (cloudAuthState.deviceId) {
        payload.device_id = cloudAuthState.deviceId;
      }
      const data = await mutation.mutateAsync(payload);
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
      <Text style={styles.subtitle}>
        Sign in to your {appDefaults.appDisplayName} account to connect this
        device.
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
        <Text style={styles.footerText}>Don't have an account?</Text>
        <Pressable
          style={styles.footerLink}
          onPress={() => navigation.navigate(routes.cloudV2SignUpStep1())}>
          <Text style={[styles.footerLinkText, {color: colors.primary}]}>
            Sign up
          </Text>
        </Pressable>
      </View>

      <Card style={styles.teamMemberCard} elevation={2}>
        <Card.Content style={styles.teamMemberCardContent}>
          {cloudAuthState.deviceId && cloudAuthState.designatedBranch ? (
            <View style={styles.deviceInfoCard}>
              <View style={styles.deviceInfoRow}>
                {cloudAuthState.deviceCompanyInfo?.logo_url ? (
                  <Avatar.Image
                    source={{uri: cloudAuthState.deviceCompanyInfo.logo_url}}
                    size={52}
                  />
                ) : (
                  <Avatar.Text
                    label={(
                      cloudAuthState.deviceCompanyInfo?.display_name ||
                      cloudAuthState.deviceCompanyInfo?.name ||
                      '?'
                    )
                      .charAt(0)
                      .toUpperCase()}
                    size={52}
                    color={colors.onPrimary ?? '#fff'}
                    style={{backgroundColor: colors.primary}}
                  />
                )}
                <View style={styles.deviceInfoText}>
                  {cloudAuthState.deviceCompanyInfo?.display_name ||
                  cloudAuthState.deviceCompanyInfo?.name ? (
                    <Text style={styles.deviceCompanyName}>
                      {cloudAuthState.deviceCompanyInfo.display_name ||
                        cloudAuthState.deviceCompanyInfo.name}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.deviceBranchName,
                      {color: colors.onSurfaceVariant ?? colors.placeholder},
                    ]}>
                    {cloudAuthState.designatedBranch.display_name ??
                      cloudAuthState.designatedBranch.name}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.divider,
                  {
                    backgroundColor:
                      colors.outlineVariant ?? colors.placeholder,
                  },
                ]}
              />
            </View>
          ) : null}

          <View style={styles.teamMemberRow}>
            <Text style={styles.footerText}>Team member?</Text>
            <Pressable
              style={styles.footerLink}
              onPress={() =>
                navigation.navigate(routes.cloudV2SubAccountSignIn())
              }>
              <Text style={[styles.footerLinkText, {color: colors.primary}]}>
                Sign in here
              </Text>
            </Pressable>
          </View>
          {!cloudAuthState.deviceId ? (
            <Text
              style={[
                styles.deviceHint,
                {color: colors.onSurfaceVariant ?? colors.placeholder},
              ]}>
              Device setup required — sign in as account owner first.
            </Text>
          ) : null}
        </Card.Content>
      </Card>
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
  teamMemberCard: {
    marginTop: 32,
    borderRadius: 12,
  },
  teamMemberCardContent: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  deviceInfoCard: {
    width: '100%',
    gap: 0,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  deviceInfoText: {
    flexShrink: 1,
    gap: 3,
  },
  deviceCompanyName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  deviceBranchName: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.4,
  },
  teamMemberRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  deviceHint: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 4,
  },
});

export default CloudV2SignIn;
