import {StyleSheet, Text, View, TouchableOpacity, FlatList} from 'react-native';
import React, {useState, useEffect} from 'react';
import {
  USBPrinter,
  NetPrinter,
  BLEPrinter,
} from '@tumihub/react-native-thermal-receipt-printer';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import {useTheme} from 'react-native-paper';

const ScanPrinters = () => {
  const [printers, setPrinters] = useState([]);
  const [currentPrinter, setCurrentPrinter] = useState();
  const {colors} = useTheme();

  useEffect(() => {
    BLEPrinter.init().then(() => {
      BLEPrinter.getDeviceList().then(setPrinters);
    });
  }, []);

  const _connectPrinter = printer => {
    //connect printer
    BLEPrinter.connectPrinter(printer.inner_mac_address).then(
      setCurrentPrinter,
      error => console.warn(error),
    );
  };

  const printTextTest = () => {
    if (currentPrinter) {
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
    }
  };

  const printBillTest = () => {
    currentPrinter && BLEPrinter.printBill('<C>sample bill</C>');
  };

  const renderItem = ({item: printer}) => {
    return (
      <TouchableOpacity
        key={printer.inner_mac_address}
        style={{marginTop: 30}}
        onPress={() => _connectPrinter(printer)}>
        <Text>{`device_name: ${printer.device_name}, inner_mac_address: ${printer.inner_mac_address}`}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        style={{backgroundColor: colors.surface}}
        data={printers}
        renderItem={renderItem}
        keyExtractor={item => item.inner_mac_address}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              padding: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text>No data to display</Text>
          </View>
        }
      />
      {/* {printers.map(printer => (
        <TouchableOpacity
          key={printer.inner_mac_address}
          style={{marginTop: 30}}
          onPress={() => _connectPrinter(printer)}>
          <Text>{`device_name: ${printer.device_name}, inner_mac_address: ${printer.inner_mac_address}`}</Text>
        </TouchableOpacity>
      ))} */}

      <TouchableOpacity style={{marginTop: 30}} onPress={printTextTest}>
        <Text>Print Text</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{marginTop: 30}} onPress={printBillTest}>
        <Text>Print Bill Text</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ScanPrinters;

const styles = StyleSheet.create({});
