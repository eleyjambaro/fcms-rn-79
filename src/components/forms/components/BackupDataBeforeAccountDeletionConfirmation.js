import {StyleSheet, View} from 'react-native';
import React from 'react';
import {Checkbox, Text} from 'react-native-paper';

const BackupDataBeforeAccountDeletionConfirmation = props => {
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
          {'Backup inventory data to this device before deleting the account'}
          <Text style={{fontWeight: 'normal', fontStyle: 'italic'}}>
            {' (recommended)'}
          </Text>
        </Text>
        <Text style={[styles.text, {fontWeight: 'normal'}]}>
          {
            'If left unchecked, your inventory data will be deleted without a backup — unless you manually used the '
          }
          <Text style={[styles.text]}>{`"Backup Data to This Device"`}</Text>
          {' option before starting this account deletion.'}
        </Text>
      </View>
    </View>
  );
};

export default BackupDataBeforeAccountDeletionConfirmation;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: 'bold',
  },
});
