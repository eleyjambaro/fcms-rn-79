import {StyleSheet, Text, View, ScrollView, Linking} from 'react-native';
import React from 'react';
import {useTheme, Avatar, Button, Subheading} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import ManageExternalStorage from 'react-native-manage-external-storage';
import appDefaults from '../constants/appDefaults';

const FilesAndMediaReadAndWritePermissionNeeded = props => {
  const {containerStyle, onDismiss, onGranted} = props;
  const {colors} = useTheme();
  const navigation = useNavigation();

  const openSettings = () => Linking.openSettings();

  return (
    <ScrollView>
      <View style={[styles.container, containerStyle]}>
        <View style={{alignItems: 'center', marginBottom: 30}}>
          <Avatar.Icon
            icon="folder-cog-outline"
            size={100}
            color={colors.surface}
          />
        </View>
        <Subheading style={{fontWeight: 'bold', textAlign: 'center'}}>
          {`${appDefaults.appDisplayName} needs device storage`}
        </Subheading>
        <Text style={[styles.text, {marginBottom: 15}]}>
          {`In order to securely enable ${appDefaults.appDisplayName} features, your permission for management of all files is needed.`}
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
            Files and media
          </Text>
          {' and '}
          <Text style={{color: colors.dark, fontWeight: 'bold'}}>
            Allow management of all files
          </Text>
          {' for this app. '}
          <Text style={[styles.text]}>
            Go back here and just tap "Next" once you're done.
          </Text>
        </Text>

        <View style={{marginTop: 30}}>
          <Button mode="contained" onPress={openSettings}>
            Open Settings
          </Button>
        </View>
      </View>
    </ScrollView>
  );
};

export default FilesAndMediaReadAndWritePermissionNeeded;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    paddingTop: 100,
    paddingBottom: 50,
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
