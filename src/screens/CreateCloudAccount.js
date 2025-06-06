import {StyleSheet, View, Pressable} from 'react-native';
import {Button, Text, TextInput, Avatar, useTheme} from 'react-native-paper';
import React, {useState} from 'react';
import {Formik} from 'formik';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import CloudAccountForm from '../components/forms/CloudAccountForm';
import {getDefaultCloudEmail, signUpUser} from '../serverDbQueries/auth';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import CloudAppIcon from '../components/icons/CloudAppIcon';
import routes from '../constants/routes';
import {getCompany} from '../localDbQueries/companies';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import appDefaults from '../constants/appDefaults';

const CreateCloudAccount = props => {
  const {navigation} = props;
  const {colors} = useTheme();
  const [_authState, {signIn, signUp}] = useCloudAuthContext();
  const {status: getCompanyStatus, data: getCompanyData} = useQuery(
    ['company'],
    getCompany,
  );
  const queryClient = useQueryClient();
  const {
    isRefetching: isRefetchingDefaultCloudEmail,
    status: defaultCloudEmailStatus,
    data: defaultCloudEmailData,
    refetch: refetchDefaultCloudEmailStatus,
  } = useQuery(['defaultCloudEmail'], getDefaultCloudEmail);
  const createAccountMutation = useMutation(signUpUser, {
    onSuccess: () => {
      // queryClient.invalidateQueries('defaultCloudEmail');
    },
  });

  const [formErrorMessage, setFormErrorMessage] = useState('');

  const handleSubmit = async (values, actions) => {
    console.log(values);

    try {
      const createAccountData = await createAccountMutation.mutateAsync({
        values,
        onError: ({errorMessage}) => {
          setFormErrorMessage(() => errorMessage);
        },
      });

      if (createAccountData) {
        queryClient.invalidateQueries('defaultCloudEmail');

        navigation.navigate(routes.cloudLoginViaOTPThruEmail());
        // signUp(createAccountData);
      }
    } catch (error) {
      console.debug(error);
      return;
    } finally {
      // actions.resetForm();
    }
  };

  if (getCompanyStatus === 'loading' || defaultCloudEmailStatus === 'loading') {
    return (
      <DefaultLoadingScreen
        containerStyle={{backgroundColor: colors.surface}}
      />
    );
  }

  const company = getCompanyData?.result;
  const companyName = company.company_display_name || '';

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
        <CloudAppIcon
          mainText={`${appDefaults.appDisplayName} Cloud`}
          subText=""
          containerStyle={{marginBottom: 0}}
        />
        <View style={{margin: 20, marginTop: 0, marginBottom: 30}}>
          <Text style={{textAlign: 'center', fontSize: 16}}>
            {`Create an ${appDefaults.appDisplayName} Cloud account to connect this device and start uploading your data.`}
          </Text>
        </View>
        <CloudAccountForm
          onSubmit={handleSubmit}
          initialValues={{
            company: companyName,
            email: defaultCloudEmailData || '',
          }}
          submitButtonText="Submit"
        />
        <View style={{marginTop: 25, alignItems: 'center'}}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={{fontSize: 16, marginRight: 6}}>
              Already have an account?
            </Text>
            <Pressable
              style={{paddingVertical: 6}}
              onPress={() => {
                navigation.navigate(routes.cloudStart());
              }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: colors.primary,
                  textAlign: 'center',
                }}>
                {'Connect account'}
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

export default CreateCloudAccount;
