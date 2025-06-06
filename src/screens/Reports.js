import React from 'react';
import {View, ScrollView, StyleSheet, ToastAndroid} from 'react-native';
import {useTheme, Text} from 'react-native-paper';
import MoreSelectionButton from '../components/buttons/MoreSelectionButton';
import routes from '../constants/routes';

const Reports = props => {
  const {navigation} = props;
  const {colors} = useTheme();

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.surface}]}>
      <Text
        style={{
          marginTop: 25,
          marginBottom: 15,
          marginLeft: 15,
          fontSize: 16,
          fontWeight: 'bold',
        }}>
        {'Revenues and Expenses'}
      </Text>
      {/* <MoreSelectionButton
        label="Monthly Revenues"
        containerStyle={styles.moreSelectionButton}
        onPress={() => {
          // ToastAndroid.showWithGravityAndOffset(
          //   'Coming soon',
          //   ToastAndroid.SHORT,
          //   ToastAndroid.BOTTOM,
          //   0,
          //   200,
          // );

          // return;
          navigation.navigate(routes.revenues());
        }}
      /> */}
      <MoreSelectionButton
        label="Revenue and Expense Groups"
        containerStyle={styles.moreSelectionButton}
        onPress={() => {
          // ToastAndroid.showWithGravityAndOffset(
          //   'Coming soon',
          //   ToastAndroid.SHORT,
          //   ToastAndroid.BOTTOM,
          //   0,
          //   200,
          // );

          // return;
          navigation.navigate(routes.foodCostAnalysis());
        }}
      />
      <Text
        style={{
          marginTop: 30,
          marginBottom: 15,
          marginLeft: 15,
          fontSize: 16,
          fontWeight: 'bold',
        }}>
        {'Monthly Reports'}
      </Text>
      <MoreSelectionButton
        label="By Item"
        containerStyle={styles.moreSelectionButton}
        onPress={() => {
          // ToastAndroid.showWithGravityAndOffset(
          //   'Coming soon',
          //   ToastAndroid.SHORT,
          //   ToastAndroid.BOTTOM,
          //   0,
          //   200,
          // );

          // return;
          navigation.navigate(routes.monthlyReportByItem());
        }}
      />
      <MoreSelectionButton
        label="By Category"
        containerStyle={styles.moreSelectionButton}
        onPress={() => {
          // ToastAndroid.showWithGravityAndOffset(
          //   'Coming soon',
          //   ToastAndroid.SHORT,
          //   ToastAndroid.BOTTOM,
          //   0,
          //   200,
          // );

          // return;
          navigation.navigate(routes.monthlyReportByCategory());
        }}
      />
      {/* <Text
        style={{
          marginTop: 30,
          marginBottom: 15,
          marginLeft: 15,
          fontSize: 16,
          fontWeight: 'bold',
        }}>
        {'Date Filtered Reports'}
      </Text>
      <MoreSelectionButton
        label="By Item"
        containerStyle={styles.moreSelectionButton}
        onPress={() => {
          // ToastAndroid.showWithGravityAndOffset(
          //   'Coming soon',
          //   ToastAndroid.SHORT,
          //   ToastAndroid.BOTTOM,
          //   0,
          //   200,
          // );

          // return;
          navigation.navigate(routes.customReportByItem());
        }}
      />
      <MoreSelectionButton
        label="By Category"
        containerStyle={styles.moreSelectionButton}
        onPress={() => {
          // ToastAndroid.showWithGravityAndOffset(
          //   'Coming soon',
          //   ToastAndroid.SHORT,
          //   ToastAndroid.BOTTOM,
          //   0,
          //   200,
          // );

          // return;
          navigation.navigate(routes.customReportByCategory());
        }}
      /> */}

      {/* <MoreSelectionButton
        label="Food Menu Mix"
        containerStyle={styles.moreSelectionButton}
        onPress={() => {
          ToastAndroid.showWithGravityAndOffset(
            'Coming soon',
            ToastAndroid.SHORT,
            ToastAndroid.BOTTOM,
            0,
            200,
          );

          return;
          navigation.navigate(routes.foodMenuMix());
        }}
      /> */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  moreSelectionButton: {
    marginBottom: -1,
  },
});

export default Reports;
