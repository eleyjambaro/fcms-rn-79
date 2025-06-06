import {StyleSheet, Text, View} from 'react-native';
import React from 'react';

const DashedDivider = props => {
  const {containerStyle} = props;

  return (
    <View
      style={[
        {height: 1, overflow: 'hidden', marginVertical: 15},
        containerStyle,
      ]}>
      <View
        style={[
          {
            height: 2,
            borderWidth: 1,
            borderColor: '#ddd',
            borderStyle: 'dashed',
          },
        ]}></View>
    </View>
  );
};

export default DashedDivider;

const styles = StyleSheet.create({});
