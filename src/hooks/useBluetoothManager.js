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

import ScanPrinters from '../components/printers/ScanPrinters';

const useBluetoothManager = (
  {enabled, onGranted, onDenied} = {enabled: true},
) => {
  const getState = async () => {};

  useEffect(() => {
    enabled && getState(onGranted, onDenied);
  }, []);

  return {
    getState,
  };
};

export default useBluetoothManager;

const styles = StyleSheet.create({});
