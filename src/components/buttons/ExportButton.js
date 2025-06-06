import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {useTheme} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const ExportButton = props => {
  const {colors} = useTheme();

  return (
    <MaterialCommunityIcons
      name="file-export-outline"
      size={27}
      color={colors.dark}
      {...props}
    />
  );
};

export default ExportButton;

const styles = StyleSheet.create({});
