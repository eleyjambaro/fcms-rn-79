import React, {useState} from 'react';
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

const defaultRoleConfig = JSON.stringify(
  {enable: ['*'], disable: []},
  null,
  2,
);

const schema = Yup.object({
  name: Yup.string().required('Role name is required'),
  role_config_json: Yup.string()
    .required('Role config is required')
    .test('valid-json', 'Must be valid JSON with "enable" and "disable" arrays', value => {
      try {
        const parsed = JSON.parse(value);
        return (
          Array.isArray(parsed.enable) && Array.isArray(parsed.disable)
        );
      } catch {
        return false;
      }
    }),
});

const CloudRoles = () => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [focusedRole, setFocusedRole] = useState(null);
  const [serverError, setServerError] = useState('');

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
    setFormModalVisible(true);
  };

  const openEditModal = role => {
    setFocusedRole(role);
    setServerError('');
    setFormModalVisible(true);
  };

  const handleFormSubmit = async (values, actions) => {
    setServerError('');
    try {
      if (focusedRole) {
        await updateMutation.mutateAsync({id: focusedRole.id, ...values});
      } else {
        await createMutation.mutateAsync(values);
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
                role_config_json: focusedRole
                  ? JSON.stringify(
                      JSON.parse(focusedRole.role_config_json),
                      null,
                      2,
                    )
                  : defaultRoleConfig,
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

                  <TextInput
                    label="Role Config JSON"
                    value={values.role_config_json}
                    onChangeText={handleChange('role_config_json')}
                    onBlur={handleBlur('role_config_json')}
                    mode="outlined"
                    multiline
                    numberOfLines={8}
                    error={touched.role_config_json && !!errors.role_config_json}
                    style={[styles.input, styles.jsonInput]}
                  />
                  {touched.role_config_json && errors.role_config_json ? (
                    <HelperText type="error">
                      {errors.role_config_json}
                    </HelperText>
                  ) : null}

                  <HelperText style={styles.hint}>
                    {`Example: {"enable":["*"],"disable":["revenues","reports"]}`}
                  </HelperText>
                  <HelperText style={styles.hint}>
                    {`Batch Transfer keys: transfer.create, transfer.review, transfer.transfer_out, transfer.receive`}
                  </HelperText>

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
    margin: 20,
    padding: 20,
    borderRadius: 8,
    maxHeight: '90%',
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    marginBottom: 4,
  },
  jsonInput: {
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: 11,
    marginBottom: 8,
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
