import {StyleSheet, Text, View} from 'react-native';
import {Button} from 'react-native-paper';
import React from 'react';
import ExpenseGroupList from '../components/foodCostAnalysis/ExpenseGroupList';

const ManageExpenseGroups = () => {
  return (
    <View style={styles.container}>
      <ExpenseGroupList viewMode="manage-list" />
    </View>
  );
};

export default ManageExpenseGroups;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
