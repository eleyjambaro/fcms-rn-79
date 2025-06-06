import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  ToastAndroid,
} from 'react-native';
import React, {useState, useEffect} from 'react';
import {
  USBPrinter,
  NetPrinter,
  BLEPrinter,
} from '@tumihub/react-native-thermal-receipt-printer';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import {useTheme} from 'react-native-paper';
import {useQueryClient, useMutation} from '@tanstack/react-query';

import ScanPrinters from '../components/printers/ScanPrinters';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import useBluetoothPermission from '../hooks/useBluetoothPermission';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import {createPrinter} from '../localDbQueries/printers';
import PrinterForm from '../components/forms/PrinterForm';
import BluetoothPermissionNeeded from './BluetoothPermissionNeeded';
import routes from '../constants/routes';

const CreatePrinter = props => {
  const {navigation} = props;
  const {colors} = useTheme();
  const [
    needBluetoothPermissionScreenVisible,
    setNeedBluetoothPermissionScreenVisible,
  ] = useState(false);

  const {isLoading} = useBluetoothPermission({
    enabled: true,
    onGranted: () => {
      setNeedBluetoothPermissionScreenVisible(() => false);
    },
    onDenied: () => {
      setNeedBluetoothPermissionScreenVisible(() => true);
    },
  });

  const queryClient = useQueryClient();
  const createPrinterMutation = useMutation(createPrinter, {
    onSuccess: () => {
      queryClient.invalidateQueries('printers');
    },
  });
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);

    try {
      await createPrinterMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      navigation.goBack();
    }
  };

  if (isLoading) {
    return (
      <DefaultLoadingScreen
        containerStyle={{flex: 1, backgroundColor: colors.surface}}
      />
    );
  }

  if (needBluetoothPermissionScreenVisible) {
    return (
      <BluetoothPermissionNeeded
        containerStyle={{backgroundColor: colors.surface}}
        onDismiss={() => setNeedBluetoothPermissionScreenVisible(() => false)}
      />
    );
  }

  return (
    <>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <PrinterForm
        containerStyle={{flex: 1, backgroundColor: colors.surface, padding: 10}}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </>
  );
};

export default CreatePrinter;

const styles = StyleSheet.create({});
