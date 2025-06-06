import React, {useState, useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, HelperText, useTheme} from 'react-native-paper';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const FormRequiredFieldHelperText = props => {
  const {containerStyle} = props;
  const {colors} = useTheme();
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
        {`Red asterisk (`}
        {<Text style={{fontStyle: 'italic', color: colors.error}}>*</Text>}

        {`) indicates required field`}
      </HelperText>
    </View>
  );
};

export default FormRequiredFieldHelperText;

const styles = StyleSheet.create({});
