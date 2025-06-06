import {StyleSheet, View} from 'react-native';
import React, {useState} from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  useTheme,
  Text,
  Button,
  Portal,
  Modal,
  Title,
  Dialog,
  Paragraph,
} from 'react-native-paper';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import RNRestart from 'react-native-restart';

import {
  deleteMyAccount,
  emergencyChangePassword,
  getRootAccountUsername,
  signInAccount,
} from '../localDbQueries/accounts';
import BackupDataBeforeAccountDeletionConfirmation from '../components/forms/components/BackupDataBeforeAccountDeletionConfirmation';
import AccountDeletionConfirmation from '../components/forms/components/AccountDeletionConfirmation';
import ConfirmAccountDeletionUsingPasswordForm from '../components/forms/ConfirmAccountDeletionUsingPasswordForm';
import LicenseForm from '../components/forms/LicenseForm';
import RetypeTextToConfirmForm from '../components/forms/RetypeTextToConfirmForm';

const DeleteMyAccount = () => {
  const {colors} = useTheme();
  const [enableBackupData, setEnableBackupData] = useState(true);
  const [confirmAccountDeletion, setConfirmAccountDeletion] = useState(false);
  const [confirmByPasswordModalVisible, setConfirmByPasswordModalVisible] =
    useState(false);
  const [confirmByLicenseKeyModalVisible, setConfirmByLicenseKeyModalVisible] =
    useState(false);
  const [retypeTextModalVisible, setRetypeTextModalVisible] = useState(false);
  const [
    deleteMyAccountSuccessDialogVisible,
    setDeleteMyAccountSuccessDialogVisible,
  ] = useState(false);
  const queryClient = useQueryClient();
  const deleteMyAccountMutation = useMutation(deleteMyAccount, {
    onSuccess: () => {
      queryClient.clear();
    },
  });
  const [formValues, setFormValues] = useState({password: '', license_key: ''});

  const handlePressDelete = () => {
    // show modal to input root user account password
    setConfirmByPasswordModalVisible(() => true);

    // show modal to input license key
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    setFormValues(() => ({...formValues, ...values}));

    try {
      const deleteMyAccountData = await deleteMyAccountMutation.mutateAsync({
        values: {
          ...formValues,
          ...values,
        },
        enableBackupData,
        onError: ({errorMessage}) => {
          actions.setFieldError('password', errorMessage);
        },
        onErrorLicenseKey: ({errorMessage}) => {
          actions.setFieldError('license_key', errorMessage);
        },
        onErrorRetypeText: ({errorMessage}) => {
          actions.setFieldError('text', errorMessage);
        },
        onSuccess: () => {
          if (confirmByPasswordModalVisible) {
            setConfirmByPasswordModalVisible(() => false);
          }

          if (confirmByLicenseKeyModalVisible) {
            setConfirmByLicenseKeyModalVisible(() => false);
          }

          if (retypeTextModalVisible) {
            setRetypeTextModalVisible(() => false);
          }

          setDeleteMyAccountSuccessDialogVisible(() => true);
        },
        onRequireLicenseKey: () => {
          if (confirmByPasswordModalVisible) {
            setConfirmByPasswordModalVisible(() => false);
          }

          setConfirmByLicenseKeyModalVisible(() => true);
        },
        onRequireRetypeText: () => {
          if (confirmByPasswordModalVisible) {
            setConfirmByPasswordModalVisible(() => false);
          }

          if (confirmByLicenseKeyModalVisible) {
            setConfirmByLicenseKeyModalVisible(() => false);
          }

          setRetypeTextModalVisible(() => true);
        },
        // onEmergencyPasswordRecovery: ({username}) => {
        //   actions.resetForm();
        //   username && actions.setFieldValue('username', username);
        //   actions.setFieldTouched('username', false);
        //   actions.setFieldTouched('password', false);

        //   setRootAccountUsername(() => username);
        //   setEmergencyChangePasswordMode(() => true);
        // },
      });

      if (deleteMyAccountData) {
        signIn(deleteMyAccountData.result);
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

  return (
    <>
      <Portal>
        <Modal
          visible={confirmByPasswordModalVisible}
          onDismiss={() => setConfirmByPasswordModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Confirm account deletion
          </Title>
          <Paragraph style={{marginBottom: 20}}>
            Please re-enter your password (root account password) to confirm
            your identity.
          </Paragraph>
          <ConfirmAccountDeletionUsingPasswordForm
            onSubmit={handleSubmit}
            onCancel={() => setConfirmByPasswordModalVisible(() => false)}
          />
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={confirmByLicenseKeyModalVisible}
          onDismiss={() => setConfirmByLicenseKeyModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            License key is required
          </Title>
          <Paragraph style={{marginBottom: 20}}>
            We've found out that you have an active digital license. Please
            re-enter your license key to confirm account deletion.
          </Paragraph>
          <LicenseForm
            submitButtonTitle="Submit"
            onSubmit={handleSubmit}
            onCancel={() => setConfirmByLicenseKeyModalVisible(() => false)}
          />
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={retypeTextModalVisible}
          onDismiss={() => setRetypeTextModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Proceed with account deletion
          </Title>
          <RetypeTextToConfirmForm
            onSubmit={handleSubmit}
            onCancel={() => setRetypeTextModalVisible(() => false)}
          />
        </Modal>
      </Portal>

      <Portal>
        <Dialog
          visible={deleteMyAccountSuccessDialogVisible}
          onDismiss={() => {
            setDeleteMyAccountSuccessDialogVisible(() => false);
            RNRestart.restart();
          }}>
          <Dialog.Title>Your account has been deleted!</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{marginBottom: 15}}>
              {'All data related to this app has been permanently deleted.'}
            </Paragraph>
            <Paragraph>{'App will restart automatically.'}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setDeleteMyAccountSuccessDialogVisible(() => false);
                RNRestart.restart();
              }}>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <View style={[styles.contentWrapper]}>
          <View style={{flexDirection: 'row'}}>
            <MaterialCommunityIcons
              size={20}
              name="alert"
              color={'orange'}
              style={{marginRight: 8}}
            />
            <Text style={[styles.contentSubheading]}>
              {`Account Deletion Warning`}
            </Text>
          </View>

          <View style={{marginTop: 10, marginBottom: 10}}>
            <Text>
              {'Deleting your account is '}
              <Text style={[styles.em]}>{'permanent'}</Text>
              {' and '}
              <Text style={[styles.em]}>{'cannot be undone'}</Text>
              {'.'}
            </Text>

            <Text>
              {'This action will erase '}
              <Text style={[styles.em]}>{'all data related to this app'}</Text>
              {' that is stored on this device, including:'}
            </Text>
          </View>

          <Text style={[styles.listItem, styles.em]}>
            • Your root and local user accounts (Admin, Encoder, etc.)
          </Text>
          <Text style={[styles.listItem, styles.em]}>
            • Company information
          </Text>
          <Text style={[styles.listItem, styles.em]}>
            • Inventory data (items, categories, recipes, etc.)
          </Text>
          <Text style={[styles.listItem, styles.em]}>
            • Financial records (revenues, expenses, spoilages, etc.)
          </Text>

          <View style={{marginTop: 15, marginBottom: 10}}>
            <Text>
              {
                'Once deleted, your root user account, other local user accounts, company information, and financial records '
              }
              <Text style={[styles.em]}>{'cannot be recovered'}</Text>
              {
                ' — except for inventory data, which can be restored if you have backed it up locally on this device.'
              }
            </Text>

            <BackupDataBeforeAccountDeletionConfirmation
              status={enableBackupData}
              onPressCheckbox={currentStatus => {
                setEnableBackupData(() => !currentStatus);
              }}
              containerStyle={{marginTop: 20}}
            />

            <AccountDeletionConfirmation
              status={confirmAccountDeletion}
              onPressCheckbox={currentStatus => {
                setConfirmAccountDeletion(() => !currentStatus);
              }}
              containerStyle={{marginTop: 20}}
            />

            <View style={{marginTop: 20}}>
              <Button
                icon={'delete-outline'}
                mode="contained"
                disabled={!confirmAccountDeletion}
                onPress={handlePressDelete}
                color={colors.notification}>
                Delete my account
              </Button>
            </View>
          </View>
        </View>
      </View>
    </>
  );
};

export default DeleteMyAccount;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 25,
    padding: 20,
  },
  contentHeading: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentSubheading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 5,
  },
  contentParagraph: {},
  contentWrapper: {
    marginTop: 15,
    paddingHorizontal: 15,
  },
  listItem: {
    marginVertical: 5,
  },
  em: {
    fontWeight: 'bold',
  },
});
