import {StyleSheet, View} from 'react-native';
import React from 'react';
import {Checkbox, Text} from 'react-native-paper';

const AccountDeletionConfirmation = props => {
  const {status, onPressCheckbox, containerStyle, textStyle} = props;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={{alignSelf: 'baseline', marginRight: 10}}>
        <Checkbox
          status={status ? 'checked' : 'unchecked'}
          onPress={() => {
            onPressCheckbox && onPressCheckbox(status);
          }}
        />
      </View>

      <View style={{flex: 1}}>
        <Text style={[styles.text, textStyle]}>
          I understand that deleting my account will permanently erase all data
          related to this app from this device.
        </Text>
      </View>
    </View>
  );
};

export default AccountDeletionConfirmation;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: 'bold',
  },
});
