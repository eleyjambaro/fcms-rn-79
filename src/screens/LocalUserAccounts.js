import React, {useState, useEffect} from 'react';
import {View} from 'react-native';
import {
  Button,
  Menu,
  Modal,
  Title,
  Portal,
  Searchbar,
  useTheme,
} from 'react-native-paper';
import {useQueryClient, useMutation, useQuery} from '@tanstack/react-query';

import LocalUserAccountList from '../components/accounts/LocalUserAccountList';
import LocalUserAccountForm from '../components/forms/LocalUserAccountForm';
import useSearchbarContext from '../hooks/useSearchbarContext';
import {createCloudSubAccount} from '../serverDbQueries/v2/accounts';
import {getBranches} from '../serverDbQueries/v2/branches';
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

  // Team-member branch filter. Options come from the viewer's accessible branch
  // list (the /branches endpoint already scopes to what they may see). "All
  // members" is offered only to root and executives — an ordinary member never
  // gets a cross-branch view. Default: root → All members; everyone else →
  // current branch.
  const isRoot = !!authUser?.is_root_account;
  const isExecutive = !!authUser?.is_executive_account;
  const {data: branchesData} = useQuery(['teamBranchFilter'], () =>
    getBranches({per_page: 100}),
  );
  const branchOptions = branchesData?.data ?? [];
  const showAllOption = isRoot || isExecutive;
  const ALL_MEMBERS = 'all';
  const defaultFilter = isRoot
    ? ALL_MEMBERS
    : currentBranchId && branchOptions.some(b => b.id === currentBranchId)
    ? currentBranchId
    : showAllOption
    ? ALL_MEMBERS
    : branchOptions[0]?.id ?? ALL_MEMBERS;
  const [branchFilter, setBranchFilter] = useState(null);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const effectiveFilter = branchFilter ?? defaultFilter;
  const effectiveFilterLabel =
    effectiveFilter === ALL_MEMBERS
      ? 'All members'
      : (() => {
          const b = branchOptions.find(o => o.id === effectiveFilter);
          return b ? b.display_name || b.name : 'Select branch';
        })();

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
    // options afterwards. Branch access applies to executives too (root limits
    // which branches a co-owner can reach); only DEVICE assignment is skipped
    // for executives, since they self-bootstrap their own devices.
    try {
      if (newAccount?.id) {
        const ops = [
          syncCloudBranchAccountAssignments({
            account_id: newAccount.id,
            branch_ids,
          }),
        ];
        if (!values.is_executive_account) {
          ops.push(
            syncCloudDeviceAccountAssignments({
              account_id: newAccount.id,
              device_ids,
            }),
          );
        }
        await Promise.all(ops);
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
          contentContainerStyle={{
            backgroundColor: 'white',
            padding: 20,
            maxHeight: '90%',
          }}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create User
          </Title>
          <LocalUserAccountForm
            authUser={authUser}
            currentBranchId={currentBranchId}
            currentDeviceId={currentDeviceId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
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

        {branchOptions.length > 0 && (
          <View style={{flexDirection: 'row', paddingHorizontal: 5, paddingBottom: 5}}>
            <Menu
              visible={filterMenuVisible}
              onDismiss={() => setFilterMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  icon="filter-variant"
                  onPress={() => setFilterMenuVisible(true)}>
                  {effectiveFilterLabel}
                </Button>
              }>
              {showAllOption && (
                <Menu.Item
                  title="All members"
                  onPress={() => {
                    setBranchFilter(ALL_MEMBERS);
                    setFilterMenuVisible(false);
                  }}
                />
              )}
              {branchOptions.map(b => (
                <Menu.Item
                  key={b.id}
                  title={b.display_name || b.name}
                  onPress={() => {
                    setBranchFilter(b.id);
                    setFilterMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
          </View>
        )}

        <View style={{flex: 1}}>
          <LocalUserAccountList
            viewMode={viewMode}
            branchFilter={
              effectiveFilter === ALL_MEMBERS ? null : effectiveFilter
            }
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
