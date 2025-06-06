import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme, Headline} from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';
import moment from 'moment';
import {padNumber} from '../../utils/stringHelpers';

const SalesOrderDetails = props => {
  const {containerStyle, salesOrderGroup} = props;
  const {colors} = useTheme();

  if (!salesOrderGroup) return null;

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.surface},
        containerStyle,
      ]}>
      <Headline>{`SO-${padNumber(salesOrderGroup.id)}`}</Headline>
      <View style={[styles.detailsListItem, {marginTop: 10}]}>
        <View>
          <Text style={{fontWeight: 'bold', marginBottom: 5}}>Order Date:</Text>
          <View
            style={{
              flexDirection: 'row',
              marginLeft: 10,
              alignItems: 'center',
            }}>
            <Text
              style={{
                marginLeft: 7,
                fontWeight: 'bold',
                color: colors.dark,
                fontSize: 16,
              }}>
              {moment(salesOrderGroup.order_date.split(' ').join('T')).format(
                'MMMM DD, YYYY, hh:mm A',
              )}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 5,
    padding: 15,
  },
  detailsContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  detailsListItem: {
    marginLeft: 0,
    marginVertical: 3,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECECEC',
    padding: 10,
    borderRadius: 15,
  },
});

export default SalesOrderDetails;
