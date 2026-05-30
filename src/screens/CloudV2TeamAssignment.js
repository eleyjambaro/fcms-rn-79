import React, {useState} from 'react';
import {View, StyleSheet, FlatList, Pressable} from 'react-native';
import {
  Text,
  Button,
  useTheme,
  ActivityIndicator,
  Checkbox,
  Divider,
  HelperText,
} from 'react-native-paper';
import {useQuery, useMutation} from '@tanstack/react-query';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import {getCloudSubAccounts} from '../serverDbQueries/v2/accounts';
import {batchAssignDeviceAccounts} from '../serverDbQueries/v2/deviceAccountAssignments';
import appDefaults from '../constants/appDefaults';
import CloudAppIcon from '../components/icons/CloudAppIcon';

const CloudV2TeamAssignment = ({route}) => {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const [cloudAuthState, {setDesignatedBranch}] = useCloudAuthContext();
  const {branch} = route.params;

  const [selectedIds, setSelectedIds] = useState([]);
  const [serverError, setServerError] = useState('');

  const accountsQuery = useQuery(['cloudV2SubAccounts'], getCloudSubAccounts);

  const assignMutation = useMutation(batchAssignDeviceAccounts);

  const toggleAccount = id => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const handleAssign = async () => {
    setServerError('');
    try {
      if (selectedIds.length > 0) {
        const data = await assignMutation.mutateAsync({
          device_id: cloudAuthState.deviceId,
          account_ids: selectedIds,
        });
        if (data?.status !== 'success') {
          setServerError(data?.message || 'Failed to assign team members.');
          return;
        }
      }
      await setDesignatedBranch(branch);
    } catch (error) {
      setServerError(
        error?.response?.data?.message ||
          'Could not assign team members. Try again.',
      );
    }
  };

  const handleSkip = async () => {
    await setDesignatedBranch(branch);
  };

  const accounts = accountsQuery.data?.data ?? [];

  const renderItem = ({item}) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <Pressable
        onPress={() => toggleAccount(item.id)}
        style={({pressed}) => [
          styles.accountItem,
          {
            backgroundColor: isSelected
              ? colors.primaryContainer ?? '#d8f9ff'
              : colors.surface,
            borderColor: isSelected
              ? colors.primary
              : colors.outline ?? '#e0e0e0',
            opacity: pressed ? 0.8 : 1,
          },
        ]}>
        <View style={styles.accountItemInner}>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>
              {item.first_name} {item.last_name}
            </Text>
            <Text
              style={[
                styles.accountEmail,
                {color: colors.onSurfaceVariant ?? colors.placeholder},
              ]}>
              {item.email}
            </Text>
            {item.role?.name ? (
              <Text style={[styles.accountRole, {color: colors.primary}]}>
                {item.role.name}
              </Text>
            ) : null}
          </View>
          <Checkbox
            status={isSelected ? 'checked' : 'unchecked'}
            onPress={() => toggleAccount(item.id)}
            color={colors.primary}
          />
        </View>
      </Pressable>
    );
  };

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

      <Text style={styles.title}>Assign Team Members</Text>
      <Text
        style={[
          styles.subtitle,
          {color: colors.onSurfaceVariant ?? colors.placeholder},
        ]}>
        Select which team members can sign in on this device.
      </Text>

      {accountsQuery.isLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loader}
        />
      ) : accountsQuery.isError ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, {color: colors.error}]}>
            Could not load team members. Check your connection.
          </Text>
          <Button onPress={() => accountsQuery.refetch()}>Retry</Button>
        </View>
      ) : accounts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text
            style={[
              styles.emptyText,
              {color: colors.onSurfaceVariant ?? colors.placeholder},
            ]}>
            No team members yet. You can add them later in Account Settings.
          </Text>
          <Button
            mode="contained"
            onPress={handleSkip}
            style={styles.continueButton}
            contentStyle={styles.buttonContent}>
            Continue
          </Button>
        </View>
      ) : (
        <>
          <FlatList
            data={accounts}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            style={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListFooterComponent={<Divider style={styles.divider} />}
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
            disabled={assignMutation.isLoading}
            style={styles.continueButton}
            contentStyle={styles.buttonContent}>
            {selectedIds.length > 0
              ? `Assign ${selectedIds.length} Member${
                  selectedIds.length > 1 ? 's' : ''
                } & Continue`
              : 'Continue Without Assigning'}
          </Button>

          <Button
            mode="text"
            onPress={handleSkip}
            disabled={assignMutation.isLoading}
            style={styles.skipButton}>
            Skip for now
          </Button>
        </>
      )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  list: {
    flex: 1,
  },
  accountItem: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  accountItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountInfo: {
    flex: 1,
    marginRight: 8,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
  },
  accountEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  accountRole: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  separator: {
    height: 8,
  },
  divider: {
    marginVertical: 8,
  },
  serverError: {
    marginBottom: 8,
  },
  continueButton: {
    marginTop: 4,
    borderRadius: 8,
  },
  skipButton: {
    marginTop: 4,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});

export default CloudV2TeamAssignment;
