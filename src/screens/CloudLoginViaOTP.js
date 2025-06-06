import {StyleSheet, View, Pressable} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  Avatar,
  useTheme,
  Portal,
  Modal,
  Title,
  Dialog,
  Paragraph,
  Headline,
} from 'react-native-paper';
import React, {useState} from 'react';
import {Formik} from 'formik';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import OTPForm from '../components/forms/OTPForm';
import {
  emergencyChangePassword,
  getRootAccountUsername,
  signInAccount,
} from '../localDbQueries/accounts';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import CompanyIcon from '../components/icons/CompanyIcon';
import {ScrollView} from 'react-native-gesture-handler';
import AccountForm from '../components/forms/AccountForm';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import CloudAppIcon from '../components/icons/CloudAppIcon';
import {
  getDefaultCloudEmail,
  getOTPThruEmailToLogin,
  loginUserViaOTPThruEmail,
} from '../serverDbQueries/auth';
import routes from '../constants/routes';
import appDefaults from '../constants/appDefaults';

const CloudLoginViaOTP = props => {
  const {navigation} = props;
  const {colors} = useTheme();
  const [_authState, {signIn}] = useCloudAuthContext();
  const queryClient = useQueryClient();
  const {
    isRefetching: isRefetchingDefaultCloudEmail,
    status: defaultCloudEmailStatus,
    data: defaultCloudEmailData,
    refetch: refetchDefaultCloudEmailStatus,
  } = useQuery(['defaultCloudEmail'], getDefaultCloudEmail);
  const {
    isRefetching: isRefetchingOTPThruEmail,
    status: otpThruEmailStatus,
    data: otpThruEmailData,
    refetch: refetchOTPThruEmailStatus,
  } = useQuery(['otpThruEmailToLogin'], getOTPThruEmailToLogin);

  const signInAccountViaOTPMutation = useMutation(loginUserViaOTPThruEmail, {
    onSuccess: () => {
      queryClient.invalidateQueries('loggedInUser');
      queryClient.invalidateQueries('defaultCloudEmail');
    },
  });

  const handleSubmit = async (values, actions) => {
    console.log(values);

    try {
      const signInAccountData = await signInAccountViaOTPMutation.mutateAsync({
        values,
        onError: ({errorMessage}) => {
          actions.setFieldError('otp', errorMessage);
        },
      });

      if (signInAccountData) {
        signIn(signInAccountData);
      }
    } catch (error) {
      console.debug(error);
    } finally {
      // actions.resetForm();
    }
  };

  if (
    otpThruEmailStatus === 'loading' ||
    isRefetchingOTPThruEmail ||
    defaultCloudEmailStatus === 'loading' ||
    isRefetchingDefaultCloudEmail
  ) {
    return (
      <DefaultLoadingScreen
        containerStyle={{backgroundColor: colors.surface}}
      />
    );
  }

  let otpStatusMessage = `To continue, verify it's you. We just sent your authentication code via email to ${defaultCloudEmailData}`;

  return (
    <>
      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <CloudAppIcon
          mainText={`${appDefaults.appDisplayName} Cloud`}
          subText=""
          containerStyle={{marginBottom: 0}}
        />
        <View style={{margin: 20, marginTop: 0, marginBottom: 30}}>
          <Text style={{textAlign: 'center', fontSize: 16}}>
            {otpStatusMessage}
          </Text>
        </View>
        <OTPForm onSubmit={handleSubmit} />
        <View style={{marginTop: 25, alignItems: 'center'}}>
          <View style={{alignItems: 'center'}}>
            <Text style={{fontSize: 16, marginRight: 6}}>
              Having trouble verifying via email?
            </Text>
            <Pressable
              style={{paddingVertical: 6}}
              onPress={() => {
                navigation.navigate(routes.cloudLogin());
              }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: colors.primary,
                  textAlign: 'center',
                }}>
                {'Try to connect using email and password'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
});

export default CloudLoginViaOTP;
