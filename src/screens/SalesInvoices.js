import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import SalesInvoiceList from '../components/salesInvoices/SalesInvoiceList';

const SalesInvoices = () => {
  return (
    <View style={styles.container}>
      <SalesInvoiceList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
});

export default SalesInvoices;
