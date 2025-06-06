import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTheme} from 'react-native-paper';

import ExportButton from '../buttons/ExportButton';

const SalesRegisterHeaderRight = props => {
  const {onPressExportButton, onPressMenuButton} = props;
  const {colors} = useTheme();

  return (
    <View style={{flexDirection: 'row'}} {...props}>
      {/* <ExportButton style={{marginRight: 15}} onPress={onPressExportButton} /> */}
      <MaterialCommunityIcons
        onPress={onPressMenuButton}
        style={{marginRight: 15}}
        name="menu"
        size={27}
        color={colors.dark}
        {...props}
      />
    </View>
  );
};

export default SalesRegisterHeaderRight;

const styles = StyleSheet.create({});
