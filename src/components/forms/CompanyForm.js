import React, {useState} from 'react';
import {
  StyleSheet,
  View,
  Image,
  Platform,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Avatar,
  HelperText,
  Portal,
  Dialog,
  Paragraph,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import DocumentPicker from '@react-native-documents/picker';
// import RNFetchBlob from 'react-native-fetch-blob';
import RNFetchBlob from 'rn-fetch-blob';
import ManageExternalStorage from 'react-native-manage-external-storage';

import AppIcon from '../icons/AppIcon';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import SectionHeading from '../headings/SectionHeading';
import FormRequiredFieldsHelperText from './FormRequiredFieldsHelperText';
import {useNavigation} from '@react-navigation/native';
import TextInputLabel from './TextInputLabel';
import PrivacyPolicyConfirmation from './components/PrivacyPolicyConfirmation';

const CompanyValidationSchema = Yup.object().shape({
  company_name: Yup.string().required('Company name field is required.'),
  company_email: Yup.string()
    .email('Company email must be a valid email.')
    .required('Company email field is required.'),
  company_display_name: Yup.string().max(
    20,
    'Company display name should not be more than 20 characters.',
  ),
  branch: Yup.string().max(
    50,
    'Company branch should not be more than 50 characters.',
  ),
});

const CompanyForm = props => {
  const {
    initialValues = {
      company_name: '',
      company_display_name: '',
      company_address: '',
      company_mobile_number: '',
      company_email: '',
      company_logo_path: '',
      branch: '',
      logo_display_company_name: '',
      logo_display_branch: '',
    },
    onSubmit,
    editMode = false,
    onCancel,
  } = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const [companyDetailsFieldsVisible, setCompanyDetailsFieldsVisible] =
    useState(false);
  const [needPermissionDialogVisible, setNeedPermissionDialogVisible] =
    useState(false);
  const [
    needStorageManagementPermissionDialogVisible,
    setNeedStorageManagementPermissionDialogVisible,
  ] = useState(false);
  const [confirmedPrivacyPolicy, setConfirmedPrivacyPolicy] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const androidVersion = Platform.constants['Release'];
  const sdkVersion = Platform.Version;

  const showFilePicker = async formikProps => {
    const {setFieldTouched, setFieldValue} = formikProps;

    const [res] = await DocumentPicker.pick({
      allowMultiSelection: false,
      type: [DocumentPicker.types.images],
    });

    setSelectedFile(() => res?.[0]);

    const stats = await RNFetchBlob.fs.stat(decodeURI(res?.[0]?.uri));

    setFieldTouched('company_logo_path', true);
    setFieldValue('company_logo_path', stats.path);
    setFieldValue('has_new_selected_logo_file', '1');
  };

  const handlePressEditIconButton = async formikProps => {
    if (!editMode) return;

    try {
      // for android 11 or higher
      if (sdkVersion >= 30) {
        await ManageExternalStorage.checkPermission(
          err => {
            if (err) {
              console.debug(err);
            }
          },
          async isGranted => {
            if (!isGranted) {
              setNeedStorageManagementPermissionDialogVisible(() => true);
            } else {
              // Already have Permission
              try {
                await showFilePicker(formikProps);
              } catch (error) {
                console.debug(error);
                throw error;
              }
            }
          },
        );
      } else {
        // Check if write permission is already given or not
        let isWriteExternalStoragePermitted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );

        if (!isWriteExternalStoragePermitted) {
          // Then prompt user and ask for permission
          const requestResult = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Storage permission needed',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );

          if (requestResult === PermissionsAndroid.RESULTS.GRANTED) {
            // Permission granted
            console.log('Write External Storage Permission granted.');
            await showFilePicker(formikProps);
          } else {
            // Permission denied
            console.log('Write External Storage Permission denied');
            setNeedPermissionDialogVisible(() => true);
          }
        } else {
          // Already have Permission
          await showFilePicker(formikProps);
        }
      }
    } catch (e) {
      // error
      console.debug(e);
    }
  };

  const renderUpdateLogoFieldsError = (touched, errors) => {
    if (errors.company_display_name || errors.branch) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.company_display_name || errors.branch}
        </Text>
      );
    }
  };

  const renderFormError = (touched, errors) => {
    if (
      (errors.company_name && touched.company_name) ||
      (errors.company_email && touched.company_email)
    ) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.company_name || errors.company_email}
        </Text>
      );
    }
  };

  const renderNeedStoragePermissionDialogContentAndActions = () => {
    // for android 11 or higher
    if (sdkVersion >= 30) {
      return (
        <>
          <Dialog.Content>
            <Text style={{marginBottom: 15}}>
              In order to enable data backup and recovery, your permission for
              management of all files is needed.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                openManageExternalStorageSettings();
              }}>
              Enable in Settings
            </Button>
            <Button
              onPress={() => {
                setNeedStorageManagementPermissionDialogVisible(() => false);
              }}>
              Cancel
            </Button>
          </Dialog.Actions>
        </>
      );
    }

    return (
      <>
        <Dialog.Content>
          <Text style={{marginBottom: 15}}>
            In order to enable data backup and recovery, your permission for
            management of all files is needed.
          </Text>
          <Text>
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
            Done
          </Button>
        </Dialog.Actions>
      </>
    );
  };

  const renderCustomAppIconPreview = formikProps => {
    if (!editMode) return null;

    const {
      values,
      errors,
      touched,
      handleChange,
      handleBlur,
      setFieldTouched,
      setFieldValue,
    } = formikProps;

    let logoDisplayCompanyName = parseInt(values.logo_display_company_name);
    let logoDisplayBranch = parseInt(values.logo_display_branch);

    const companyName = logoDisplayCompanyName
      ? values.company_display_name
      : '';
    const branch =
      companyName && logoDisplayBranch && values.branch ? values.branch : '';

    const renderBranch = () => {
      if (logoDisplayCompanyName) {
        return (
          <>
            <ConfirmationCheckbox
              status={logoDisplayBranch}
              text="Display branch"
              containerStyle={{paddingTop: 5, paddingBottom: 5}}
              onPress={() => {
                setFieldTouched('logo_display_branch', true);
                setFieldValue(
                  'logo_display_branch',
                  logoDisplayBranch ? '0' : '1',
                );
              }}
            />
            <HelperText
              visible={true}
              style={{
                color: colors.dark,
                fontStyle: 'italic',
                marginVertical: 5,
              }}>
              {
                <Text style={{fontStyle: 'italic'}}>
                  * Branch will only appear if you set the company display name
                </Text>
              }
            </HelperText>
          </>
        );
      }

      return null;
    };

    return (
      <>
        <Portal>
          <Dialog
            visible={needPermissionDialogVisible}
            onDismiss={() => setNeedPermissionDialogVisible(() => false)}>
            <Dialog.Title>Storage Permission Needed</Dialog.Title>
            <Dialog.Content>
              <Paragraph>{`To enable this feature, you can go to Settings and allow "Files and Media" permission for this app.`}</Paragraph>
            </Dialog.Content>
            <Dialog.Actions style={{justifyContent: 'space-around'}}>
              <Button
                onPress={() => {
                  Linking.openSettings();
                  setNeedPermissionDialogVisible(() => false);
                }}
                color={colors.primary}>
                {'Open settings'}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        <Portal>
          <Dialog
            visible={needStorageManagementPermissionDialogVisible}
            onDismiss={() =>
              setNeedStorageManagementPermissionDialogVisible(() => false)
            }>
            <Dialog.Title>
              Files and Media Management Permission Needed
            </Dialog.Title>
            {renderNeedStoragePermissionDialogContentAndActions()}
          </Dialog>
        </Portal>
        <View style={{marginTop: 30}}>
          <AppIcon
            mainText={companyName}
            subText={branch}
            editMode={editMode}
            onPressEditButton={() => handlePressEditIconButton(formikProps)}
            filePath={values.company_logo_path}
          />
        </View>
        <View style={{marginBottom: 10}}>
          <ConfirmationCheckbox
            status={logoDisplayCompanyName}
            text="Use company display name"
            containerStyle={{paddingTop: 5, paddingBottom: 5}}
            onPress={() => {
              setFieldTouched('logo_display_company_name', true);
              setFieldValue(
                'logo_display_company_name',
                logoDisplayCompanyName ? '0' : '1',
              );
            }}
          />
          {renderBranch()}
        </View>
        <TextInput
          label="Company Display Name (Company Nickname)"
          onChangeText={handleChange('company_display_name')}
          onBlur={handleBlur('company_display_name')}
          value={values.company_display_name}
          autoCapitalize="sentences"
          error={errors.company_display_name ? true : false}
        />
        <TextInput
          label="Branch"
          onChangeText={handleChange('branch')}
          onBlur={handleBlur('branch')}
          value={values.branch}
          autoCapitalize="sentences"
          error={errors.branch ? true : false}
        />
        {renderUpdateLogoFieldsError(touched, errors)}
      </>
    );
  };

  return (
    <Formik
      initialValues={{
        company_name: initialValues.company_name || '',
        company_display_name: initialValues.company_display_name || '',
        company_address: initialValues.company_address || '',
        company_mobile_number: initialValues.company_mobile_number || '',
        company_email: initialValues.company_email || '',
        company_logo_path: initialValues.company_logo_path || '',
        branch: initialValues.branch || '',
        logo_display_company_name:
          initialValues.logo_display_company_name || '0',
        logo_display_branch: initialValues.logo_display_branch || '0',
        has_new_selected_logo_file: '0',
      }}
      validationSchema={CompanyValidationSchema}
      onSubmit={onSubmit}>
      {props => {
        const {
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          errors,
          touched,
          dirty,
          isValid,
          isSubmitting,
        } = props;

        return (
          <>
            {editMode && (
              <SectionHeading
                headingText={'Update Company Logo'}
                containerStyle={{marginTop: 0}}
              />
            )}
            {renderCustomAppIconPreview(props)}
            {editMode && (
              <SectionHeading
                headingText={'Update Company Details'}
                containerStyle={{marginTop: 20}}
                switchVisible={true}
                switchValue={companyDetailsFieldsVisible}
                onSwitchValueChange={() => {
                  setCompanyDetailsFieldsVisible(
                    () => !companyDetailsFieldsVisible,
                  );
                }}
              />
            )}
            {!editMode && (
              <Text
                style={{
                  fontWeight: 'bold',
                  fontSize: 16,
                  marginBottom: 20,
                  textAlign: 'center',
                }}>
                Enter your company details
              </Text>
            )}
            {(!editMode || companyDetailsFieldsVisible) && (
              <>
                <FormRequiredFieldsHelperText
                  containerStyle={{marginVertical: 10}}
                />
                <TextInput
                  label={
                    <TextInputLabel
                      label="Company Name"
                      required
                      error={
                        errors.company_name && touched.company_name
                          ? true
                          : false
                      }
                    />
                  }
                  onChangeText={handleChange('company_name')}
                  onBlur={handleBlur('company_name')}
                  value={values.company_name}
                  autoCapitalize="sentences"
                  error={
                    errors.company_name && touched.company_name ? true : false
                  }
                />
                <TextInput
                  label="Company Address"
                  onChangeText={handleChange('company_address')}
                  onBlur={handleBlur('company_address')}
                  value={values.company_address}
                  autoCapitalize="sentences"
                  error={
                    errors.company_address && touched.company_address
                      ? true
                      : false
                  }
                />
                <TextInput
                  label="Company Mobile Number"
                  onChangeText={handleChange('company_mobile_number')}
                  onBlur={handleBlur('company_mobile_number')}
                  value={values.company_mobile_number}
                  keyboardType="numeric"
                  error={
                    errors.company_mobile_number &&
                    touched.company_mobile_number
                      ? true
                      : false
                  }
                />
                <TextInput
                  label={
                    <TextInputLabel
                      label="Company Email"
                      required
                      error={
                        errors.company_email && touched.company_email
                          ? true
                          : false
                      }
                    />
                  }
                  onChangeText={handleChange('company_email')}
                  onBlur={handleBlur('company_email')}
                  value={values.company_email}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  error={
                    errors.company_email && touched.company_email ? true : false
                  }
                />
                {renderFormError(touched, errors)}
              </>
            )}

            {!editMode && (
              <PrivacyPolicyConfirmation
                containerStyle={{marginTop: 20}}
                status={confirmedPrivacyPolicy}
                onPressCheckbox={currentStatus => {
                  setConfirmedPrivacyPolicy(() => !currentStatus);
                }}
              />
            )}

            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={
                (!editMode && !confirmedPrivacyPolicy) ||
                !dirty ||
                !isValid ||
                isSubmitting
              }
              loading={isSubmitting}
              style={{marginTop: 30}}>
              {editMode ? 'Save Changes' : 'Next'}
            </Button>
            {editMode && (
              <Button
                onPress={() => {
                  navigation.goBack();
                }}
                style={{marginTop: 15, marginBottom: 20}}>
                Cancel
              </Button>
            )}
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({});

export default CompanyForm;
