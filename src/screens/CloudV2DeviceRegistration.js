import React, {useEffect, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, Button, useTheme, ActivityIndicator} from 'react-native-paper';
import {useMutation} from '@tanstack/react-query';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import {registerDevice, lookupBranch} from '../serverDbQueries/v2/devices';
import deviceInfoLib from '../lib/deviceInfo';
import appDefaults from '../constants/appDefaults';
import CloudAppIcon from '../components/icons/CloudAppIcon';

const CloudV2DeviceRegistration = () => {
  const {colors} = useTheme();
  const [cloudAuthState, {setDeviceCredentials, setDesignatedBranch}] = useCloudAuthContext();
  const [error, setError] = useState('');

  const mutation = useMutation(registerDevice);

  const register = async () => {
    setError('');
    try {
      const physical_device_id = await deviceInfoLib.getPhysicalDeviceId();
      const device_name = deviceInfoLib.getDeviceName();
      const device_fingerprint = deviceInfoLib.getDeviceFingerprint();

      const data = await mutation.mutateAsync({
        device_name,
        physical_device_id,
        device_fingerprint,
      });

      if (data?.status === 'success') {
        const deviceId = data.data.device_id;
        const deviceToken = data.data.device_token;
        const companyId = cloudAuthState.authUser?.company?.id ?? null;
        await setDeviceCredentials({deviceId, deviceToken, companyId});

        // If this device already has a branch assigned on the server (returning
        // user who signed out), save it now so we skip the branch setup screen.
        try {
          const branchData = await lookupBranch(deviceId);
          if (branchData?.data?.branch) {
            await setDesignatedBranch(branchData.data.branch);
          }
        } catch {
          // Not fatal — branch setup screen will handle assignment for new devices.
        }
        // Context update triggers CloudAuthStackV2 to advance
      } else {
        setError(data?.message || 'Device registration failed.');
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Could not register device. Check your network and try again.',
      );
    }
  };

  useEffect(() => {
    register();
  }, []);

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      <CloudAppIcon
        mainText={`${appDefaults.appDisplayName} Cloud`}
        subText=""
        containerStyle={{marginBottom: 0}}
      />

      <Text style={styles.title}>Setting Up Device</Text>

      {mutation.isLoading ? (
        <>
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          <Text style={styles.loadingText}>Registering this device…</Text>
        </>
      ) : error ? (
        <>
          <Text style={[styles.errorText, {color: colors.error}]}>{error}</Text>
          <Button
            mode="contained"
            onPress={register}
            style={styles.retryButton}
            contentStyle={styles.buttonContent}>
            Try Again
          </Button>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  loader: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  retryButton: {
    borderRadius: 8,
    minWidth: 160,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});

export default CloudV2DeviceRegistration;
