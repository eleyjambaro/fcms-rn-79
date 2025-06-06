import {StyleSheet, View} from 'react-native';
import {Button, Text, TextInput, Avatar, useTheme} from 'react-native-paper';
import React, {useState} from 'react';
import {Formik} from 'formik';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import StepIndicator from 'react-native-step-indicator';

import useAuthContext from '../hooks/useAuthContext';
import AccountForm from '../components/forms/AccountForm';
import {createAccount} from '../localDbQueries/accounts';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import AppIcon from '../components/icons/AppIcon';
import CompanyForm from '../components/forms/CompanyForm';

const AccountSetup = () => {
  const {colors} = useTheme();
  const [_authState, {signIn, signUp}] = useAuthContext();
  const queryClient = useQueryClient();
  const createAccountMutation = useMutation(createAccount, {
    onSuccess: () => {
      queryClient.invalidateQueries('account');
      queryClient.invalidateQueries('hasRootAccount');
    },
  });
  const [currentPosition, setCurrentPosition] = useState(0);
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [rootAccount, setRootAccount] = useState(null);
  const [company, setCompany] = useState(null);

  const labels = ['Create Account', 'Company Details'];

  const customStyles = {
    stepIndicatorSize: 25,
    currentStepIndicatorSize: 30,
    separatorStrokeWidth: 2,
    currentStepStrokeWidth: 3,
    stepStrokeCurrentColor: colors.primary,
    stepStrokeWidth: 3,
    stepStrokeFinishedColor: colors.accent,
    stepStrokeUnFinishedColor: '#aaaaaa',
    separatorFinishedColor: colors.accent,
    separatorUnFinishedColor: '#aaaaaa',
    stepIndicatorFinishedColor: colors.accent,
    stepIndicatorUnFinishedColor: '#ffffff',
    stepIndicatorCurrentColor: '#ffffff',
    stepIndicatorLabelFontSize: 13,
    currentStepIndicatorLabelFontSize: 13,
    stepIndicatorLabelCurrentColor: colors.primary,
    stepIndicatorLabelFinishedColor: '#ffffff',
    stepIndicatorLabelUnFinishedColor: '#aaaaaa',
    labelColor: colors.dark,
    labelSize: 13,
    currentStepLabelColor: colors.primary,
  };

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
      console.debug(error);
      return;
    } finally {
      actions.resetForm();
    }
  };

  const renderForm = () => {
    if (!rootAccount) {
      return <AccountForm onSubmit={handleSubmit} />;
    } else if (!company) {
      return <CompanyForm onSubmit={handleSubmit} />;
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
      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <AppIcon />
        <View style={{marginBottom: 25}}>
          <StepIndicator
            customStyles={customStyles}
            currentPosition={currentPosition}
            labels={labels}
            stepCount={2}
          />
        </View>

        {renderForm()}
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

export default AccountSetup;
