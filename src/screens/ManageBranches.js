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
  Chip,
  Menu,
  IconButton,
} from 'react-native-paper';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Formik} from 'formik';
import * as Yup from 'yup';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import {
  getBranches,
  createBranch,
  deleteBranch,
} from '../serverDbQueries/v2/branches';
import {assignBranch} from '../serverDbQueries/v2/devices';

const createBranchSchema = Yup.object({
  name: Yup.string().required('Branch name is required'),
  address: Yup.string(),
});

const ManageBranches = () => {
  const {colors} = useTheme();
  const [cloudAuthState, cloudAuthActions] = useCloudAuthContext();
  const queryClient = useQueryClient();

  const activeBranchId = cloudAuthState.designatedBranch?.id ?? null;
  const deviceId = cloudAuthState.deviceId;

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createServerError, setCreateServerError] = useState('');

  const [menuVisibleId, setMenuVisibleId] = useState(null);

  const [switchSuccessName, setSwitchSuccessName] = useState('');
  const [switchSuccessVisible, setSwitchSuccessVisible] = useState(false);
  const [switchErrorVisible, setSwitchErrorVisible] = useState(false);
  const [switchErrorMessage, setSwitchErrorMessage] = useState('');
  const [switchingId, setSwitchingId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
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

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const data = await deleteMutation.mutateAsync(deleteTarget.id);
      if (data?.status === 'success') {
        setDeleteTarget(null);
        setDeleteConfirmText('');
      } else {
        setDeleteErrorMessage(data?.message || 'Failed to delete branch.');
        setDeleteErrorVisible(true);
      }
    } catch (error) {
      setDeleteErrorMessage(
        error?.response?.data?.message ||
          'Could not delete branch. Try again.',
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
              <Chip
                compact
                style={[styles.activeChip, {backgroundColor: colors.primary}]}
                textStyle={{color: colors.surface, fontSize: 11}}>
                Active
              </Chip>
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
              <Divider />
              <Menu.Item
                title="Delete Branch"
                leadingIcon="delete-outline"
                disabled={isActive}
                titleStyle={{color: isActive ? undefined : colors.error}}
                onPress={() => {
                  setMenuVisibleId(null);
                  setDeleteTarget(branch);
                  setDeleteConfirmText('');
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
      <View style={[styles.addButtonRow, {borderBottomColor: colors.disabled}]}>
        <Button
          icon="plus"
          mode="contained"
          onPress={() => {
            setCreateServerError('');
            setCreateModalVisible(true);
          }}
          style={styles.addButton}>
          Add Branch
        </Button>
      </View>

      {renderContent()}

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

      {/* Delete confirmation dialog */}
      <Portal>
        <Dialog
          visible={!!deleteTarget}
          onDismiss={() => {
            setDeleteTarget(null);
            setDeleteConfirmText('');
          }}>
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
            <Button
              onPress={() => {
                setDeleteTarget(null);
                setDeleteConfirmText('');
              }}>
              Cancel
            </Button>
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
  addButtonRow: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addButton: {
    alignSelf: 'flex-start',
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
  activeChip: {
    height: 22,
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
