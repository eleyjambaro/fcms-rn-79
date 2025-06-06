import {
  StyleSheet,
  PermissionsAndroid,
  Platform,
  ToastAndroid,
} from 'react-native';
import {useEffect, useState} from 'react';

const useBluetoothPermission = (
  {enabled, onGranted, onDenied} = {enabled: true},
) => {
  const [isLoading, setIsLoading] = useState(false);

  const checkAndRequestBluetoothPermission = async () => {
    if (Platform.OS === 'ios') {
      return true;
    }

    if (Platform.OS === 'android') {
      const apiLevel = parseInt(Platform.Version.toString(), 10);

      if (
        apiLevel < 31 &&
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      ) {
        setIsLoading(() => true);

        // Check if permission is already given or not
        let isGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        if (!isGranted) {
          const requestResult = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location permission needed',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );

          if (requestResult === PermissionsAndroid.RESULTS.GRANTED) {
            setIsLoading(() => false);

            // Permission granted
            console.debug('Permission granted.');

            ToastAndroid.showWithGravityAndOffset(
              'Permission granted',
              ToastAndroid.SHORT,
              ToastAndroid.BOTTOM,
              0,
              200,
            );

            onGranted && onGranted();
            return;
          } else {
            setIsLoading(() => false);
            // Permission denied
            console.debug('Permission denied');

            ToastAndroid.showWithGravityAndOffset(
              'Permission denied',
              ToastAndroid.SHORT,
              ToastAndroid.BOTTOM,
              0,
              200,
            );

            onDenied && onDenied();
            return;
          }
        } else {
          setIsLoading(() => false);

          // Already have permission
          onGranted && onGranted();
          return;
        }
      }

      // API level 31 and up
      if (
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN &&
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      ) {
        setIsLoading(() => true);

        let scanIsGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        );
        let connectIsGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        );

        if (!scanIsGranted || !connectIsGranted) {
          const requestResults = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          if (
            requestResults['android.permission.BLUETOOTH_CONNECT'] ===
              PermissionsAndroid.RESULTS.GRANTED &&
            requestResults['android.permission.BLUETOOTH_SCAN'] ===
              PermissionsAndroid.RESULTS.GRANTED &&
            requestResults['android.permission.ACCESS_FINE_LOCATION'] ===
              PermissionsAndroid.RESULTS.GRANTED
          ) {
            setIsLoading(() => false);

            // Permission granted
            console.debug('Bluetooth scan and connect permission granted.');

            ToastAndroid.showWithGravityAndOffset(
              'Permission granted',
              ToastAndroid.SHORT,
              ToastAndroid.BOTTOM,
              0,
              200,
            );

            onGranted && onGranted();
          } else {
            setIsLoading(() => false);

            // Permission denied
            console.debug('Bluetooth connection permission denied');

            ToastAndroid.showWithGravityAndOffset(
              'Permission denied',
              ToastAndroid.SHORT,
              ToastAndroid.BOTTOM,
              0,
              200,
            );

            onDenied && onDenied();
          }
        } else {
          setIsLoading(() => false);
          // Already have permission
          onGranted && onGranted();
          return;
        }
      }
    }
  };

  useEffect(() => {
    enabled && checkAndRequestBluetoothPermission(onGranted, onDenied);
  }, []);

  return {
    checkAndRequestBluetoothPermission,
    isLoading,
  };
};

export default useBluetoothPermission;

const styles = StyleSheet.create({});
