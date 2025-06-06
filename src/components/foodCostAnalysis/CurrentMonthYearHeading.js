import {StyleSheet, View} from 'react-native';
import {Headline, Text, useTheme} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import React from 'react';
import moment from 'moment';

const CurrentMonthYearHeading = props => {
  const {date, containerStyle, textStyle} = props;
  const {colors} = useTheme();

  if (!date) return null;

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.neutralTint5},
        containerStyle,
      ]}>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <MaterialCommunityIcons
          name="calendar-month-outline"
          size={27}
          color={colors.dark}
          style={{marginRight: 7}}
        />
        <Text style={[styles.heading, {color: colors.dark}, textStyle]}>
          {moment(date).format('MMMM YYYY')}
        </Text>
      </View>
    </View>
  );
};

export default CurrentMonthYearHeading;

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
