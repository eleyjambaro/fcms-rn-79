import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import SalesOrderList from '../components/salesOrders/SalesOrderList';

const SalesOrders = () => {
  return (
    <View style={styles.container}>
      <SalesOrderList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
});

export default SalesOrders;
