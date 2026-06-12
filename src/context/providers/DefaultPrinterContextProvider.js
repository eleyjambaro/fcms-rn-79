import React, {useState, useEffect, useRef} from 'react';
import {View, Text, ToastAndroid, AppState} from 'react-native';
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
  Checkbox,
} from 'react-native-paper';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';
import {
  USBPrinter,
  NetPrinter,
  BLEPrinter,
} from '@tumihub/react-native-thermal-receipt-printer';
import {BluetoothStateManager} from 'react-native-bluetooth-state-manager';

import {DefaultPrinterContext} from '../types';
import {
  getDefaultPrinter,
  setPrinterAutoConnect,
} from '../../localDbQueries/printers';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import useCurrentUser from '../../hooks/useCurrentUser';
import useCloudAuthContext from '../../hooks/useCloudAuthContext';

const DefaultPrinterContextProvider = props => {
  const {children} = props;
  const [authState] = useCurrentUser();

  // The default printer lives in the company+branch-scoped DB (it is read via
  // getDefaultPrinter → getDBConnection). That DB only becomes active AFTER
  // CloudAuthContextProvider.restore() awaits setActiveCompanyDb and dispatches
  // these ids; until then getDBConnection() returns the unauthenticated FCMS.db
  // fallback. Because this provider is mounted unconditionally (above the auth
  // gate in index.js), an un-gated query would run on cold start against that
  // fallback DB, cache a null default (staleTime 5m, refetchOnWindowFocus off),
  // and never re-read — so the default printer appeared lost on every app
  // restart until manually re-set. Gate the query on the active company+branch
  // and key it by them so it (a) waits for the real DB and (b) refetches when
  // the branch changes (the default printer is per-branch data).
  const [cloudAuthState] = useCloudAuthContext();
  const activeCompanyId = cloudAuthState?.authUser?.company?.id ?? null;
  const activeBranchId = cloudAuthState?.designatedBranch?.id ?? null;
  const getDefaultPrinterResult = useQuery(
    ['defaultPrinter', {companyId: activeCompanyId, branchId: activeBranchId}],
    getDefaultPrinter,
    {enabled: Boolean(activeCompanyId && activeBranchId)},
  );
  const {
    data: getDefaultPrinterData,
    isRefetching: isRefetchingDefaultPrinter,
    // Use isInitialLoading, NOT `isLoading`/`status === 'loading'`: in React
    // Query v4 a DISABLED query still reports status 'loading' (isLoading true),
    // which would otherwise keep the loading dialog stuck while this query is
    // gated off (signed in but no branch selected yet). isInitialLoading is
    // (isLoading && isFetching), so it is false whenever the query is disabled.
    isInitialLoading: isInitialLoadingDefaultPrinter,
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
  // Local mirror of the default printer's auto_connect, used by the checkbox in
  // the "Connect to default printer?" dialog so it toggles instantly.
  const [autoReconnectChecked, setAutoReconnectChecked] = useState(false);

  // Mirror printerState in a ref so the AppState listener (registered once) can
  // read the current value without re-subscribing on every state change.
  const printerStateRef = useRef(printerState);
  const appStateRef = useRef(AppState.currentState);
  // True while a *passive* reconnect (app foreground / Bluetooth on) is in
  // flight, so the blocking loading modal is suppressed for it. Explicit user
  // actions leave this false and keep the modal. A ref (not state) is fine: the
  // loading-modal effect runs on every printerState change, which is set right
  // after this ref, so the effect reads the current value.
  const silentConnectRef = useRef(false);

  const queryClient = useQueryClient();
  const setPrinterAutoConnectMutation = useMutation(setPrinterAutoConnect, {
    onSuccess: () => {
      queryClient.invalidateQueries(['defaultPrinter']);
    },
  });

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

  // Returns true when the printer is connected (so callers can connect-then-
  // print in a single action), false otherwise.
  //
  // `showFailureDialog` lets silent/auto attempts (app foreground, Bluetooth
  // powered on) fail quietly instead of popping the "Connection failed" dialog
  // on every return to the app when the printer happens to be off. Explicit
  // user actions (tapping Connect, printing) keep the default (true).
  async function connectToPrinter({showFailureDialog = true} = {}) {
    if (!defaultPrinter || !PrinterController) return false;

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

      return true;
    } catch (error) {
      setPrinterState('connection-failed');
      if (connectToPrinterDialogVisible) {
        setConnectToPrinterDialogVisible(() => false);
      }

      if (showFailureDialog) {
        setConnectToPrinterFailedDialogVisible(() => true);
      }
      console.error('Connection to the default printer failed!');

      return false;
    }
  }

  // Returns true when the printer ends up connected, false otherwise.
  async function initializeAndConnectToPrinter(options = {}) {
    if (!defaultPrinter || !PrinterController) return false;

    // Every connect path funnels through here, so set the silent flag once: the
    // four explicit callers omit `silent` (-> false, modal shows); only the
    // passive reconnect path passes `silent: true` to skip the blocking modal.
    silentConnectRef.current = !!options.silent;

    await initializePrinter();
    return await connectToPrinter(options);
  }

  // Decide what to do when the default printer is found disconnected on a
  // passive trigger (Bluetooth turned on, app brought to foreground):
  //   - Auto-reconnect ON  -> reconnect silently (no dialog; failures are quiet).
  //   - Auto-reconnect OFF -> ask first via the "Connect to default printer?"
  //     dialog, which also offers a checkbox to turn auto-reconnect back on.
  // Callers are responsible for any Bluetooth-state gating before calling this.
  function reconnectOrPromptForDefaultPrinter() {
    if (!defaultPrinter || !PrinterController) return;
    if (printerStateRef.current === 'connected') return;
    // A reconnect is already in flight (rapid foreground/background toggling can
    // fire several of these); don't stack another on top.
    if (
      printerStateRef.current === 'initializing' ||
      printerStateRef.current === 'connecting'
    )
      return;

    if (defaultPrinter.auto_connect) {
      initializeAndConnectToPrinter({showFailureDialog: false, silent: true});
    } else {
      // Seed the dialog's checkbox from the stored value as we open it.
      setAutoReconnectChecked(() => !!defaultPrinter.auto_connect);
      setConnectToPrinterDialogVisible(() => true);
    }
  }

  async function printTest() {
    if (!defaultPrinter || !PrinterController) return;

    try {
      // Live state, not the cached `bluetoothState` (which may be stale/Unknown).
      const liveBluetoothState = await BluetoothStateManager.getState();

      switch (liveBluetoothState) {
        case 'PoweredOff':
          console.debug('Bluetooth is powered off');
          setEnableBluetoothDialogVisible(() => true);
          break;
        case 'PoweredOn':
          console.debug('Bluetooth is powered on');

          const alignLeft = '\x1b\x61\x00'; // ESC a 0: Left
          const alignCenter = '\x1b\x61\x01'; // ESC a 1: Center
          const alignRight = '\x1b\x61\x02'; // ESC a 2: Right
          const dashedDivider = '-'.repeat(32);

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

  // Self-sufficient print: ensures Bluetooth is on and the printer is connected,
  // then prints — so a single call from any screen "just works".
  async function printText(text) {
    if (!defaultPrinter || !PrinterController) return false;

    try {
      const isBluetooth = defaultPrinter.interface_type === 'bluetooth';

      if (isBluetooth) {
        // Read the LIVE Bluetooth state rather than the cached `bluetoothState`,
        // which can still be 'Unknown' if its state listener hasn't emitted yet.
        // That stale value silently blocked Sales Register / Sales Invoice
        // printing even though Bluetooth was on and the printer was reachable
        // (the create-printer screen worked precisely because it reads the live
        // state each time).
        const liveBluetoothState = await BluetoothStateManager.getState();

        if (liveBluetoothState !== 'PoweredOn') {
          setEnableBluetoothDialogVisible(() => true);
          return false;
        }
      }

      // Connect first when not already connected, then print in one action.
      if (printerState !== 'connected') {
        const connected = await initializeAndConnectToPrinter();
        if (!connected) return false;
      }

      PrinterController.printText(text);
      return true;
    } catch (error) {
      console.error(error);
      return false;
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
    printerStateRef.current = printerState;
  }, [printerState]);

  // Toggle + persist the default printer's auto-reconnect preference from the
  // connect dialog. Optimistically flips the local checkbox so it feels instant.
  async function handleToggleAutoReconnect() {
    if (!defaultPrinter) return;

    const nextValue = !autoReconnectChecked;
    setAutoReconnectChecked(() => nextValue);

    try {
      await setPrinterAutoConnectMutation.mutateAsync({
        id: defaultPrinter.id,
        autoConnect: nextValue,
      });
    } catch (error) {
      // Revert on failure so the checkbox reflects what's actually stored.
      setAutoReconnectChecked(() => !nextValue);
      console.debug(error);
    }
  }

  useEffect(() => {
    if (!defaultPrinter || !PrinterController) return;

    const remove = BluetoothStateManager.addListener(state => {
      setBluetoothState(() => state);
    });
    return remove;
  }, [defaultPrinter, PrinterController]);

  // Reconnect the default printer on app foreground.
  //
  // Backgrounding the app drops the BLE socket to the printer while Bluetooth
  // itself stays powered on, so the PoweredOff -> PoweredOn listener above never
  // fires on return and the now-stale 'connected' printerState suppresses any
  // reconnect. (Previously a reconnect only happened as a side effect of a
  // mutation triggering a print.) Handle the foreground/background transition
  // explicitly: drop the dead connection on background, and on return either
  // reconnect silently (auto-reconnect on) or prompt (auto-reconnect off).
  useEffect(() => {
    if (!defaultPrinter || !PrinterController) return;

    const subscription = AppState.addEventListener('change', async nextAppState => {
      const goingBackground =
        appStateRef.current === 'active' &&
        nextAppState.match(/inactive|background/);
      const comingForeground =
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active';

      appStateRef.current = nextAppState;

      if (goingBackground) {
        // Tear down the (now-dead) connection so the next foreground check
        // reflects reality instead of a stale 'connected' state.
        if (printerStateRef.current === 'connected') {
          try {
            await PrinterController.closeConn();
          } catch (error) {
            console.warn(
              'Failed to close printer connection on app background',
              error,
            );
          }
          setPrinterState(() => 'disconnected');
        }
        return;
      }

      if (comingForeground) {
        if (printerStateRef.current === 'connected') return;

        // Only Bluetooth printers need Bluetooth powered on; for those, do
        // nothing when Bluetooth is off (the PoweredOn listener handles it once
        // the user turns it back on).
        if (defaultPrinter.interface_type === 'bluetooth') {
          const liveBluetoothState = await BluetoothStateManager.getState();
          if (liveBluetoothState !== 'PoweredOn') return;
        }

        // Auto-reconnect on -> connect silently; off -> prompt with the dialog.
        reconnectOrPromptForDefaultPrinter();
      }
    });

    return () => subscription.remove();
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

      // Reconnect to the default printer whenever Bluetooth turns on: silently
      // when auto-reconnect is on, otherwise prompt.
      if (printerState !== 'connected') {
        reconnectOrPromptForDefaultPrinter();
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

    // Suppress the blocking modal for passive/silent reconnects so switching
    // back into the app stays instant; explicit user actions still show it.
    let isLoadingModal =
      (isInitialLoadingDefaultPrinter ||
        printerState === 'initializing' ||
        printerState === 'connecting' ||
        bluetoothState === 'Resetting') &&
      !silentConnectRef.current;

    if (isLoadingModal) {
      // make sure no other modal is visible, only loading modal
      setConnectToPrinterDialogVisible(() => false);
      setConnectToPrinterFailedDialogVisible(() => false);

      setLoadingDialogVisible(() => true);
    } else {
      setLoadingDialogVisible(() => false);
    }
  }, [isInitialLoadingDefaultPrinter, printerState, bluetoothState]);

  let isLoading =
    isInitialLoadingDefaultPrinter ||
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
          <Dialog.Title>Connect to default printer?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {'Do you want to connect to your default printer?'}
            </Paragraph>
            <Checkbox.Item
              label="Auto-reconnect to this printer"
              status={autoReconnectChecked ? 'checked' : 'unchecked'}
              position="leading"
              onPress={handleToggleAutoReconnect}
              style={{paddingHorizontal: 0, marginTop: 8}}
              labelStyle={{textAlign: 'left'}}
            />
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
                enableBluetoothDirectly();
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
