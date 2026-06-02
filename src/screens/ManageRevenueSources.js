import {StyleSheet, View} from 'react-native';
import React from 'react';
import RevenueSourceList from '../components/foodCostAnalysis/RevenueSourceList';

const ManageRevenueSources = () => {
  return (
    <View style={styles.container}>
      <RevenueSourceList />
    </View>
  );
};

export default ManageRevenueSources;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
