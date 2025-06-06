import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import PurchaseHistoryList from '../components/purchases/PurchaseHistoryList';

const PurchaseListHistory = () => {
  return (
    <View style={styles.container}>
      <PurchaseHistoryList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
});

export default PurchaseListHistory;
