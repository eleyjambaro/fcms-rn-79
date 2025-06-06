import {StyleSheet, View, ScrollView} from 'react-native';
import {Button, Text, TextInput, Avatar, useTheme} from 'react-native-paper';
import React, {useState} from 'react';
import {Formik} from 'formik';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import useAuthContext from '../hooks/useAuthContext';
import CompanyForm from '../components/forms/CompanyForm';
import {createCompany} from '../localDbQueries/companies';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import AppIcon from '../components/icons/AppIcon';
import {useNavigation} from '@react-navigation/native';
import routes from '../constants/routes';

const CreateCompany = () => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const createCompanyMutation = useMutation(createCompany, {
    onSuccess: () => {
      queryClient.invalidateQueries('company');
      queryClient.invalidateQueries('hasCompany');
      queryClient.invalidateQueries('hasRootAccount');
    },
  });

  const [formErrorMessage, setFormErrorMessage] = useState('');

  const handleSubmit = async (values, actions) => {
    console.log(values);

    try {
      await createCompanyMutation.mutateAsync({
        values,
        onError: ({errorMessage}) => {
          setFormErrorMessage(() => errorMessage);
        },
      });
    } catch (error) {
      console.debug(error);
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

          <CompanyForm onSubmit={handleSubmit} />
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

export default CreateCompany;
