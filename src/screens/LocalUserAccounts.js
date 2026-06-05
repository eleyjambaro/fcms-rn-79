import React, {useState, useEffect} from 'react';
import {View} from 'react-native';
import {
  Button,
  Modal,
  Title,
  Portal,
  Searchbar,
  useTheme,
} from 'react-native-paper';
import {useQueryClient, useMutation} from '@tanstack/react-query';

import LocalUserAccountList from '../components/accounts/LocalUserAccountList';
import LocalUserAccountForm from '../components/forms/LocalUserAccountForm';
import useSearchbarContext from '../hooks/useSearchbarContext';
import {ScrollView} from 'react-native-gesture-handler';
import {createCloudSubAccount} from '../serverDbQueries/v2/accounts';
import {syncCloudBranchAccountAssignments} from '../serverDbQueries/v2/branchAccountAssignments';
import {syncCloudDeviceAccountAssignments} from '../serverDbQueries/v2/deviceAccountAssignments';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import useCurrentUser from '../hooks/useCurrentUser';
import useCloudAuthContext from '../hooks/useCloudAuthContext';
import PermissionGate from '../components/permissions/PermissionGate';

function LocalUserAccounts(props) {
  const {navigation, viewMode} = props;
  const [
    createLocalUserAccountModalVisible,
    setCreateLocalUserAccountModalVisible,
  ] = useState(false);
  const {colors} = useTheme();
  const [authState] = useCurrentUser();
  const authUser = authState?.authUser;
  const [cloudAuthState] = useCloudAuthContext();
  const currentBranchId = cloudAuthState?.designatedBranch?.id ?? null;
  const currentDeviceId = cloudAuthState?.deviceId ?? null;
  const queryClient = useQueryClient();
  const createLocalUserAccountMutation = useMutation(createCloudSubAccount, {
    onSuccess: () => {
      queryClient.invalidateQueries(['cloudSubAccounts']);
    },
  });
  const {keyword, setKeyword} = useSearchbarContext();
  const [formErrorMessage, setErrorMessage] = useState('');

  const onChangeSearch = keyword => setKeyword(keyword);

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const showCreateLocalUserAccountModal = () =>
    setCreateLocalUserAccountModalVisible(true);
  const hideCreateLocalUserAccountModal = () =>
    setCreateLocalUserAccountModalVisible(false);

  const handleCancel = () => {
    hideCreateLocalUserAccountModal();
  };

  const handleSubmit = async (values, actions) => {
    const {branch_ids = [], device_ids = [], ...accountValues} = values;

    let newAccount;
    try {
      const response = await createLocalUserAccountMutation.mutateAsync(
        accountValues,
      );
      newAccount = response?.data;
    } catch (error) {
      const msg =
        error?.response?.data?.message || 'Failed to create user account.';
      setErrorMessage(() => msg);
      return;
    }

    // Grant the selected branch and device access to the newly created user.
    // The account already exists at this point, so on failure we surface the
    // message and still close — the admin can adjust access from the account
    // options afterwards.
    try {
      if (newAccount?.id) {
        await Promise.all([
          syncCloudBranchAccountAssignments({
            account_id: newAccount.id,
            branch_ids,
          }),
          syncCloudDeviceAccountAssignments({
            account_id: newAccount.id,
            device_ids,
          }),
        ]);
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        'User created, but assigning some branch or device access failed. You can adjust it from the account options.';
      setErrorMessage(() => msg);
    }

    actions.resetForm();
    hideCreateLocalUserAccountModal();
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createLocalUserAccountModalVisible}
          onDismiss={() => setCreateLocalUserAccountModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create User
          </Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            <LocalUserAccountForm
              authUser={authUser}
              currentBranchId={currentBranchId}
              currentDeviceId={currentDeviceId}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </ScrollView>
        </Modal>
      </Portal>
      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => {
          setErrorMessage(() => '');
        }}
      />
      <View style={{flex: 1}}>
        <View style={{flexDirection: 'row', padding: 5}}>
          <Searchbar
            placeholder="Search user"
            onChangeText={onChangeSearch}
            value={keyword}
            style={{flex: 1}}
          />
        </View>

        <View style={{flex: 1}}>
          <LocalUserAccountList
            viewMode={viewMode}
            filter={{
              '%LIKE': {key: 'first_name', value: `'%${keyword}%'`},
            }}
          />
        </View>

        <PermissionGate permission="userManagement.manageMembers">
          <View
            style={{
              backgroundColor: 'white',
              padding: 10,
            }}>
            <Button
              icon="plus"
              mode="contained"
              onPress={showCreateLocalUserAccountModal}>
              Create User
            </Button>
          </View>
        </PermissionGate>
      </View>
    </>
  );
}

export default LocalUserAccounts;
