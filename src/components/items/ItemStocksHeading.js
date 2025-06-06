import {StyleSheet, View} from 'react-native';
import {Headline, Subheading, Text, useTheme} from 'react-native-paper';
import React from 'react';
import moment from 'moment';
import {useNavigation} from '@react-navigation/native';
import routes from '../../constants/routes';
import * as RootNavigation from '../../../RootNavigation';

const ItemStocksHeading = props => {
  const {
    item,
    date,
    containerStyle,
    textStyle,
    monthLabelPrefix = 'Added Stocks in ',
    onDismiss,
  } = props;
  const {colors} = useTheme();

  if (!date) return null;

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.neutralTint5},
        containerStyle,
        {justifyContent: 'center'},
      ]}>
      <View>
        <Subheading
          onPress={() => {
            onDismiss && onDismiss();
            RootNavigation?.navigate(routes.itemView(), {
              item_id: item?.item_id || item.id,
            });
          }}
          numberOfLines={3}
          style={{
            fontWeight: 'bold',
            fontSize: 18,
            color: colors.primary,
          }}>
          {`${item?.item_name}`}
        </Subheading>
      </View>
      <View style={{flexDirection: 'row', alignItems: 'flex-end'}}>
        <Text
          style={[
            styles.heading,
            {color: colors.dark, fontWeight: '100', fontSize: 16},
          ]}>
          {`${monthLabelPrefix}`}
        </Text>
        <Text style={[styles.heading, {color: colors.dark}, textStyle]}>
          {moment(date).format('MMMM YYYY')}
        </Text>
      </View>
    </View>
  );
};

export default ItemStocksHeading;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  heading: {
    fontWeight: 'bold',
    fontSize: 18,
  },
});
