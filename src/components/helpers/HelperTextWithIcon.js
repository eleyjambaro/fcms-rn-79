import React, {useState, useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, HelperText, useTheme} from 'react-native-paper';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const HelperTextWithIcon = props => {
  const {containerStyle, text} = props;
  const {colors} = useTheme();

  if (!text) return null;

  return (
    <View
      style={[{flexDirection: 'row', alignItems: 'center'}, containerStyle]}>
      <MaterialCommunityIcons
        name="information"
        size={18}
        color={colors.placeholder}
        style={{paddingLeft: 7, paddingRight: 0, marginRight: -5}}
      />
      <HelperText
        visible={true}
        style={{
          color: colors.dark,
          fontStyle: 'italic',
        }}>
        {text}
      </HelperText>
    </View>
  );
};

export default HelperTextWithIcon;

const styles = StyleSheet.create({});
