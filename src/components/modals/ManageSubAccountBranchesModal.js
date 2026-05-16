import React from 'react';
import {View, ScrollView, StyleSheet} from 'react-native';
import {
  Modal,
  Portal,
  Title,
  Text,
  Button,
  Checkbox,
  Divider,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {getBranches} from '../../serverDbQueries/v2/branches';
import {
  getCloudBranchAccountAssignments,
  createCloudBranchAccountAssignment,
  deleteCloudBranchAccountAssignment,
} from '../../serverDbQueries/v2/branchAccountAssignments';

const ManageSubAccountBranchesModal = ({visible, onDismiss, account}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const accountId = account?.id;

  const {data: branchesData, status: branchesStatus} = useQuery(
    ['cloudBranches'],
    getBranches,
    {enabled: visible && !!accountId},
  );

  const {data: assignmentsData, status: assignmentsStatus} = useQuery(
    ['cloudBranchAccountAssignments', {account_id: accountId}],
    () => getCloudBranchAccountAssignments({account_id: accountId}),
    {enabled: visible && !!accountId},
  );

  const createMutation = useMutation(createCloudBranchAccountAssignment, {
    onSuccess: () => {
      queryClient.invalidateQueries([
        'cloudBranchAccountAssignments',
        {account_id: accountId},
      ]);
    },
  });

  const deleteMutation = useMutation(deleteCloudBranchAccountAssignment, {
    onSuccess: () => {
      queryClient.invalidateQueries([
        'cloudBranchAccountAssignments',
        {account_id: accountId},
      ]);
    },
  });

  const branches = branchesData?.data ?? [];
  const assignments = assignmentsData?.data ?? [];
  const assignedBranchIds = new Set(assignments.map(a => a.branch_id));

  const handleToggle = async branch => {
    const isAssigned = assignedBranchIds.has(branch.id);

    if (isAssigned) {
      const assignment = assignments.find(a => a.branch_id === branch.id);
      if (assignment) {
        await deleteMutation.mutateAsync(assignment.id);
      }
    } else {
      await createMutation.mutateAsync({
        branch_id: branch.id,
        account_id: accountId,
      });
    }
  };

  const isLoading =
    branchesStatus === 'loading' || assignmentsStatus === 'loading';

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.container,
          {backgroundColor: colors.surface},
        ]}>
        <Title style={styles.title}>Manage Branch Access</Title>
        {account ? (
          <Text style={styles.subtitle}>
            {account.first_name} {account.last_name}
          </Text>
        ) : null}
        <Divider style={styles.divider} />
        {isLoading ? (
          <ActivityIndicator style={styles.loader} />
        ) : branches.length === 0 ? (
          <Text style={styles.empty}>No branches found.</Text>
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {branches.map(branch => {
              const isAssigned = assignedBranchIds.has(branch.id);
              const isBusy =
                createMutation.isLoading || deleteMutation.isLoading;
              return (
                <View key={branch.id} style={styles.row}>
                  <Checkbox.Android
                    status={isAssigned ? 'checked' : 'unchecked'}
                    onPress={() => !isBusy && handleToggle(branch)}
                    color={colors.primary}
                  />
                  <Text style={styles.branchName}>{branch.name}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}
        <Button mode="outlined" onPress={onDismiss} style={styles.closeButton}>
          Close
        </Button>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 20,
    padding: 20,
    borderRadius: 8,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 8,
  },
  divider: {
    marginVertical: 10,
  },
  loader: {
    marginVertical: 20,
  },
  empty: {
    textAlign: 'center',
    opacity: 0.5,
    marginVertical: 16,
  },
  list: {
    maxHeight: 300,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  branchName: {
    fontSize: 15,
    marginLeft: 8,
  },
  closeButton: {
    marginTop: 16,
  },
});

export default ManageSubAccountBranchesModal;
