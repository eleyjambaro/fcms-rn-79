import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import AppIcon from '../components/icons/AppIcon';
import {useTheme} from 'react-native-paper';

const Splash = props => {
  const {containerStyle, message} = props;
  const {colors} = useTheme();

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.primary},
        containerStyle,
      ]}>
      <AppIcon
        styleVariant="light"
        containerStyle={{height: '100%', paddingBottom: 80}}
        message={message}
      />
    </View>
  );
};

export default Splash;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
});
