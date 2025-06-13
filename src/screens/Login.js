import {StyleSheet, View, ScrollView} from 'react-native';
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
} from 'react-native-paper';
import React, {useState} from 'react';
import {Formik} from 'formik';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import useAuthContext from '../hooks/useAuthContext';
import LoginForm from '../components/forms/LoginForm';
import {
  emergencyChangePassword,
  getRootAccountUsername,
  signInAccount,
} from '../localDbQueries/accounts';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import CompanyIcon from '../components/icons/CompanyIcon';
import AccountForm from '../components/forms/AccountForm';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';

const Login = () => {
  const {colors} = useTheme();
  const [_authState, {signIn}] = useAuthContext();
  const queryClient = useQueryClient();
  const signInAccountMutation = useMutation(signInAccount, {
    onSuccess: () => {
      queryClient.invalidateQueries('account');
      queryClient.invalidateQueries('hasRootAccount');
    },
  });
  const emergencyChangePasswordMutation = useMutation(emergencyChangePassword, {
    onSuccess: () => {
      queryClient.invalidateQueries('account');
    },
  });
  const [emergencyChangePasswordMode, setEmergencyChangePasswordMode] =
    useState(false);
  const [
    changePasswordSuccessDialogVisible,
    setChangePasswordSuccessDialogVisible,
  ] = useState(false);
  const [rootAccountUsername, setRootAccountUsername] = useState('');

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      const signInAccountData = await signInAccountMutation.mutateAsync({
        values,
        onError: ({errorMessage}) => {
          actions.setFieldError('username', errorMessage);
          actions.setFieldError('password', errorMessage);
        },
        onEmergencyPasswordRecovery: ({username}) => {
          actions.resetForm();
          username && actions.setFieldValue('username', username);
          actions.setFieldTouched('username', false);
          actions.setFieldTouched('password', false);

          setRootAccountUsername(() => username);
          setEmergencyChangePasswordMode(() => true);
        },
      });

      if (signInAccountData) {
        signIn(signInAccountData.result);
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

  const handleEmergencyPasswordRecoverySubmit = async (values, actions) => {
    console.log(values);
    try {
      const updatedAccountData =
        await emergencyChangePasswordMutation.mutateAsync({
          values,
        });

      if (updatedAccountData) {
        if (updatedAccountData.result) {
          setEmergencyChangePasswordMode(() => false);
          setChangePasswordSuccessDialogVisible(() => true);
        }
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

  const renderAccountForm = () => {
    const username = rootAccountUsername;

    return (
      <AccountForm
        initialValues={{
          username: username || '',
        }}
        editMode
        disabledUsernameField
        submitButtonText="Submit"
        onSubmit={handleEmergencyPasswordRecoverySubmit}
        onCancel={() => setEmergencyChangePasswordMode(() => false)}
      />
    );
  };

  return (
    <>
      <Portal>
        <Modal
          visible={emergencyChangePasswordMode}
          onDismiss={() => setEmergencyChangePasswordMode(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 20, textAlign: 'center'}}>
            Reset Root Account Password
          </Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderAccountForm()}
          </ScrollView>
        </Modal>
      </Portal>

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

      <ScrollView style={{backgroundColor: colors.surface}}>
        <View style={[styles.container, {backgroundColor: colors.surface}]}>
          <CompanyIcon />
          <LoginForm onSubmit={handleSubmit} />
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    paddingTop: 100,
    paddingBottom: 50,
    justifyContent: 'center',
  },
});

export default Login;
