import {StyleSheet, View, ScrollView} from 'react-native';
import {Button, Text, TextInput, Avatar, useTheme} from 'react-native-paper';
import React, {useState} from 'react';
import {Formik} from 'formik';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import useAuthContext from '../hooks/useAuthContext';
import AccountForm from '../components/forms/AccountForm';
import {createAccount} from '../localDbQueries/accounts';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import AppIcon from '../components/icons/AppIcon';

const CreateAccount = () => {
  const {colors} = useTheme();
  const [_authState, {signIn, signUp}] = useAuthContext();
  const queryClient = useQueryClient();
  const createAccountMutation = useMutation(createAccount, {
    onSuccess: () => {
      queryClient.invalidateQueries('account');
      queryClient.invalidateQueries('hasRootAccount');
    },
  });

  const [formErrorMessage, setFormErrorMessage] = useState('');

  const handleSubmit = async (values, actions) => {
    console.log(values);

    try {
      const createAccountData = await createAccountMutation.mutateAsync({
        values,
        isRootAccount: true,
        onError: ({errorMessage}) => {
          setFormErrorMessage(() => errorMessage);
        },
      });

      if (createAccountData) {
        signUp(createAccountData.result);
      }
    } catch (error) {
      console.debug('Test error: ', error);
      return;
    } finally {
      actions.resetForm();
    }
  };

  return (
    <>
      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => {
          setFormErrorMessage(() => '');
        }}
      />
      <ScrollView style={{backgroundColor: colors.surface}}>
        <View style={[styles.container, {backgroundColor: colors.surface}]}>
          <AppIcon />
          <AccountForm onSubmit={handleSubmit} />
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    paddingTop: 60,
    paddingBottom: 50,
    justifyContent: 'center',
  },
});

export default CreateAccount;
