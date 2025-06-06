import {StyleSheet, View} from 'react-native';
import React from 'react';
import {Checkbox, Text} from 'react-native-paper';

import PrivacyPolicyPressableText from './PrivacyPolicyPressableText';

const PrivacyPolicyConfirmation = props => {
  const {status, onPressCheckbox, containerStyle, textStyle} = props;

  return (
    <View style={[styles.container, containerStyle]}>
      <View>
        <Checkbox
          status={status ? 'checked' : 'unchecked'}
          onPress={() => {
            onPressCheckbox && onPressCheckbox(status);
          }}
        />
      </View>

      <View>
        <Text style={[styles.text, textStyle]}>
          I have read and agree to the <PrivacyPolicyPressableText />.
        </Text>
      </View>
    </View>
  );
};

export default PrivacyPolicyConfirmation;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
  },
});
