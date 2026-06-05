import React, {useEffect, useState} from 'react';
import {StyleSheet} from 'react-native';
import {
  Button,
  Modal,
  Title,
  Portal,
  TextInput,
  HelperText,
  Text,
  useTheme,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {ScrollView} from 'react-native-gesture-handler';

import {createCloudRole} from '../../serverDbQueries/v2/roles';
import RolePermissionEditor from '../roles/RolePermissionEditor';
import {serializeRoleConfig} from '../../permissions/serializeRoleConfig';

const DEFAULT_ROLE_CONFIG = {enable: ['*'], disable: []};

const schema = Yup.object({
  name: Yup.string().required('Role name is required'),
});

/**
 * Create-only role modal, reused inside the Create User flow so an admin can add
 * a new role without leaving the form. Mirrors the create path on the Manage
 * Roles screen (CloudRoles): name field + granular RolePermissionEditor +
 * serializeRoleConfig + createCloudRole.
 *
 * Props:
 *   - visible (bool)
 *   - onDismiss ()
 *   - onCreated(role) : called with the created role object after a successful POST.
 */
const CreateRoleModal = ({visible, onDismiss, onCreated}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState('');
  // Latest set of checked permission keys reported by the editor, and a seed
  // that forces the editor to re-initialize each time the modal is opened.
  const [checkedSet, setCheckedSet] = useState(new Set());
  const [editorSeed, setEditorSeed] = useState(0);

  const createMutation = useMutation(createCloudRole, {
    onSuccess: () => queryClient.invalidateQueries(['cloudRoles']),
  });

  // Re-seed the editor and clear errors each time the modal becomes visible.
  useEffect(() => {
    if (visible) {
      setServerError('');
      setEditorSeed(seed => seed + 1);
    }
  }, [visible]);

  const handleFormSubmit = async (values, actions) => {
    setServerError('');
    const payload = {
      name: values.name,
      role_config_json: JSON.stringify(
        serializeRoleConfig(checkedSet, DEFAULT_ROLE_CONFIG),
      ),
    };
    try {
      const response = await createMutation.mutateAsync(payload);
      actions.resetForm();
      onCreated?.(response?.data);
      onDismiss?.();
    } catch (error) {
      setServerError(
        error?.response?.data?.message || 'Failed to create role.',
      );
    } finally {
      actions.setSubmitting(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, {backgroundColor: colors.surface}]}>
        <Title style={styles.modalTitle}>Create Role</Title>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Formik
            initialValues={{name: ''}}
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
                  key={`new-${editorSeed}`}
                  initialConfig={DEFAULT_ROLE_CONFIG}
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
                  Create Role
                </Button>
                <Button onPress={onDismiss} style={styles.cancelButton}>
                  Cancel
                </Button>
              </>
            )}
          </Formik>
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    padding: 20,
    margin: 20,
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

export default CreateRoleModal;
