import React, {useState, useMemo} from 'react';
import {View, FlatList, StyleSheet} from 'react-native';
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
import {serializeRoleConfig} from '../permissions/serializeRoleConfig';

const DEFAULT_ROLE_CONFIG = {enable: ['*'], disable: []};

const schema = Yup.object({
  name: Yup.string().required('Role name is required'),
});

const CloudRoles = () => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [focusedRole, setFocusedRole] = useState(null);
  const [serverError, setServerError] = useState('');
  // Latest set of checked permission keys reported by the editor, and a seed
  // that forces the editor to re-initialize each time the modal is opened.
  const [checkedSet, setCheckedSet] = useState(new Set());
  const [editorSeed, setEditorSeed] = useState(0);

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
          <IconButton
            icon="pencil-outline"
            size={20}
            onPress={() => openEditModal(item)}
          />
          {!item.is_app_default ? (
            <IconButton
              icon="delete-outline"
              size={20}
              iconColor={colors.error}
              onPress={() => {
                setFocusedRole(item);
                setServerError('');
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

      <View style={styles.footer}>
        <Button mode="contained" onPress={openCreateModal}>
          Create Role
        </Button>
      </View>

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
          <ScrollView showsVerticalScrollIndicator={false}>
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
                  <RolePermissionEditor
                    key={`${focusedRole?.id ?? 'new'}-${editorSeed}`}
                    initialConfig={originalConfig}
                    onChange={setCheckedSet}
                  />

                  {serverError ? (
                    <HelperText type="error">{serverError}</HelperText>
                  ) : null}

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
                </>
              )}
            </Formik>
          </ScrollView>
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
              loading={deleteMutation.isLoading}>
              Delete
            </Button>
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
  saveButton: {
    marginTop: 12,
    borderRadius: 8,
  },
  cancelButton: {
    marginTop: 8,
  },
});

export default CloudRoles;
