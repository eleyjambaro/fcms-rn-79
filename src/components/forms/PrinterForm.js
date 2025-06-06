import React, {useState} from 'react';
import {View, ScrollView, StyleSheet} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Portal,
  Dialog,
  Paragraph,
  Modal,
  Title,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import {
  USBPrinter,
  NetPrinter,
  BLEPrinter,
} from '@tumihub/react-native-thermal-receipt-printer';

import TextInputLabel from './TextInputLabel';
import FormRequiredFieldHelperText from './FormRequiredFieldsHelperText';
import ScanPrinters from '../printers/ScanPrinters';
import TestModeLimitModal from '../../components/modals/TestModeLimitModal';
import useAppConfigContext from '../../hooks/useAppConfigContext';
import useSearchbarContext from '../../hooks/useSearchbarContext';
import {createPrinter} from '../../localDbQueries/printers';

const PrinterValidationSchema = Yup.object().shape({
  display_name: Yup.string().max(150, 'Too Long!').required('Required'),
  device_name: Yup.string().required('Device is required'),
  inner_mac_address: Yup.string().required(
    'Device inner mac address not found',
  ),
});

const PrinterForm = props => {
  const {
    editMode = false,
    initialValues = {
      display_name: '',
      device_name: '',
      inner_mac_address: '',
    },
    onSubmit,
    onCancel,
    submitButtonTitle = 'Save',
    containerStyle,
  } = props;
  const {colors} = useTheme();
  const [enableBluetoothDialogVisible, setEnableBluetoothDialogVisible] =
    useState(false);
  const [deviceListModalVisible, setDeviceListModalVisible] = useState(false);

  const _connectPrinter = async printer => {
    await BLEPrinter.init();

    //connect printer
    BLEPrinter.connectPrinter(printer.inner_mac_address).then(
      printer => {
        console.info('Connected to printer: ', printer);
      },
      error => console.warn(error),
    );
  };

  const printTextTest = () => {
    try {
      BluetoothStateManager.getState().then(bluetoothState => {
        switch (bluetoothState) {
          case 'Unknown':
            console.debug('UNKNOWN');
            break;
          case 'Resetting':
            console.debug('RESETTING');
            break;
          case 'Unsupported':
            console.debug('UNSUPPORTED');
            break;
          case 'Unauthorized':
            console.debug('UNAUTHORIZED');
            break;
          case 'PoweredOff':
            console.debug('POWER OFF');
            setEnableBluetoothDialogVisible(() => true);
            break;
          case 'PoweredOn':
            console.debug('POWER ON');

            let receiptText = `<C><D>My Store</D></C>\n`;
            receiptText += `<C>123 Main Street</C>\n`;
            receiptText += `<C>City, State ZIP</C>\n`;
            receiptText += `------------------------------\n`;
            receiptText += `Item: Product 1\n`;
            receiptText += `Price: $10.00\n`;
            receiptText += `------------------------------\n`;
            receiptText += `<D>Total: $10.00</D>\n`;
            receiptText += `<C>Thank you for your purchase!</C>\n`;

            BLEPrinter.printText(receiptText);
            break;
          default:
            break;
        }
      });
    } catch (error) {
      console.error(error);
    }
    return;
  };

  const handlePressSearch = async () => {
    try {
      BluetoothStateManager.getState().then(bluetoothState => {
        switch (bluetoothState) {
          case 'Unknown':
            console.debug('UNKNOWN');
            break;
          case 'Resetting':
            console.debug('RESETTING');
            break;
          case 'Unsupported':
            console.debug('UNSUPPORTED');
            break;
          case 'Unauthorized':
            console.debug('UNAUTHORIZED');
            break;
          case 'PoweredOff':
            console.debug('POWER OFF');
            setEnableBluetoothDialogVisible(() => true);
            break;
          case 'PoweredOn':
            console.debug('POWER ON');
            setDeviceListModalVisible(() => true);
            break;
          default:
            break;
        }
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleEnablePress = async () => {
    try {
      await BluetoothStateManager.openSettings();
    } catch (error) {
      console.error(error);
    }

    setEnableBluetoothDialogVisible(() => false);
  };

  return (
    <>
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

      <Formik
        initialValues={{
          display_name: initialValues.display_name || '',
          device_name: initialValues.device_name || '',
          inner_mac_address: initialValues.inner_mac_address || '',
        }}
        validationSchema={PrinterValidationSchema}
        onSubmit={onSubmit}>
        {props => {
          const {
            handleChange,
            handleBlur,
            handleSubmit,
            setValues,
            values,
            errors,
            touched,
            dirty,
            isSubmitting,
            isValid,
          } = props;

          return (
            <>
              <Portal>
                <Modal
                  visible={deviceListModalVisible}
                  onDismiss={() => setDeviceListModalVisible(() => false)}
                  contentContainerStyle={{
                    backgroundColor: 'white',
                    padding: 20,
                  }}>
                  <Title style={{marginBottom: 15, textAlign: 'center'}}>
                    Bluetooth devices list
                  </Title>
                  <ScanPrinters
                    onPressListItem={({listItem}) => {
                      setValues({
                        ...values,
                        ...listItem,
                      });

                      setDeviceListModalVisible(() => false);
                    }}
                  />
                </Modal>
              </Portal>
              <View style={[containerStyle]}>
                <FormRequiredFieldHelperText
                  containerStyle={{marginBottom: 10}}
                />
                <TextInput
                  label={
                    <TextInputLabel
                      label="Display Name (e.g. Counter #1 printer)"
                      required
                      error={
                        errors.display_name && touched.display_name
                          ? true
                          : false
                      }
                    />
                  }
                  onChangeText={handleChange('display_name')}
                  onBlur={handleBlur('display_name')}
                  autoCapitalize="words"
                  value={values.display_name}
                  error={
                    errors.display_name && touched.display_name ? true : false
                  }
                />
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <TextInput
                    style={{flex: 8}}
                    label={
                      <TextInputLabel
                        label="Bluetooth Printer"
                        required
                        disabled
                        error={
                          errors.device_name && touched.device_name
                            ? true
                            : false
                        }
                      />
                    }
                    onChangeText={handleChange('device_name')}
                    onBlur={handleBlur('device_name')}
                    autoCapitalize="words"
                    value={values.device_name}
                    error={
                      errors.device_name && touched.device_name ? true : false
                    }
                    disabled={true}
                  />
                  {/* <MaterialCommunityIcons
                    name="barcode-scan"
                    size={25}
                    color={colors.dark}
                    style={{position: 'absolute', top: 18, right: 15}}
                  /> */}
                  <Button
                    mode="outlined"
                    icon="magnify"
                    style={{marginLeft: 10, flex: 2}}
                    onPress={handlePressSearch}>
                    Search
                  </Button>
                </View>

                <Button
                  mode="outlined"
                  icon="printer-outline"
                  onPress={() => {
                    if (isValid) {
                      _connectPrinter({...values});
                      printTextTest();
                    }
                  }}
                  disabled={(!editMode && !dirty) || !isValid || isSubmitting}
                  style={{marginTop: 20, marginBottom: 20}}>
                  Print Test
                </Button>

                <Button
                  mode="contained"
                  onPress={() => {
                    if (isValid) {
                      _connectPrinter({...values});
                      handleSubmit();
                    }
                  }}
                  disabled={(!editMode && !dirty) || !isValid || isSubmitting}
                  loading={isSubmitting}
                  style={{marginTop: 20}}>
                  {submitButtonTitle}
                </Button>
                <Button onPress={onCancel} style={{marginTop: 10}}>
                  Cancel
                </Button>
              </View>
            </>
          );
        }}
      </Formik>
    </>
  );
};

const styles = StyleSheet.create({});

export default PrinterForm;
