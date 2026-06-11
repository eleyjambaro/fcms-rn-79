import React from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {useTheme, Headline} from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';
import moment from 'moment';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {getInvoiceReceiptNumber} from '../../utils/stringHelpers';

const SalesInvoiceDetails = props => {
  const {containerStyle, salesInvoice, handlePressPrint} = props;
  const {colors} = useTheme();

  if (!salesInvoice) return null;

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.surface},
        containerStyle,
      ]}>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <View style={{flex: 1}}>
          <Headline style={{color: colors.accent}}>
            {getInvoiceReceiptNumber(salesInvoice)}
          </Headline>
          <Text style={{color: colors.dark}}>
            {moment(salesInvoice.invoice_date.split(' ').join('T')).format(
              'MMMM DD, YYYY, hh:mm A',
            )}
          </Text>
        </View>
        <Pressable
          style={[
            {
              marginLeft: 'auto',
              padding: 8,
              borderWidth: 1,
              borderColor: colors.dark,
              borderRadius: 5,
            },
          ]}
          onPress={handlePressPrint}>
          <MaterialCommunityIcons
            name="printer-outline"
            size={25}
            color={colors.dark}
          />
        </Pressable>
      </View>

      {/* <Text>{salesInvoice.purchase_number}</Text> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 5,
    padding: 15,
  },
});

export default SalesInvoiceDetails;
