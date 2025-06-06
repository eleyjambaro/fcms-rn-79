import {StyleSheet, Text, View, TouchableOpacity, FlatList} from 'react-native';
import React, {useState, useEffect} from 'react';
import {
  USBPrinter,
  NetPrinter,
  BLEPrinter,
} from '@tumihub/react-native-thermal-receipt-printer';
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import {useTheme} from 'react-native-paper';

const ScanPrinters = props => {
  const {onPressListItem} = props;
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

  const renderItem = ({item: printer}) => {
    return (
      <TouchableOpacity
        key={printer.inner_mac_address}
        style={{marginTop: 30}}
        onPress={() => onPressListItem && onPressListItem({listItem: printer})}>
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
    </View>
  );
};

export default ScanPrinters;

const styles = StyleSheet.create({});
