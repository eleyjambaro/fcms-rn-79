import {StyleSheet, View, ScrollView, Linking} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  Avatar,
  useTheme,
  Portal,
  Dialog,
} from 'react-native-paper';
import React, {useState} from 'react';
import {Formik} from 'formik';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useNavigation, useRoute} from '@react-navigation/native';

import useAuthContext from '../hooks/useAuthContext';
import CompanyForm from '../components/forms/CompanyForm';
import {
  createCompany,
  getCompany,
  updateCompany,
} from '../localDbQueries/companies';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import AppIcon from '../components/icons/AppIcon';
import {getSettings, updateSettings} from '../localDbQueries/settings';
import BannerAdComponent from '../components/ads/BannerAdComponent';
import {adUnitIds} from '../constants/adUnitIds';

const UpdateCompany = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const {status, data} = useQuery(['company'], getCompany);
  const updateCompanyMutation = useMutation(updateCompany, {
    onSuccess: () => {
      queryClient.invalidateQueries('company');
    },
  });

  const {status: getSettingsStatus, data: getSettingsData} = useQuery(
    [
      'settings',
      {settingNames: ['logo_display_company_name', 'logo_display_branch']},
    ],
    getSettings,
  );
  const updateSettingsMutation = useMutation(updateSettings, {
    onSuccess: () => {
      queryClient.invalidateQueries('settings');
    },
  });

  const [
    needStorageManagementPermissionDialogVisible,
    setNeedStorageManagementPermissionDialogVisible,
  ] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState('');

  const handleSubmit = async (values, actions) => {
    console.log(values);

    try {
      await updateSettingsMutation.mutateAsync({
        values: [
          {
            name: 'logo_display_company_name',
            value: values.logo_display_company_name,
          },
          {
            name: 'logo_display_branch',
            value: values.logo_display_branch,
          },
        ],
      });

      await updateCompanyMutation.mutateAsync({
        updatedValues: values,
      });

      actions.resetForm();
      navigation.goBack();
    } catch (error) {
      console.debug(error);

      if (error.code === 'ENOENT') {
        setNeedStorageManagementPermissionDialogVisible(() => true);
      } else {
      }
    }
  };

  if (status === 'loading' || getSettingsStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error' || getSettingsStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const settings = getSettingsData?.resultMap;
  const company = data?.result;

  if (!settings) return null;
  if (!company) return null;

  return (
    <>
      <Portal>
        <Dialog
          visible={needStorageManagementPermissionDialogVisible}
          onDismiss={() =>
            setNeedStorageManagementPermissionDialogVisible(() => false)
          }>
          <Dialog.Title>
            Files and Media Management Permission Needed
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{marginBottom: 15}}>
              In order to change company logo with your selected file, your
              permission for management of all files is needed.
            </Text>
            <Text style={{marginBottom: 15}}>
              Go to your device's{' '}
              <Text
                onPress={() => Linking.openSettings()}
                style={{color: colors.primary, fontWeight: 'bold'}}>
                Settings
              </Text>
              {', then look for '}
              <Text style={{color: colors.dark, fontWeight: 'bold'}}>
                "Permissions"
              </Text>
              {' (in some devices, you can find "Permissions" under '}
              <Text style={{color: colors.dark, fontWeight: 'bold'}}>
                Privacy
              </Text>
              {' section of settings page), then go to '}
              <Text style={{color: colors.dark, fontWeight: 'bold'}}>
                Files and media
              </Text>
              {' listed under Allowed permission, and '}
              <Text style={{color: colors.dark, fontWeight: 'bold'}}>
                Allow management of all files
              </Text>
              {' for this app.'}
            </Text>
            <Text style={{marginBottom: 0}}>
              Tap the close button and save your changes once you're done.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                Linking.openSettings();
              }}>
              Open Settings
            </Button>
            <Button
              onPress={() => {
                setNeedStorageManagementPermissionDialogVisible(() => false);
              }}>
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => {
          setFormErrorMessage(() => '');
        }}
      />
      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <CompanyForm
            initialValues={{
              ...company,
              logo_display_company_name:
                settings.logo_display_company_name || '0',
              logo_display_branch: settings.logo_display_branch || '0',
            }}
            editMode={true}
            onSubmit={handleSubmit}
          />
        </ScrollView>
        <View>
          <BannerAdComponent unitId={adUnitIds.companyProfileScreenBanner} />
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

export default UpdateCompany;
