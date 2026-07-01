import React, {useState, useCallback} from 'react';
import {View, StyleSheet, FlatList, Pressable} from 'react-native';
import {
  Text,
  Button,
  useTheme,
  ActivityIndicator,
  Portal,
  Modal,
  TextInput,
  HelperText,
  RadioButton,
  Divider,
} from 'react-native-paper';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Formik} from 'formik';
import * as Yup from 'yup';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import useCurrentUser from '../hooks/useCurrentUser';
import {assignBranch} from '../serverDbQueries/v2/devices';
import {getBranches, createBranch} from '../serverDbQueries/v2/branches';
import appDefaults from '../constants/appDefaults';
import CloudAppIcon from '../components/icons/CloudAppIcon';
import routes from '../constants/routes';

const createBranchSchema = Yup.object({
  name: Yup.string().required('Branch name is required'),
  address: Yup.string(),
});

const CloudV2BranchSetup = ({navigation}) => {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const [cloudAuthState] = useCloudAuthContext();
  const [{authUser}] = useCurrentUser();
  const queryClient = useQueryClient();

  // Creating a branch is reserved for the company owner (root) and executive
  // co-owners; a team member only picks from the branches assigned to them. The
  // cloud API enforces this (BranchController::store → 403); this hides the entry.
  const canCreateBranch = !!(
    authUser?.is_root_account || authUser?.is_executive_account
  );

  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [serverError, setServerError] = useState('');

  const deviceId = cloudAuthState.deviceId;

  const branchesQuery = useQuery(['cloudV2Branches'], getBranches);

  const createBranchMutation = useMutation(createBranch, {
    onSuccess: () => {
      queryClient.invalidateQueries(['cloudV2Branches']);
    },
  });

  const assignMutation = useMutation(({branchId}) =>
    assignBranch({
      device_id: deviceId,
      branch_id: branchId,
      force_reassign: false,
    }),
  );

  const handleAssign = async () => {
    if (!selectedBranchId) return;
    setServerError('');
    try {
      const data = await assignMutation.mutateAsync({
        branchId: selectedBranchId,
      });
      if (data?.status === 'success') {
        const branch = branchesQuery.data?.data?.find(
          b => b.id === selectedBranchId,
        ) ?? {id: selectedBranchId};
        // Navigate to team assignment before advancing to RootStack
        navigation.navigate(routes.cloudV2TeamAssignment(), {branch});
      } else {
        setServerError(data?.message || 'Failed to assign branch.');
      }
    } catch (error) {
      setServerError(
        error?.response?.data?.message || 'Could not assign branch. Try again.',
      );
    }
  };

  const handleCreateBranch = async (values, actions) => {
    try {
      const data = await createBranchMutation.mutateAsync(values);
      if (data?.status === 'success') {
        setCreateModalVisible(false);
        setSelectedBranchId(data.data.id);
      } else {
        actions.setFieldError(
          'name',
          data?.message || 'Failed to create branch.',
        );
      }
    } catch (error) {
      actions.setFieldError(
        'name',
        error?.response?.data?.message || 'Failed to create branch.',
      );
    } finally {
      actions.setSubmitting(false);
    }
  };

  const renderBranchItem = useCallback(
    ({item}) => {
      const isSelected = selectedBranchId === item.id;
      return (
        <Pressable
          onPress={() => setSelectedBranchId(item.id)}
          style={({pressed}) => [
            styles.branchItem,
            {
              backgroundColor: isSelected
                ? colors.primaryContainer ?? colors.highlighted ?? '#d8f9ff'
                : colors.surface,
              borderColor: isSelected
                ? colors.primary
                : colors.outline ?? '#e0e0e0',
              opacity: pressed ? 0.8 : 1,
            },
          ]}>
          <View style={styles.branchItemInner}>
            <View style={styles.branchItemText}>
              <Text style={styles.branchName}>{item.name}</Text>
              {item.address ? (
                <Text style={styles.branchAddress}>{item.address}</Text>
              ) : null}
            </View>
            <RadioButton
              value={item.id}
              status={isSelected ? 'checked' : 'unchecked'}
              onPress={() => setSelectedBranchId(item.id)}
              color={colors.primary}
            />
          </View>
        </Pressable>
      );
    },
    [selectedBranchId, colors],
  );

  const isLoading = branchesQuery.isLoading;

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.surface, paddingTop: insets.top + 24},
      ]}>
      <CloudAppIcon
        mainText={`${appDefaults.appDisplayName}`}
        subText=""
        containerStyle={styles.icon}
      />

      <Text style={styles.title}>Select Branch</Text>
      <Text style={styles.subtitle}>
        Assign this device to a branch so your records are properly organized.
      </Text>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loader}
        />
      ) : branchesQuery.isError ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, {color: colors.error}]}>
            Could not load branches. Check your connection.
          </Text>
          <Button onPress={() => branchesQuery.refetch()}>Retry</Button>
        </View>
      ) : (
        <>
          <FlatList
            data={branchesQuery.data?.data ?? []}
            keyExtractor={item => item.id}
            renderItem={renderBranchItem}
            style={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {canCreateBranch
                  ? 'No branches yet. Create your first one below.'
                  : 'No branches are assigned to you yet. Ask an owner to grant you access.'}
              </Text>
            }
            ListFooterComponent={
              canCreateBranch ? (
                <>
                  <Divider style={styles.divider} />
                  <Pressable
                    onPress={() => setCreateModalVisible(true)}
                    style={({pressed}) => [
                      styles.createBranchRow,
                      {
                        opacity: pressed ? 0.7 : 1,
                        backgroundColor: colors.surface,
                      },
                    ]}>
                    <Text
                      style={[styles.createBranchText, {color: colors.primary}]}>
                      + Create New Branch
                    </Text>
                  </Pressable>
                </>
              ) : null
            }
          />

          {serverError ? (
            <HelperText type="error" style={styles.serverError}>
              {serverError}
            </HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={handleAssign}
            loading={assignMutation.isLoading}
            disabled={!selectedBranchId || assignMutation.isLoading}
            style={styles.continueButton}
            contentStyle={styles.buttonContent}>
            Continue
          </Button>
        </>
      )}

      {/* Create Branch Modal */}
      <Portal>
        <Modal
          visible={createModalVisible}
          onDismiss={() => setCreateModalVisible(false)}
          contentContainerStyle={[
            styles.modal,
            {backgroundColor: colors.surface},
          ]}>
          <Text style={styles.modalTitle}>New Branch</Text>
          <Text style={styles.modalSubtitle}>
            Add a branch to organize your records by location or outlet.
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
              <View style={styles.modalForm}>
                <TextInput
                  label="Branch Name *"
                  value={values.name}
                  onChangeText={handleChange('name')}
                  onBlur={handleBlur('name')}
                  mode="outlined"
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
                  style={styles.modalInput}
                />

                <View style={styles.modalActions}>
                  <Button
                    mode="outlined"
                    onPress={() => setCreateModalVisible(false)}
                    style={styles.modalCancelButton}>
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={styles.modalCreateButton}
                    contentStyle={styles.buttonContent}>
                    Create
                  </Button>
                </View>
              </View>
            )}
          </Formik>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  icon: {
    marginBottom: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.65,
    marginBottom: 20,
    lineHeight: 20,
  },
  loader: {
    marginTop: 40,
  },
  errorContainer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  branchItem: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  branchItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  branchItemText: {
    flex: 1,
    marginRight: 8,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '600',
  },
  branchAddress: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  separator: {
    height: 8,
  },
  divider: {
    marginVertical: 8,
  },
  createBranchRow: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  createBranchText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.5,
    fontSize: 14,
    paddingVertical: 24,
  },
  serverError: {
    marginBottom: 8,
  },
  continueButton: {
    marginTop: 12,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  // Modal
  modal: {
    margin: 24,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    opacity: 0.65,
    marginBottom: 20,
    lineHeight: 18,
  },
  modalForm: {
    gap: 4,
  },
  modalInput: {
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 8,
  },
  modalCreateButton: {
    flex: 2,
    borderRadius: 8,
  },
});

export default CloudV2BranchSetup;
