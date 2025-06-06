import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import StockUsageHistoryList from '../components/purchases/StockUsageHistoryList';

const StockUsageHistory = () => {
  return (
    <View style={styles.container}>
      <StockUsageHistoryList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default StockUsageHistory;
