import React from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {useTheme} from 'react-native-paper';

const DefaultLoadingScreen = props => {
  const {colors} = useTheme();
  const {containerStyle, loaderColor, loaderSize = 'large'} = props;

  return (
    <View style={[styles.container, containerStyle]}>
      <ActivityIndicator
        color={loaderColor || colors.primary}
        size={loaderSize}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DefaultLoadingScreen;
