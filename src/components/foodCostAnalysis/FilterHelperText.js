import {StyleSheet, View} from 'react-native';
import {Headline, Text, useTheme, HelperText} from 'react-native-paper';
import React from 'react';
import moment from 'moment';

const FilterHelperText = props => {
  const {containerStyle, text = '', textStyle} = props;
  const {colors} = useTheme();

  if (!text) return null;

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.neutralTint5},
        containerStyle,
      ]}>
      <HelperText
        style={[{color: colors.dark, fontStyle: 'italic'}, textStyle]}>
        {text}
      </HelperText>
    </View>
  );
};

export default FilterHelperText;

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
