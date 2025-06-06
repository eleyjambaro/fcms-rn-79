import {StyleSheet, Text, View} from 'react-native';
import {Button} from 'react-native-paper';
import React from 'react';
import RevenueGroupList from '../components/foodCostAnalysis/RevenueGroupList';

const ManageRevenueGroups = () => {
  return (
    <View style={styles.container}>
      <RevenueGroupList viewMode="manage-list" />
    </View>
  );
};

export default ManageRevenueGroups;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
