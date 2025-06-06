import React from 'react';
import {StyleSheet, Text, Linking} from 'react-native';
import {useTheme} from 'react-native-paper';

const PrivacyPolicyPressableText = props => {
  const {textStyle} = props;
  const {colors} = useTheme();

  return (
    <Text
      onPress={() => {
        Linking.openURL('https://uxi-fcms-developers.github.io/privacy-policy');
      }}
      style={[styles.text, {color: colors.primary}, textStyle]}>
      Privacy Policy
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontWeight: 'bold',
  },
});

export default PrivacyPolicyPressableText;
