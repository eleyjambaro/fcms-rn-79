import React from 'react';
import {StyleSheet, View, ActivityIndicator} from 'react-native';
import {useTheme} from 'react-native-paper';

const ListLoadingFooter = props => {
  const {loaderColor, loaderSize = 'large', containerStyle} = props;
  const {colors} = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      <ActivityIndicator
        size={loaderSize}
        color={loaderColor || colors.primary}
      />
    </View>
  );
};

export default ListLoadingFooter;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
