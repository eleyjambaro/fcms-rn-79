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
import CloudLoginForm from '../components/forms/CloudLoginForm';
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
import {getDefaultCloudEmail, loginUser} from '../serverDbQueries/auth';
import routes from '../constants/routes';
import appDefaults from '../constants/appDefaults';

const CloudLogin = props => {
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
  const signInAccountMutation = useMutation(loginUser, {
    onSuccess: () => {
      queryClient.invalidateQueries('loggedInUser');
      queryClient.invalidateQueries('defaultCloudEmail');
    },
  });
  const [
    changePasswordSuccessDialogVisible,
    setChangePasswordSuccessDialogVisible,
  ] = useState(false);

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      const signInAccountData = await signInAccountMutation.mutateAsync({
        values,
        onError: ({errorMessage}) => {
          actions.setFieldError('email', errorMessage);
          actions.setFieldError('password', errorMessage);
        },
      });

      if (signInAccountData) {
        signIn(signInAccountData);
      }
    } catch (error) {
      console.debug(error);
    } finally {
      /**
       * TODO: Reset password field only instead of resetting form data
       */
      // actions.resetForm();
    }
  };

  if (defaultCloudEmailStatus === 'loading') {
    return (
      <DefaultLoadingScreen
        containerStyle={{backgroundColor: colors.surface}}
      />
    );
  }

  const cloudLoginFormInitialValues = {
    email: defaultCloudEmailData || '',
  };

  return (
    <>
      <Portal>
        <Dialog
          visible={changePasswordSuccessDialogVisible}
          onDismiss={() => setChangePasswordSuccessDialogVisible(() => false)}>
          <Dialog.Title>Password Changed!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{`Your root account password has been successfully updated. Please login with your new password to continue.`}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setChangePasswordSuccessDialogVisible(() => false);
              }}>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <CloudAppIcon
          mainText={`${appDefaults.appDisplayName} Cloud`}
          subText=""
          containerStyle={{marginBottom: 0}}
        />
        <View style={{margin: 20, marginTop: 0, marginBottom: 30}}>
          <Text style={{textAlign: 'center', fontSize: 16}}>
            {`Connect this device using your ${appDefaults.appDisplayName} Cloud email and password.`}
          </Text>
        </View>
        <CloudLoginForm
          initialValues={cloudLoginFormInitialValues}
          onSubmit={handleSubmit}
        />
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

export default CloudLogin;
