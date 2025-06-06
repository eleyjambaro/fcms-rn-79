import {StyleSheet, Text, View, Linking} from 'react-native';
import React from 'react';
import {useTheme, Avatar, Button} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import appDefaults from '../constants/appDefaults';

const StoragePermissionNeeded = props => {
  const {containerStyle, recheckPermission} = props;
  const {colors} = useTheme();
  const navigation = useNavigation();

  const openSettings = () => Linking.openSettings();

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={{alignItems: 'center', marginBottom: 30}}>
        <Avatar.Icon
          icon="folder-cog-outline"
          size={100}
          color={colors.surface}
        />
      </View>
      <Text style={[styles.text, {marginBottom: 15}]}>
        {`${appDefaults.appDisplayName} needs your permission to access the device storage system. Tap `}
        <Text style={{color: colors.dark, fontWeight: 'bold'}}>
          Open Permission Modal
        </Text>
        {' to allow permission, or you can manually enable it in your device '}
        <Text
          onPress={openSettings}
          style={{color: colors.primary, fontWeight: 'bold'}}>
          Settings
        </Text>
        {' by allowing '}
        <Text style={{color: colors.dark, fontWeight: 'bold'}}>
          Files and media
        </Text>
        {' permission for this app.'}
      </Text>

      <View style={{marginTop: 30}}>
        <Button
          mode="contained"
          onPress={() => {
            recheckPermission && recheckPermission();
          }}>
          Open Permission Modal
        </Button>
        <Button mode="outlined" onPress={openSettings} style={{marginTop: 15}}>
          Enable in Settings
        </Button>
        <Button onPress={() => {}} style={{marginTop: 15}}>
          Next
        </Button>
      </View>
    </View>
  );
};

export default StoragePermissionNeeded;

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
