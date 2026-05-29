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
import {useMutation, useQueryClient} from '@tanstack/react-query';
import RNRestart from 'react-native-restart';
import SecureStorage from 'react-native-fast-secure-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

import {deleteMyCloudAccount} from '../serverDbQueries/v2/auth';
import {rnStorageKeys} from '../constants/rnSecureStorageKeys';
import {appDefaults} from '../constants/appDefaults';
import AccountDeletionConfirmation from '../components/forms/components/AccountDeletionConfirmation';
import ConfirmAccountDeletionUsingPasswordForm from '../components/forms/ConfirmAccountDeletionUsingPasswordForm';
import RetypeTextToConfirmForm from '../components/forms/RetypeTextToConfirmForm';
import useCurrentUser from '../hooks/useCurrentUser';

const DeleteMyAccount = () => {
  const {colors} = useTheme();
  const [{authUser}] = useCurrentUser();
  const queryClient = useQueryClient();

  const [confirmAccountDeletion, setConfirmAccountDeletion] = useState(false);
  const [confirmByPasswordModalVisible, setConfirmByPasswordModalVisible] =
    useState(false);
  const [retypeTextModalVisible, setRetypeTextModalVisible] = useState(false);
  const [
    deleteMyAccountSuccessDialogVisible,
    setDeleteMyAccountSuccessDialogVisible,
  ] = useState(false);
  const [verifiedPassword, setVerifiedPassword] = useState('');

  const wipeLocalState = async () => {
    // SQLite files live in <docs-parent>/databases. We can't enumerate company
    // IDs the user has signed into historically, so we wipe every file in that
    // dir whose name starts with the FCMS DB prefix (FCMS, FCMS_<id>,
    // FCMS_<id>_<branch>, plus the legacy FCMSLocalAccount).
    try {
      const parts = RNFS.DocumentDirectoryPath.split('/');
      parts.pop();
      parts.push('databases');
      const databasesDir = parts.join('/');
      const entries = await RNFS.readDir(databasesDir);
      await Promise.all(
        entries
          .filter(
            e =>
              e.name.startsWith(appDefaults.dbName) ||
              e.name.startsWith(appDefaults.localAccountDbName),
          )
          .map(e => RNFS.unlink(e.path).catch(() => {})),
      );
    } catch (error) {
      console.debug('[DeleteMyAccount] DB files cleanup error:', error);
    }

    try {
      for (const key of Object.values(rnStorageKeys)) {
        if (await SecureStorage.hasItem(key)) {
          await SecureStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.debug('[DeleteMyAccount] SecureStorage cleanup error:', error);
    }

    try {
      const keys = await AsyncStorage.getAllKeys();
      if (keys?.length) {
        await AsyncStorage.multiRemove(keys);
      }
    } catch (error) {
      console.debug('[DeleteMyAccount] AsyncStorage cleanup error:', error);
    }

    queryClient.clear();
  };

  const deleteMyAccountMutation = useMutation(deleteMyCloudAccount);

  const handlePressDelete = () => {
    setConfirmByPasswordModalVisible(() => true);
  };

  const handlePasswordSubmit = async (values, _actions) => {
    setVerifiedPassword(() => values.password);
    setConfirmByPasswordModalVisible(() => false);
    setRetypeTextModalVisible(() => true);
  };

  const handleRetypeSubmit = async (_values, actions) => {
    try {
      await deleteMyAccountMutation.mutateAsync({password: verifiedPassword});
      await wipeLocalState();
      setRetypeTextModalVisible(() => false);
      setDeleteMyAccountSuccessDialogVisible(() => true);
    } catch (error) {
      console.debug('[DeleteMyAccount] delete error:', error);

      const status = error?.response?.status;
      const serverMessage =
        error?.response?.data?.message ||
        'Failed to delete your account. Please try again.';

      // 401 → wrong password. Bounce back to the password modal so the user
      // can re-enter without losing the retype-phrase friction step.
      if (status === 401) {
        setRetypeTextModalVisible(() => false);
        setVerifiedPassword(() => '');
        setConfirmByPasswordModalVisible(() => true);
        return;
      }

      // Any other failure: keep the retype modal open with the server message
      // surfaced under the field.
      actions?.setFieldError && actions.setFieldError('text', serverMessage);
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
            Please re-enter your account password to confirm your identity.
          </Paragraph>
          <ConfirmAccountDeletionUsingPasswordForm
            onSubmit={handlePasswordSubmit}
            onCancel={() => setConfirmByPasswordModalVisible(() => false)}
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
            onSubmit={handleRetypeSubmit}
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
              {`Your company and all related data have been permanently deleted from ${appDefaults.appDisplayName} and from this device.`}
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
              {'Account Deletion Warning'}
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

            <Text style={{marginTop: 10}}>
              {'This action will permanently erase '}
              <Text style={[styles.em]}>
                {'your company and all related data'}
              </Text>
              {' from '}
              <Text style={[styles.em]}>{appDefaults.appDisplayName}</Text>
              {' and from this device, including:'}
            </Text>
          </View>

          <Text style={[styles.listItem, styles.em]}>
            • Company profile, branches, and registered devices
          </Text>
          <Text style={[styles.listItem, styles.em]}>
            • All team member accounts and role assignments
          </Text>
          <Text style={[styles.listItem, styles.em]}>
            • Inventory data (items, categories, recipes, etc.)
          </Text>
          <Text style={[styles.listItem, styles.em]}>
            • Sales, purchase, transfer, and stock usage records
          </Text>
          <Text style={[styles.listItem, styles.em]}>
            • Financial records (revenues, expenses, spoilages, etc.)
          </Text>

          <View style={{marginTop: 15, marginBottom: 10}}>
            <Text>
              {'Once deleted, your account and the data above '}
              <Text style={[styles.em]}>{'cannot be recovered'}</Text>
              {
                '. Any other devices currently signed in to this company will lose access on their next sync.'
              }
            </Text>

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
                disabled={
                  !confirmAccountDeletion || !authUser?.is_root_account
                }
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
