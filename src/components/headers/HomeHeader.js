import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme, Avatar} from 'react-native-paper';

const HomeHeader = () => {
  const {colors} = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.primary,
        },
      ]}>
      <View>
        <Text>TGI Friday's Branch</Text>
      </View>
      <Avatar.Text
        size={44}
        label="TF"
        color={colors.dark}
        style={{backgroundColor: colors.background, marginLeft: 'auto'}}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 65,
    elevation: 3,
    flexDirection: 'row',
    padding: 10,
  },
});

export default HomeHeader;
