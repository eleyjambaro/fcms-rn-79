import React, {useState, useMemo, useEffect} from 'react';
import {View, FlatList, StyleSheet, InteractionManager} from 'react-native';
import {
  Button,
  Card,
  Text,
  Title,
  Modal,
  Portal,
  TextInput,
  HelperText,
  IconButton,
  Dialog,
  Paragraph,
  Checkbox,
  TouchableRipple,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {ScrollView} from 'react-native-gesture-handler';

import {
  getCloudRoles,
  createCloudRole,
  updateCloudRole,
  deleteCloudRole,
} from '../serverDbQueries/v2/roles';
import RolePermissionEditor from '../components/roles/RolePermissionEditor';
import AssignRoleToMembersModal from '../components/modals/AssignRoleToMembersModal';
import {
  serializeRoleConfig,
  loadCheckedSet,
} from '../permissions/serializeRoleConfig';
import useRoleAccess from '../hooks/useRoleAccess';

const DEFAULT_ROLE_CONFIG = {enable: ['*'], disable: []};

const schema = Yup.object({
  name: Yup.string().required('Role name is required'),
});

const CloudRoles = () => {
  const {colors} = useTheme();
  const {can} = useRoleAccess();
  const canManageRoles = can('userManagement.manageRoles');
  const queryClient = useQueryClient();

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [assignMembersModalVisible, setAssignMembersModalVisible] =
    useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [focusedRole, setFocusedRole] = useState(null);
  const [serverError, setServerError] = useState('');
  // Latest set of checked permission keys reported by the editor, and a seed
  // that forces the editor to re-initialize each time the modal is opened.
  const [checkedSet, setCheckedSet] = useState(new Set());
  const [editorSeed, setEditorSeed] = useState(0);
  // The permission editor mounts a large subtree (~26 accordions). Mounting it
  // synchronously with the modal blocks the JS thread for a beat and swallows
  // the first taps on "Create Role". Defer it until the open animation settles
  // so the name field and submit button are interactive immediately.
  const [editorReady, setEditorReady] = useState(false);

  const originalConfig = useMemo(() => {
    if (focusedRole) {
      try {
        return JSON.parse(focusedRole.role_config_json);
      } catch {
        return DEFAULT_ROLE_CONFIG;
      }
    }
    return DEFAULT_ROLE_CONFIG;
  }, [focusedRole]);

  // Seed the parent's checked set immediately (so an early submit serializes the
  // right permissions) and mount the heavy editor only after interactions.
  useEffect(() => {
    if (!formModalVisible) {
      setEditorReady(false);
      return;
    }
    setCheckedSet(loadCheckedSet(originalConfig));
    setEditorReady(false);
    const task = InteractionManager.runAfterInteractions(() =>
      setEditorReady(true),
    );
    return () => task.cancel();
  }, [formModalVisible, originalConfig]);

  const {data, status, refetch, isRefetching} = useQuery(
    ['cloudRoles'],
    getCloudRoles,
  );

  const createMutation = useMutation(createCloudRole, {
    onSuccess: () => queryClient.invalidateQueries(['cloudRoles']),
  });

  const updateMutation = useMutation(updateCloudRole, {
    onSuccess: () => queryClient.invalidateQueries(['cloudRoles']),
  });

  const deleteMutation = useMutation(deleteCloudRole, {
    onSuccess: () => queryClient.invalidateQueries(['cloudRoles']),
  });

  const roles = data?.data ?? [];

  const openCreateModal = () => {
    setFocusedRole(null);
    setServerError('');
    setEditorSeed(seed => seed + 1);
    setFormModalVisible(true);
  };

  const openEditModal = role => {
    setFocusedRole(role);
    setServerError('');
    setEditorSeed(seed => seed + 1);
    setFormModalVisible(true);
  };

  const handleFormSubmit = async (values, actions) => {
    setServerError('');
    const payload = {
      name: values.name,
      role_config_json: JSON.stringify(
        serializeRoleConfig(checkedSet, originalConfig),
      ),
    };
    try {
      if (focusedRole) {
        await updateMutation.mutateAsync({id: focusedRole.id, ...payload});
      } else {
        await createMutation.mutateAsync(payload);
      }
      setFormModalVisible(false);
    } catch (error) {
      setServerError(
        error?.response?.data?.message || 'Failed to save role.',
      );
    } finally {
      actions.setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!focusedRole) return;
    try {
      await deleteMutation.mutateAsync(focusedRole.id);
    } catch (error) {
      setServerError(
        error?.response?.data?.message || 'Failed to delete role.',
      );
    } finally {
      setDeleteDialogVisible(false);
    }
  };

  const renderRole = ({item}) => (
    <Card style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.roleInfo}>
          <Text style={styles.roleName}>{item.name}</Text>
          {item.is_app_default ? (
            <Text style={[styles.badge, {color: colors.primary}]}>Built-in</Text>
          ) : null}
        </View>
        <View style={styles.cardActions}>
          {canManageRoles ? (
            <IconButton
              icon="account-plus-outline"
              size={20}
              onPress={() => {
                setFocusedRole(item);
                setServerError('');
                setAssignMembersModalVisible(true);
              }}
            />
          ) : null}
          {canManageRoles ? (
            <IconButton
              icon="pencil-outline"
              size={20}
              onPress={() => openEditModal(item)}
            />
          ) : null}
          {canManageRoles && !item.is_app_default ? (
            <IconButton
              icon="delete-outline"
              size={20}
              iconColor={colors.error}
              onPress={() => {
                setFocusedRole(item);
                setServerError('');
                setDeleteConfirmed(false);
                setDeleteDialogVisible(true);
              }}
            />
          ) : null}
        </View>
      </Card.Content>
    </Card>
  );

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={roles}
        keyExtractor={item => item.id}
        renderItem={renderRole}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={{opacity: 0.5}}>No roles found</Text>
          </View>
        }
        onRefresh={refetch}
        refreshing={isRefetching}
      />

      {canManageRoles ? (
        <View style={styles.footer}>
          <Button icon="plus" mode="contained" onPress={openCreateModal}>
            Create Role
          </Button>
        </View>
      ) : null}

      {/* Create / Edit modal */}
      <Portal>
        <Modal
          visible={formModalVisible}
          onDismiss={() => setFormModalVisible(false)}
          contentContainerStyle={[
            styles.modal,
            {backgroundColor: colors.surface},
          ]}>
          <Title style={styles.modalTitle}>
            {focusedRole ? 'Edit Role' : 'Create Role'}
          </Title>
          <Formik
            initialValues={{
              name: focusedRole?.name ?? '',
            }}
            validationSchema={schema}
            onSubmit={handleFormSubmit}
            enableReinitialize>
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              errors,
              touched,
              isSubmitting,
            }) => (
              <>
                {/* Scrollable content */}
                <ScrollView
                  style={styles.modalScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled">
                  <TextInput
                    label="Role Name"
                    value={values.name}
                    onChangeText={handleChange('name')}
                    onBlur={handleBlur('name')}
                    mode="outlined"
                    error={touched.name && !!errors.name}
                    style={styles.input}
                  />
                  {touched.name && errors.name ? (
                    <HelperText type="error">{errors.name}</HelperText>
                  ) : null}

                  <Text style={styles.sectionLabel}>Permissions</Text>
                  {editorReady ? (
                    <RolePermissionEditor
                      key={`${focusedRole?.id ?? 'new'}-${editorSeed}`}
                      initialConfig={originalConfig}
                      onChange={setCheckedSet}
                    />
                  ) : (
                    <ActivityIndicator style={styles.editorLoader} />
                  )}

                  {serverError ? (
                    <HelperText type="error">{serverError}</HelperText>
                  ) : null}
                </ScrollView>

                {/* Fixed footer — kept outside the ScrollView so a tap right
                    after scrolling isn't eaten by the scroll gesture. */}
                <View style={styles.modalFooter}>
                  <Button
                    mode="contained"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={styles.saveButton}>
                    {focusedRole ? 'Save Changes' : 'Create Role'}
                  </Button>
                  <Button
                    onPress={() => setFormModalVisible(false)}
                    style={styles.cancelButton}>
                    Cancel
                  </Button>
                </View>
              </>
            )}
          </Formik>
        </Modal>
      </Portal>

      {/* Delete confirmation */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Delete Role?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete "{focusedRole?.name}"? Accounts
              assigned this role will lose their role assignment.
            </Paragraph>
            <Paragraph style={[styles.warning, {color: colors.error}]}>
              Warning: team members without a role can still sign in, but will
              see an empty home screen until a role is reassigned to them.
            </Paragraph>
            <TouchableRipple
              onPress={() => setDeleteConfirmed(confirmed => !confirmed)}>
              <View style={styles.confirmRow}>
                <Checkbox
                  status={deleteConfirmed ? 'checked' : 'unchecked'}
                  color={colors.error}
                />
                <Text style={styles.confirmLabel}>Delete the role anyway?</Text>
              </View>
            </TouchableRipple>
            {serverError ? (
              <HelperText type="error">{serverError}</HelperText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button
              icon="delete-outline"
              onPress={handleDeleteConfirm}
              textColor={colors.error}
              disabled={!deleteConfirmed || deleteMutation.isLoading}
              loading={deleteMutation.isLoading}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Assign role to team members */}
      <AssignRoleToMembersModal
        visible={assignMembersModalVisible}
        onDismiss={() => setAssignMembersModalVisible(false)}
        role={focusedRole}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  list: {
    padding: 12,
    flexGrow: 1,
  },
  card: {
    marginBottom: 10,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    fontSize: 12,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
  },
  footer: {
    padding: 10,
    backgroundColor: 'white',
  },
  modal: {
    padding: 20,
    maxHeight: '90%',
  },
  modalScroll: {
    // Shrink to fit between the title and the fixed footer; only this area
    // scrolls. (RN default flexShrink is 0, so it must be set explicitly.)
    flexShrink: 1,
  },
  modalFooter: {
    paddingTop: 8,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    marginBottom: 4,
  },
  sectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  editorLoader: {
    marginVertical: 24,
  },
  saveButton: {
    marginTop: 12,
    borderRadius: 8,
  },
  cancelButton: {
    marginTop: 8,
  },
  warning: {
    marginTop: 10,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  confirmLabel: {
    flex: 1,
    marginLeft: 4,
    fontWeight: '600',
  },
});

export default CloudRoles;
