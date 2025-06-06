import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme, Headline} from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';

const StockUsageHistoryDetails = props => {
  const {containerStyle, stockUsageDetails} = props;
  const {colors} = useTheme();

  if (!stockUsageDetails) return null;

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.surface},
        containerStyle,
      ]}>
      <Headline>{stockUsageDetails.date_confirmed.split(' ')[0]}</Headline>
      {/* <Text>{stockUsageDetails.purchase_number}</Text> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 5,
    padding: 15,
  },
});

export default StockUsageHistoryDetails;
