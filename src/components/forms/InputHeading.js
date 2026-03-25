import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';

const InputHeading = props => {
  const {children, containerStyle} = props;
  const {colors} = useTheme();

  return (
    <View
      style={[
        {
          marginBottom: 10,
          marginLeft: 10,
        },
        containerStyle,
      ]}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: 'bold',
          color: colors.neutralTint1,
        }}>
        {children}
      </Text>
    </View>
  );
};

export default InputHeading;

const styles = StyleSheet.create({});
