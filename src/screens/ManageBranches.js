import React, {useState} from 'react';
import {View, FlatList, StyleSheet, Pressable} from 'react-native';
import {
  Text,
  Button,
  useTheme,
  ActivityIndicator,
  Portal,
  Dialog,
  Modal,
  TextInput,
  HelperText,
  Divider,
  Menu,
  IconButton,
} from 'react-native-paper';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Formik} from 'formik';
import * as Yup from 'yup';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import useCurrentUser from '../hooks/useCurrentUser';
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from '../serverDbQueries/v2/branches';
import {assignBranch} from '../serverDbQueries/v2/devices';
import ConfirmAccountDeletionUsingPasswordForm from '../components/forms/ConfirmAccountDeletionUsingPasswordForm';
import ConfirmBranchDeletionUsingOtpForm from '../components/forms/ConfirmBranchDeletionUsingOtpForm';

const LICENSED_BADGE_COLOR = '#2e7d32';

const createBranchSchema = Yup.object({
  name: Yup.string().required('Branch name is required'),
  address: Yup.string(),
});

const editBranchSchema = Yup.object({
  name: Yup.string().required('Branch name is required'),
  address: Yup.string(),
});

const ManageBranches = () => {
  const {colors} = useTheme();
  const [cloudAuthState, cloudAuthActions] = useCloudAuthContext();
  const [{authUser}] = useCurrentUser();
  const queryClient = useQueryClient();

  const activeBranchId = cloudAuthState.designatedBranch?.id ?? null;
  const deviceId = cloudAuthState.deviceId;

  // Creating a branch is reserved for the company owner (root) and executive
  // co-owners. A team member with 'settings.edit' may still edit/delete existing
  // branches, but not add new ones. The cloud API enforces this
  // (BranchController::store → 403); this just hides the affordance.
  const canCreateBranch = !!(
    authUser?.is_root_account || authUser?.is_executive_account
  );

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createServerError, setCreateServerError] = useState('');

  const [editTarget, setEditTarget] = useState(null);
  const [editServerError, setEditServerError] = useState('');

  const [menuVisibleId, setMenuVisibleId] = useState(null);

  const [switchSuccessName, setSwitchSuccessName] = useState('');
  const [switchSuccessVisible, setSwitchSuccessVisible] = useState(false);
  const [switchErrorVisible, setSwitchErrorVisible] = useState(false);
  const [switchErrorMessage, setSwitchErrorMessage] = useState('');
  const [switchingId, setSwitchingId] = useState(null);

  // Branch deletion is a four-step confirmation that mirrors company-account
  // deletion: password → OTP (emailed) → retype-to-confirm phrase → delete.
  // deleteTarget holds the branch for the whole flow; the three step flags drive
  // which modal is showing.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmByPasswordVisible, setConfirmByPasswordVisible] =
    useState(false);
  const [confirmByOtpVisible, setConfirmByOtpVisible] = useState(false);
  const [retypeVisible, setRetypeVisible] = useState(false);
  const [verifiedPassword, setVerifiedPassword] = useState('');
  const [verifiedOtp, setVerifiedOtp] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteErrorVisible, setDeleteErrorVisible] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');

  const branchesQuery = useQuery(['cloudV2Branches'], getBranches);
  const branches = branchesQuery.data?.data ?? [];

  const createMutation = useMutation(createBranch, {
    onSuccess: () => {
      queryClient.invalidateQueries(['cloudV2Branches']);
    },
  });

  const updateMutation = useMutation(updateBranch, {
    onSuccess: () => {
      queryClient.invalidateQueries(['cloudV2Branches']);
    },
  });

  const deleteMutation = useMutation(deleteBranch, {
    onSuccess: () => {
      queryClient.invalidateQueries(['cloudV2Branches']);
    },
  });

  const handleCreateBranch = async (values, actions) => {
    setCreateServerError('');
    try {
      const data = await createMutation.mutateAsync(values);
      if (data?.status === 'success') {
        actions.resetForm();
        setCreateModalVisible(false);
      } else {
        setCreateServerError(data?.message || 'Failed to create branch.');
      }
    } catch (error) {
      setCreateServerError(
        error?.response?.data?.message || 'Could not create branch. Try again.',
      );
    }
  };

  const handleEditBranch = async (values, actions) => {
    if (!editTarget) return;
    setEditServerError('');
    const trimmed = {
      name: values.name.trim(),
      address: values.address?.trim() ?? '',
    };
    try {
      const data = await updateMutation.mutateAsync({
        id: editTarget.id,
        ...trimmed,
      });
      if (data?.status === 'success') {
        // Keep the active branch's stored name/address in sync so it stays
        // accurate everywhere it's displayed, without triggering a full
        // branch-switch (setDesignatedBranch).
        if (editTarget.id === activeBranchId) {
          await cloudAuthActions.patchDesignatedBranch(trimmed);
        }
        actions.resetForm();
        setEditTarget(null);
      } else {
        setEditServerError(data?.message || 'Failed to update branch.');
      }
    } catch (error) {
      setEditServerError(
        error?.response?.data?.message || 'Could not update branch. Try again.',
      );
    }
  };

  const handleSwitchBranch = async branch => {
    setMenuVisibleId(null);
    setSwitchingId(branch.id);
    try {
      const data = await assignBranch({
        device_id: deviceId,
        branch_id: branch.id,
        force_reassign: true,
      });
      if (data?.status === 'success') {
        await cloudAuthActions.setDesignatedBranch(branch);
        setSwitchSuccessName(branch.name);
        setSwitchSuccessVisible(true);
      } else {
        setSwitchErrorMessage(data?.message || 'Failed to switch branch.');
        setSwitchErrorVisible(true);
      }
    } catch (error) {
      setSwitchErrorMessage(
        error?.response?.data?.message || 'Could not switch branch. Try again.',
      );
      setSwitchErrorVisible(true);
    } finally {
      setSwitchingId(null);
    }
  };

  const resetDeleteFlow = () => {
    setConfirmByPasswordVisible(false);
    setConfirmByOtpVisible(false);
    setRetypeVisible(false);
    setDeleteTarget(null);
    setVerifiedPassword('');
    setVerifiedOtp(null);
    setDeleteConfirmText('');
  };

  // Step 1 → 2: password verified locally; the OTP step re-verifies it
  // server-side and emails a code.
  const handleDeletePasswordSubmit = (values, _actions) => {
    setVerifiedPassword(values.password);
    setConfirmByPasswordVisible(false);
    setConfirmByOtpVisible(true);
  };

  // Step 2 → 3: code entered; carry it to the retype-to-confirm friction step.
  const handleDeleteOtpSubmit = ({otp, request_id}) => {
    setVerifiedOtp({otp, request_id});
    setConfirmByOtpVisible(false);
    setRetypeVisible(true);
  };

  // The OTP step verifies the password server-side before emailing a code; a
  // wrong password bounces back here to re-enter it.
  const handleDeleteOtpPasswordRejected = () => {
    setConfirmByOtpVisible(false);
    setVerifiedPassword('');
    setConfirmByPasswordVisible(true);
  };

  // Step 4: actually delete, with the verified password + OTP.
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const data = await deleteMutation.mutateAsync({
        id: deleteTarget.id,
        password: verifiedPassword,
        otp: verifiedOtp?.otp,
        request_id: verifiedOtp?.request_id,
      });
      if (data?.status === 'success') {
        resetDeleteFlow();
      } else {
        setDeleteErrorMessage(data?.message || 'Failed to delete branch.');
        setDeleteErrorVisible(true);
      }
    } catch (error) {
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.message || '';

      // The branch endpoint returns 422 for both a wrong password and an
      // invalid/expired OTP — distinguish by message so the user is bounced to
      // the right step instead of having to restart.
      if (status === 422) {
        if (/password/i.test(serverMessage)) {
          setRetypeVisible(false);
          setVerifiedPassword('');
          setConfirmByPasswordVisible(true);
          return;
        }
        // Invalid/expired code → back to the OTP step (it requests a fresh
        // code on mount).
        setRetypeVisible(false);
        setVerifiedOtp(null);
        setConfirmByOtpVisible(true);
        return;
      }

      setDeleteErrorMessage(
        serverMessage || 'Could not delete branch. Try again.',
      );
      setDeleteErrorVisible(true);
    }
  };

  const expectedDeleteText = deleteTarget
    ? `delete branch: ${deleteTarget.name}`
    : '';
  const deleteConfirmMatches =
    deleteConfirmText.trim() === expectedDeleteText;

  const renderBranchItem = ({item: branch}) => {
    const isActive = branch.id === activeBranchId;
    const isSwitching = switchingId === branch.id;
    const isMenuOpen = menuVisibleId === branch.id;

    return (
      <View style={styles.branchRow}>
        <View style={styles.branchInfo}>
          <View style={styles.branchNameRow}>
            <Text style={[styles.branchName, {color: colors.text}]}>
              {branch.name}
            </Text>
            {isActive && (
              <View style={[styles.activeBadge, {backgroundColor: colors.primary}]}>
                <Text style={[styles.activeBadgeText, {color: colors.surface}]}>
                  Active
                </Text>
              </View>
            )}
            {branch.is_licensed && (
              <View style={[styles.licensedBadge, {backgroundColor: LICENSED_BADGE_COLOR}]}>
                <Text style={[styles.activeBadgeText, {color: colors.surface}]}>
                  Licensed
                </Text>
              </View>
            )}
          </View>
          {branch.address ? (
            <Text style={[styles.branchAddress, {color: colors.placeholder}]}>
              {branch.address}
            </Text>
          ) : null}
        </View>
        <View style={styles.branchActions}>
          {isSwitching ? (
            <ActivityIndicator size={20} style={styles.switchingSpinner} />
          ) : (
            <Menu
              visible={isMenuOpen}
              onDismiss={() => setMenuVisibleId(null)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={22}
                  onPress={() => setMenuVisibleId(branch.id)}
                />
              }>
              <Menu.Item
                title="Switch to this branch"
                leadingIcon="swap-horizontal"
                disabled={isActive}
                onPress={() => handleSwitchBranch(branch)}
              />
              <Menu.Item
                title="Edit Branch"
                leadingIcon="pencil-outline"
                onPress={() => {
                  setMenuVisibleId(null);
                  setEditServerError('');
                  setEditTarget(branch);
                }}
              />
              <Divider />
              <Menu.Item
                title="Delete Branch"
                leadingIcon="delete-outline"
                disabled={isActive}
                titleStyle={{color: isActive ? undefined : colors.error}}
                onPress={() => {
                  setMenuVisibleId(null);
                  resetDeleteFlow();
                  setDeleteTarget(branch);
                  setConfirmByPasswordVisible(true);
                }}
              />
            </Menu>
          )}
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (branchesQuery.status === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      );
    }

    if (branchesQuery.status === 'error') {
      return (
        <View style={styles.centered}>
          <Text style={{color: colors.error}}>Failed to load branches.</Text>
          <Button
            onPress={() => branchesQuery.refetch()}
            style={{marginTop: 12}}>
            Retry
          </Button>
        </View>
      );
    }

    if (branches.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={{color: colors.placeholder}}>No branches found.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={branches}
        keyExtractor={item => item.id}
        renderItem={renderBranchItem}
        ItemSeparatorComponent={() => <Divider />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.content}>{renderContent()}</View>

      {canCreateBranch ? (
        <View
          style={[
            styles.addButtonRow,
            {borderTopColor: colors.disabled, backgroundColor: colors.surface},
          ]}>
          <Button
            icon="plus"
            mode="contained"
            onPress={() => {
              setCreateServerError('');
              setCreateModalVisible(true);
            }}>
            Add Branch
          </Button>
        </View>
      ) : null}

      {/* Add Branch Modal */}
      <Portal>
        <Modal
          visible={createModalVisible}
          onDismiss={() => setCreateModalVisible(false)}
          contentContainerStyle={[
            styles.modal,
            {backgroundColor: colors.surface},
          ]}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>
            Add New Branch
          </Text>
          <Formik
            initialValues={{name: '', address: ''}}
            validationSchema={createBranchSchema}
            onSubmit={handleCreateBranch}>
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              errors,
              touched,
              isSubmitting,
            }) => (
              <View>
                <TextInput
                  label="Branch Name *"
                  value={values.name}
                  onChangeText={handleChange('name')}
                  onBlur={handleBlur('name')}
                  mode="outlined"
                  style={styles.input}
                  error={touched.name && !!errors.name}
                />
                {touched.name && errors.name ? (
                  <HelperText type="error">{errors.name}</HelperText>
                ) : null}
                <TextInput
                  label="Address (optional)"
                  value={values.address}
                  onChangeText={handleChange('address')}
                  onBlur={handleBlur('address')}
                  mode="outlined"
                  style={styles.input}
                  multiline
                />
                {createServerError ? (
                  <HelperText type="error" style={styles.serverError}>
                    {createServerError}
                  </HelperText>
                ) : null}
                <View style={styles.modalActions}>
                  <Button
                    onPress={() => setCreateModalVisible(false)}
                    disabled={isSubmitting}
                    style={styles.modalButton}>
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={styles.modalButton}>
                    Create
                  </Button>
                </View>
              </View>
            )}
          </Formik>
        </Modal>
      </Portal>

      {/* Edit Branch Modal */}
      <Portal>
        <Modal
          visible={!!editTarget}
          onDismiss={() => setEditTarget(null)}
          contentContainerStyle={[
            styles.modal,
            {backgroundColor: colors.surface},
          ]}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>
            Edit Branch
          </Text>
          <Formik
            enableReinitialize
            initialValues={{
              name: editTarget?.name ?? '',
              address: editTarget?.address ?? '',
            }}
            validationSchema={editBranchSchema}
            onSubmit={handleEditBranch}>
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              errors,
              touched,
              isSubmitting,
            }) => (
              <View>
                <TextInput
                  label="Branch Name *"
                  value={values.name}
                  onChangeText={handleChange('name')}
                  onBlur={handleBlur('name')}
                  mode="outlined"
                  style={styles.input}
                  error={touched.name && !!errors.name}
                />
                {touched.name && errors.name ? (
                  <HelperText type="error">{errors.name}</HelperText>
                ) : null}
                <TextInput
                  label="Address (optional)"
                  value={values.address}
                  onChangeText={handleChange('address')}
                  onBlur={handleBlur('address')}
                  mode="outlined"
                  style={styles.input}
                  multiline
                />
                {editServerError ? (
                  <HelperText type="error" style={styles.serverError}>
                    {editServerError}
                  </HelperText>
                ) : null}
                <View style={styles.modalActions}>
                  <Button
                    onPress={() => setEditTarget(null)}
                    disabled={isSubmitting}
                    style={styles.modalButton}>
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={styles.modalButton}>
                    Save
                  </Button>
                </View>
              </View>
            )}
          </Formik>
        </Modal>
      </Portal>

      {/* Switch success dialog */}
      <Portal>
        <Dialog
          visible={switchSuccessVisible}
          onDismiss={() => setSwitchSuccessVisible(false)}>
          <Dialog.Title>Branch Switched</Dialog.Title>
          <Dialog.Content>
            <Text>{`You are now operating on "${switchSuccessName}".`}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSwitchSuccessVisible(false)}>Okay</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Switch error dialog */}
      <Portal>
        <Dialog
          visible={switchErrorVisible}
          onDismiss={() => setSwitchErrorVisible(false)}>
          <Dialog.Title>Switch Failed</Dialog.Title>
          <Dialog.Content>
            <Text>{switchErrorMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSwitchErrorVisible(false)}>Okay</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete step 1: confirm password */}
      <Portal>
        <Modal
          visible={confirmByPasswordVisible}
          onDismiss={() => setConfirmByPasswordVisible(false)}
          contentContainerStyle={[styles.modal, {backgroundColor: colors.surface}]}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>
            Confirm branch deletion
          </Text>
          <Text style={{marginBottom: 16, color: colors.text}}>
            {`Deleting "${deleteTarget?.name}" can't be undone. Re-enter your account password to confirm your identity.`}
          </Text>
          <ConfirmAccountDeletionUsingPasswordForm
            onSubmit={handleDeletePasswordSubmit}
            onCancel={resetDeleteFlow}
          />
        </Modal>
      </Portal>

      {/* Delete step 2: verify with emailed OTP */}
      <Portal>
        <Modal
          visible={confirmByOtpVisible}
          onDismiss={() => setConfirmByOtpVisible(false)}
          contentContainerStyle={[styles.modal, {backgroundColor: colors.surface}]}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>
            Verify it&apos;s you
          </Text>
          {confirmByOtpVisible ? (
            <ConfirmBranchDeletionUsingOtpForm
              email={authUser?.email}
              branchId={deleteTarget?.id}
              branchName={deleteTarget?.name}
              password={verifiedPassword}
              onSubmit={handleDeleteOtpSubmit}
              onPasswordRejected={handleDeleteOtpPasswordRejected}
              onCancel={resetDeleteFlow}
            />
          ) : null}
        </Modal>
      </Portal>

      {/* Delete step 3: retype-to-confirm friction */}
      <Portal>
        <Dialog visible={retypeVisible} onDismiss={resetDeleteFlow}>
          <Dialog.Title>Delete Branch</Dialog.Title>
          <Dialog.Content>
            <Text style={{marginBottom: 12}}>
              {`To confirm deletion of "${deleteTarget?.name}", type the following exactly:`}
            </Text>
            <Text
              style={[
                styles.deletePromptCode,
                {
                  backgroundColor: colors.disabled,
                  color: colors.text,
                },
              ]}>
              {expectedDeleteText}
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              mode="outlined"
              style={styles.deleteInput}
              placeholder={expectedDeleteText}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={resetDeleteFlow}>Cancel</Button>
            <Button
              textColor={colors.error}
              disabled={!deleteConfirmMatches || deleteMutation.isLoading}
              loading={deleteMutation.isLoading}
              onPress={handleDeleteConfirm}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete error dialog */}
      <Portal>
        <Dialog
          visible={deleteErrorVisible}
          onDismiss={() => setDeleteErrorVisible(false)}>
          <Dialog.Title>Delete Failed</Dialog.Title>
          <Dialog.Content>
            <Text>{deleteErrorMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteErrorVisible(false)}>Okay</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  addButtonRow: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  list: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  branchInfo: {
    flex: 1,
    marginRight: 8,
  },
  branchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '500',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  licensedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  branchAddress: {
    fontSize: 13,
    marginTop: 2,
  },
  branchActions: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchingSpinner: {
    margin: 10,
  },
  modal: {
    margin: 24,
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    marginBottom: 4,
  },
  serverError: {
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  modalButton: {
    minWidth: 90,
  },
  deletePromptCode: {
    fontFamily: 'monospace',
    fontSize: 13,
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  deleteInput: {
    fontSize: 13,
  },
});

export default ManageBranches;
