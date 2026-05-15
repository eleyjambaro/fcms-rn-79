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

import {getCloudDevices} from '../../serverDbQueries/v2/devices';
import {
  getCloudDeviceAccountAssignments,
  createCloudDeviceAccountAssignment,
  deleteCloudDeviceAccountAssignment,
} from '../../serverDbQueries/v2/deviceAccountAssignments';

const ManageSubAccountDevicesModal = ({visible, onDismiss, account}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const accountId = account?.id;

  const {data: devicesData, status: devicesStatus} = useQuery(
    ['cloudDevices'],
    getCloudDevices,
    {enabled: visible && !!accountId},
  );

  const {data: assignmentsData, status: assignmentsStatus} = useQuery(
    ['cloudDeviceAccountAssignments', {account_id: accountId}],
    () => getCloudDeviceAccountAssignments({account_id: accountId}),
    {enabled: visible && !!accountId},
  );

  const createMutation = useMutation(createCloudDeviceAccountAssignment, {
    onSuccess: () => {
      queryClient.invalidateQueries([
        'cloudDeviceAccountAssignments',
        {account_id: accountId},
      ]);
    },
  });

  const deleteMutation = useMutation(deleteCloudDeviceAccountAssignment, {
    onSuccess: () => {
      queryClient.invalidateQueries([
        'cloudDeviceAccountAssignments',
        {account_id: accountId},
      ]);
    },
  });

  const devices = devicesData?.data ?? [];
  const assignments = assignmentsData?.data ?? [];
  const assignedDeviceIds = new Set(assignments.map(a => a.device_id));

  const handleToggle = async device => {
    const isAssigned = assignedDeviceIds.has(device.id);

    if (isAssigned) {
      const assignment = assignments.find(a => a.device_id === device.id);
      if (assignment) {
        await deleteMutation.mutateAsync(assignment.id);
      }
    } else {
      await createMutation.mutateAsync({
        device_id: device.id,
        account_id: accountId,
      });
    }
  };

  const isLoading =
    devicesStatus === 'loading' || assignmentsStatus === 'loading';

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.container,
          {backgroundColor: colors.surface},
        ]}>
        <Title style={styles.title}>Manage Device Access</Title>
        {account ? (
          <Text style={styles.subtitle}>
            {account.first_name} {account.last_name}
          </Text>
        ) : null}
        <Divider style={styles.divider} />
        {isLoading ? (
          <ActivityIndicator style={styles.loader} />
        ) : devices.length === 0 ? (
          <Text style={styles.empty}>No registered devices found.</Text>
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {devices.map(device => {
              const isAssigned = assignedDeviceIds.has(device.id);
              const isBusy =
                createMutation.isLoading || deleteMutation.isLoading;
              return (
                <View key={device.id} style={styles.row}>
                  <Checkbox.Android
                    status={isAssigned ? 'checked' : 'unchecked'}
                    onPress={() => !isBusy && handleToggle(device)}
                    color={colors.primary}
                  />
                  <Text style={styles.deviceName}>{device.name}</Text>
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
  deviceName: {
    fontSize: 15,
    marginLeft: 8,
  },
  closeButton: {
    marginTop: 16,
  },
});

export default ManageSubAccountDevicesModal;
