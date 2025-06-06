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
  Banner,
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
  isEmailRegistered,
  loginUserViaOTPThruEmail,
} from '../serverDbQueries/auth';
import routes from '../constants/routes';
import appDefaults from '../constants/appDefaults';

const CloudStart = props => {
  const {navigation} = props;
  const {colors} = useTheme();
  const [_authState, {signIn}] = useCloudAuthContext();
  const [visible, setVisible] = useState(true);
  const {
    isRefetching: isRefetchingIsEmailRegistered,
    status: isEmailRegisteredStatus,
    data: isEmailRegisteredData,
    error: isEmailRegisteredError,
    refetch: refetchIsEmailRegistered,
  } = useQuery(['isEmailRegistered'], isEmailRegistered);

  const handlePressConnect = () => {
    if (isEmailRegisteredStatus === 'loading' || isRefetchingIsEmailRegistered)
      return;

    let route = routes.cloudLoginViaOTPThruEmail();

    if (!isEmailRegisteredData) {
      route = routes.cloudSignup();
    }

    navigation.navigate(route);
  };

  if (isEmailRegisteredStatus === 'loading' || isRefetchingIsEmailRegistered) {
    return (
      <DefaultLoadingScreen
        containerStyle={{backgroundColor: colors.surface}}
      />
    );
  }

  if (isEmailRegisteredStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  return (
    <>
      {/* <Portal>
        <Banner
          visible={visible}
          icon="lightbulb-on-outline"
          actions={[
            {
              label: 'Okay',
              onPress: () => setVisible(false),
            },
            // {
            //   label: `Don't show it again`,
            //   onPress: () => setVisible(false),
            // },
          ]}>
          {`You can still use ${appDefaults.appDisplayName} app even offline. Once you're done connecting your cloud account to this device, you only need an internet connection everytime you want to send data to server.`}
        </Banner>
      </Portal> */}
      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <CloudAppIcon
          mainText={`${appDefaults.appDisplayName} Cloud`}
          subText=""
          containerStyle={{marginBottom: 0}}
        />
        <View style={{margin: 20, marginTop: 0, marginBottom: 30}}>
          <Text style={{textAlign: 'center', fontSize: 16}}>
            {`Connect your ${appDefaults.appDisplayName} Cloud to this device and start uploading your data to your account.`}
          </Text>
        </View>
        <Button
          mode="contained"
          onPress={handlePressConnect}
          loading={
            isEmailRegisteredStatus === 'loading' ||
            isRefetchingIsEmailRegistered
          }
          disabled={
            isEmailRegisteredStatus === 'loading' ||
            isRefetchingIsEmailRegistered
          }
          style={{marginTop: 20}}>
          Connect your Cloud Account
        </Button>
        <View style={{marginTop: 25, alignItems: 'center'}}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={{fontSize: 16, marginRight: 6}}>
              Don't have an account?
            </Text>
            <Pressable
              style={{paddingVertical: 6}}
              onPress={() => {
                navigation.navigate(routes.cloudSignup());
              }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: colors.primary,
                  textAlign: 'center',
                }}>
                {'Sign up'}
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

export default CloudStart;
