import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme, Headline} from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';
import moment from 'moment';

const PurchaseHistoryDetails = props => {
  const {containerStyle, purchaseDetails} = props;
  const {colors} = useTheme();

  if (!purchaseDetails) return null;

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.surface},
        containerStyle,
      ]}>
      <Headline>
        {moment(purchaseDetails.date_confirmed.split(' ').join('T')).format(
          'MMMM DD, YYYY, hh:mma',
        )}
      </Headline>

      {/* <Text>{purchaseDetails.purchase_number}</Text> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 5,
    padding: 15,
  },
});

export default PurchaseHistoryDetails;
