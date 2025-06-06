import {StyleSheet, Text, View, Linking} from 'react-native';
import React, {useEffect} from 'react';
import {useTheme, Avatar, Button, Subheading} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import appDefaults from '../constants/appDefaults';

const BluetoothPermissionNeeded = props => {
  const {containerStyle, onDismiss, onGranted} = props;
  const {colors} = useTheme();
  const navigation = useNavigation();

  const openSettings = () => Linking.openSettings();

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={{alignItems: 'center', marginBottom: 30}}>
        <Avatar.Icon
          icon="bluetooth-settings"
          size={100}
          color={colors.surface}
        />
      </View>
      <Subheading style={{fontWeight: 'bold', textAlign: 'center'}}>
        {`${appDefaults.appDisplayName} needs bluetooth connectivity related permissions`}
      </Subheading>
      <Text style={[styles.text, {marginBottom: 15}]}>
        {`In order to securely enable ${appDefaults.appDisplayName} printing features, your permission for location and nearby devices are needed.`}
      </Text>
      <Text style={[styles.text, {marginBottom: 15}]}>
        On your device's{' '}
        <Text
          onPress={openSettings}
          style={{color: colors.primary, fontWeight: 'bold'}}>
          Settings
        </Text>
        {', look for '}
        <Text style={{color: colors.dark, fontWeight: 'bold'}}>
          "Permissions"
        </Text>
        {' (in some devices, you can find "Permissions" under '}
        <Text style={{color: colors.dark, fontWeight: 'bold'}}>Privacy</Text>
        {' section of settings page), then go to '}
        <Text style={{color: colors.dark, fontWeight: 'bold'}}>
          {'1.) Location, '}
        </Text>
        <Text style={{color: colors.dark, fontWeight: 'bold'}}>
          2.) Nearby devices,
        </Text>
        {' and then press '}
        <Text style={{color: colors.dark, fontWeight: 'bold'}}>Allow</Text>
        {' for both permission requests. '}
        <Text style={[styles.text]}>
          Go back here and just tap "Close" once you're done.
        </Text>
      </Text>

      <View style={{marginTop: 30}}>
        <Button mode="contained" onPress={openSettings}>
          Open Settings
        </Button>
        <Button
          style={{marginTop: 20}}
          mode="text"
          onPress={() => {
            navigation.goBack();
          }}>
          Close
        </Button>
      </View>
    </View>
  );
};

export default BluetoothPermissionNeeded;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
