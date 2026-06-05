import React, {useEffect, useState} from 'react';
import {StyleSheet, View, InteractionManager} from 'react-native';
import {
  Button,
  Modal,
  Title,
  Portal,
  TextInput,
  HelperText,
  Text,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {ScrollView} from 'react-native-gesture-handler';

import {createCloudRole} from '../../serverDbQueries/v2/roles';
import RolePermissionEditor from '../roles/RolePermissionEditor';
import {
  serializeRoleConfig,
  loadCheckedSet,
} from '../../permissions/serializeRoleConfig';

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
  // Latest set of checked permission keys reported by the editor.
  const [checkedSet, setCheckedSet] = useState(new Set());
  // The editor mounts a large subtree; mounting it synchronously with the modal
  // blocks the JS thread and swallows the first taps on "Create Role". Defer it
  // until interactions settle so the name field and button respond immediately.
  const [editorReady, setEditorReady] = useState(false);

  const createMutation = useMutation(createCloudRole, {
    onSuccess: () => queryClient.invalidateQueries(['cloudRoles']),
  });

  // Clear errors, seed the checked set immediately (so an early submit
  // serializes the right permissions), and mount the heavy editor only after
  // the open animation/interactions complete.
  useEffect(() => {
    if (!visible) {
      setEditorReady(false);
      return;
    }
    setServerError('');
    setCheckedSet(loadCheckedSet(DEFAULT_ROLE_CONFIG));
    setEditorReady(false);
    const task = InteractionManager.runAfterInteractions(() =>
      setEditorReady(true),
    );
    return () => task.cancel();
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
                    initialConfig={DEFAULT_ROLE_CONFIG}
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
                  Create Role
                </Button>
                <Button onPress={onDismiss} style={styles.cancelButton}>
                  Cancel
                </Button>
              </View>
            </>
          )}
        </Formik>
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
});

export default CreateRoleModal;
