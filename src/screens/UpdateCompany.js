import {StyleSheet, View, ScrollView, Linking} from 'react-native';
import {Button, Text, useTheme, Portal, Dialog} from 'react-native-paper';
import React, {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useNavigation} from '@react-navigation/native';

import CompanyForm from '../components/forms/CompanyForm';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import BannerAdComponent from '../components/ads/BannerAdComponent';
import {adUnitIds} from '../constants/adUnitIds';
import {
  getCloudCompany,
  updateCloudCompany,
  uploadCloudCompanyLogo,
} from '../serverDbQueries/v2/companies';
import {updateBranch} from '../serverDbQueries/v2/branches';
import useCloudAuthContext from '../hooks/useCloudAuthContext';

const UpdateCompany = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [cloudState, cloudAuthActions] = useCloudAuthContext();
  const {designatedBranch} = cloudState;
  const {refreshCloudAuthCompany} = cloudAuthActions;

  const {status, data} = useQuery(['cloudCompany'], getCloudCompany);

  const updateCloudCompanyMutation = useMutation(updateCloudCompany, {
    onSuccess: () => {
      queryClient.invalidateQueries(['cloudCompany']);
    },
  });

  const uploadCloudCompanyLogoMutation = useMutation(uploadCloudCompanyLogo, {
    onSuccess: () => {
      queryClient.invalidateQueries(['cloudCompany']);
    },
  });

  const updateBranchMutation = useMutation(updateBranch);

  const [
    needStorageManagementPermissionDialogVisible,
    setNeedStorageManagementPermissionDialogVisible,
  ] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState('');

  const handleSubmit = async (values, actions) => {
    try {
      if (values.has_new_selected_logo_file === '1' && values.logo_file_uri) {
        await uploadCloudCompanyLogoMutation.mutateAsync({
          fileUri: values.logo_file_uri,
          fileName: values.logo_file_name,
          mimeType: values.logo_file_type,
        });
      }

      await updateCloudCompanyMutation.mutateAsync({
        name: values.company_name,
        display_name: values.company_display_name || null,
        address: values.company_address || null,
        email: values.company_email || null,
        phone: values.company_mobile_number || null,
        logo_display_name: values.logo_display_company_name === '1',
        logo_display_branch: values.logo_display_branch === '1',
      });

      if (designatedBranch?.id) {
        await updateBranchMutation.mutateAsync({
          id: designatedBranch.id,
          display_name: values.branch || null,
        });
        await cloudAuthActions.patchDesignatedBranch({
          display_name: values.branch || null,
        });
      }

      await refreshCloudAuthCompany();

      actions.resetForm();
      navigation.goBack();
    } catch (error) {
      console.debug(error);

      if (error.code === 'ENOENT') {
        setNeedStorageManagementPermissionDialogVisible(() => true);
      } else {
        setFormErrorMessage(
          error?.response?.data?.message || 'Something went wrong.',
        );
      }
    }
  };

  if (status === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const company = data?.data;

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
              company_name: company.name || '',
              company_display_name:
                company.display_name ||
                (company.name ? company.name.trim().substring(0, 20) : ''),
              company_address: company.address || '',
              company_mobile_number: company.phone || '',
              company_email: company.email || '',
              company_logo_path: company.logo_url || '',
              branch: designatedBranch?.display_name ?? designatedBranch?.name ?? '',
              logo_display_company_name: company.logo_display_name ? '1' : '0',
              logo_display_branch: company.logo_display_branch ? '1' : '0',
            }}
            editMode={true}
            onSubmit={handleSubmit}
          />
        </ScrollView>
      </View>
      <View>
        <BannerAdComponent unitId={adUnitIds.companyProfileScreenBanner} />
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
