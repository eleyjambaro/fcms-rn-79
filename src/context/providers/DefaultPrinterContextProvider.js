import React, {useState, useEffect} from 'react';
import {View, Text, ToastAndroid} from 'react-native';
import {
  Button,
  Modal,
  Title,
  Portal,
  Dialog,
  Paragraph,
  Searchbar,
  useTheme,
  Card,
  ActivityIndicator,
} from 'react-native-paper';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';
import {
  USBPrinter,
  NetPrinter,
  BLEPrinter,
} from '@tumihub/react-native-thermal-receipt-printer';
import {BluetoothStateManager} from 'react-native-bluetooth-state-manager';

import {DefaultPrinterContext} from '../types';
import {getDefaultPrinter} from '../../localDbQueries/printers';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import useAuthContext from '../../hooks/useAuthContext';

const DefaultPrinterContextProvider = props => {
  const {children} = props;
  const [authState] = useAuthContext();
  const getDefaultPrinterResult = useQuery(
    ['defaultPrinter'],
    getDefaultPrinter,
  );
  const {
    status: getDefaultPrinterStatus,
    data: getDefaultPrinterData,
    isRefetching: isRefetchingDefaultPrinter,
    isLoading: isLoadingDefaultPrinter,
  } = getDefaultPrinterResult;
  const [enableBluetoothDialogVisible, setEnableBluetoothDialogVisible] =
    useState(false);
  const [bluetoothState, setBluetoothState] = useState('Unknown');
  const [connectToPrinterDialogVisible, setConnectToPrinterDialogVisible] =
    useState(false);
  const [loadingDialogVisible, setLoadingDialogVisible] = useState(false);
  const [
    connectToPrinterFailedDialogVisible,
    setConnectToPrinterFailedDialogVisible,
  ] = useState(false);
  const [printerState, setPrinterState] = useState('unknown'); // 'unknown' | 'initializing' | 'connecting' | 'connected' | 'disconnected' | 'connection-failed'

  const defaultPrinter = getDefaultPrinterData?.result;
  const PrinterController = getPrinterControllerByInterface(defaultPrinter);

  function getPrinterControllerByInterface(printer) {
    if (!printer) return null;

    let PrinterInterfaceController;

    if (printer.interface_type === 'bluetooth') {
      PrinterInterfaceController = BLEPrinter;
    } else if (printer.interface_type === 'usb') {
      PrinterInterfaceController = USBPrinter;
    } else if (printer.interface_type === 'ethernet') {
      PrinterInterfaceController = NetPrinter;
    }

    return PrinterInterfaceController;
  }

  async function initializePrinter() {
    if (!defaultPrinter || !PrinterController) return;

    // check bluetooth state
    const bluetoothState = await BluetoothStateManager.getState();

    if (bluetoothState === 'PoweredOff') {
      return;
    }

    if (connectToPrinterFailedDialogVisible) {
      setConnectToPrinterFailedDialogVisible(() => false);
    }

    // initialize printer
    try {
      setPrinterState(() => 'initializing');
      await PrinterController.init();
    } catch (error) {
      setPrinterState(() => 'unknown');
      console.error('Bluetooth printer initialization failed!');
    }
  }

  async function connectToPrinter() {
    if (!defaultPrinter || !PrinterController) return;

    // connect to printer
    try {
      setPrinterState(() => 'connecting');
      const printer = await PrinterController.connectPrinter(
        defaultPrinter.inner_mac_address,
      );

      setPrinterState(() => 'connected');
      setConnectToPrinterDialogVisible(() => false);
      console.info('Connected to the default printer: ', printer);

      ToastAndroid.showWithGravityAndOffset(
        'Connected to the default printer!',
        ToastAndroid.SHORT,
        ToastAndroid.BOTTOM,
        0,
        200,
      );
    } catch (error) {
      setPrinterState('connection-failed');
      if (connectToPrinterDialogVisible) {
        setConnectToPrinterDialogVisible(() => false);
      }

      setConnectToPrinterFailedDialogVisible(() => true);
      console.error('Connection to the default printer failed!');
    }
  }

  async function initializeAndConnectToPrinter() {
    if (!defaultPrinter || !PrinterController) return;

    await initializePrinter();
    await connectToPrinter();
  }

  async function printTest() {
    if (!defaultPrinter || !PrinterController) return;

    try {
      switch (bluetoothState) {
        case 'PoweredOff':
          console.debug('Bluetooth is powered off');
          setEnableBluetoothDialogVisible(() => true);
          break;
        case 'PoweredOn':
          console.debug('Bluetooth is powered on');

          const alignLeft = '\x1b\x61\x00'; // ESC a 0: Left
          const alignCenter = '\x1b\x61\x01'; // ESC a 1: Center
          const alignRight = '\x1b\x61\x02'; // ESC a 2: Right

          // receipt header
          let receiptText = `${dashedDivider}\n`;
          receiptText += `${alignCenter}<D>Print Test</D>\n`;
          receiptText += `${dashedDivider}`;

          PrinterController.printText(receiptText);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(error);
    }
    return;
  }

  async function printText(text) {
    if (!defaultPrinter || !PrinterController) return;

    try {
      PrinterController.printText(text);
    } catch (error) {
      console.error(error);
    }
  }

  async function enableBluetoothViaSettings() {
    try {
      await BluetoothStateManager.openSettings();
    } catch (error) {
      console.error(error);
    }

    if (enableBluetoothDialogVisible) {
      setEnableBluetoothDialogVisible(() => false);
    }
  }

  async function enableBluetoothDirectly() {
    try {
      await BluetoothStateManager.enable();
    } catch (error) {
      console.error(error);
    }

    if (enableBluetoothDialogVisible) {
      setEnableBluetoothDialogVisible(() => false);
    }
  }

  useEffect(() => {
    if (!defaultPrinter || !PrinterController) return;

    const remove = BluetoothStateManager.addListener(state => {
      setBluetoothState(() => state);
    });
    return remove;
  }, [defaultPrinter, PrinterController]);

  useEffect(() => {
    if (!authState.authToken || !authState.authUser) return;
    if (!defaultPrinter || !PrinterController) return;

    if (bluetoothState === 'PoweredOn') {
      ToastAndroid.showWithGravityAndOffset(
        'Bluetooth powered on!',
        ToastAndroid.SHORT,
        ToastAndroid.BOTTOM,
        0,
        200,
      );

      // prompt user to connect to the default printer anytime the bluetooth turns on
      if (printerState !== 'connected' && defaultPrinter.auto_connect) {
        setConnectToPrinterDialogVisible(() => true);
      }
    } else if (bluetoothState === 'PoweredOff') {
      if (printerState === 'connected') {
        PrinterController.closeConn().then(() => {
          setPrinterState(() => 'disconnected');

          ToastAndroid.showWithGravityAndOffset(
            'Bluetooth turned off. Default printer has been disconnected as well.',
            ToastAndroid.LONG,
            ToastAndroid.BOTTOM,
            0,
            200,
          );
        });
      }

      setPrinterState(() => 'disconnected');
    }
  }, [defaultPrinter, PrinterController, bluetoothState]);

  useEffect(() => {
    if (!authState.authToken || !authState.authUser) return;
    if (!defaultPrinter || !PrinterController) return;

    let isLoading =
      getDefaultPrinterStatus === 'loading' ||
      printerState === 'initializing' ||
      printerState === 'connecting' ||
      bluetoothState === 'Resetting';

    if (isLoading) {
      // make sure no other modal is visible, only loading modal
      setConnectToPrinterDialogVisible(() => false);
      setConnectToPrinterFailedDialogVisible(() => false);

      setLoadingDialogVisible(() => true);
    } else {
      setLoadingDialogVisible(() => false);
    }
  }, [getDefaultPrinterStatus, printerState, bluetoothState]);

  let isLoading =
    getDefaultPrinterStatus === 'loading' ||
    printerState === 'initializing' ||
    printerState === 'connecting' ||
    bluetoothState === 'Resetting';

  return (
    <>
      <Portal>
        <Dialog
          visible={loadingDialogVisible}
          onDismiss={() => setLoadingDialogVisible(() => false)}>
          <DefaultLoadingScreen />
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={connectToPrinterDialogVisible}
          onDismiss={() => setConnectToPrinterDialogVisible(() => false)}>
          <Dialog.Title>Bluetooth powered on!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {'Do you want to connect to your default printer?'}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={async () => {
                initializeAndConnectToPrinter();
              }}>
              Connect
            </Button>
            <Button
              onPress={async () => {
                setConnectToPrinterDialogVisible(() => false);
              }}>
              Not now
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={connectToPrinterFailedDialogVisible}
          onDismiss={() => setConnectToPrinterFailedDialogVisible(() => false)}>
          <Dialog.Title>Connection to printer failed!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {'Please make sure your printer is turned on.'}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={async () => {
                initializeAndConnectToPrinter();
              }}>
              Retry
            </Button>
            <Button
              onPress={async () => {
                setConnectToPrinterFailedDialogVisible(() => false);
              }}>
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={enableBluetoothDialogVisible}
          onDismiss={async () => {
            setEnableBluetoothDialogVisible(() => false);
          }}>
          <Dialog.Title>Enable Bluetooth?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {'Turn on Bluetooth to search for available Bluetooth printers.'}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setEnableBluetoothDialogVisible(() => false);
              }}>
              Cancel
            </Button>
            <Button
              onPress={async () => {
                handleEnablePress();
              }}>
              Enable
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <DefaultPrinterContext.Provider
        value={{
          isLoading,
          bluetoothState,
          printerState,
          initializeAndConnectToPrinter,
          printTest,
          printText,
          enableBluetoothViaSettings,
          enableBluetoothDirectly,
        }}>
        {children}
      </DefaultPrinterContext.Provider>
    </>
  );
};

export default DefaultPrinterContextProvider;
