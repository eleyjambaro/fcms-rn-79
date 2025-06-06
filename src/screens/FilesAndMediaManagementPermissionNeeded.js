import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Linking,
  Platform,
  AppState,
} from 'react-native';
import React, {useEffect, useState, useRef} from 'react';
import {useTheme, Avatar, Button, Subheading} from 'react-native-paper';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import ManageExternalStorage from 'react-native-manage-external-storage';
import RNExitApp from 'react-native-exit-app';
import RNRestart from 'react-native-restart';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import appDefaults from '../constants/appDefaults';

const FilesAndMediaManagementPermissionNeeded = props => {
  const {containerStyle, onDismiss, onGranted} = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const appState = useRef(AppState.currentState);

  async function checkPermissionStatus() {
    const androidVersion = Platform.constants['Release'];
    const sdkVersion = Platform.Version;

    // for Android 11 or higher
    if (sdkVersion >= 30) {
      await ManageExternalStorage.checkPermission(
        err => {
          if (err) {
            console.debug(err);
          }
        },
        isGranted => {
          if (isGranted) {
            RNRestart.restart();
          }
        },
      );
    }
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // app has come to the foreground
        console.log('App has come to the foreground!');
        checkPermissionStatus();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const openManageExternalStorageSettings = async () => {
    await ManageExternalStorage.checkAndGrantPermission(
      err => {
        console.debug(err);
      },
      isGranted => {
        if (isGranted) {
          console.log('Permission granted');
        }
      },
    );
  };

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
        <Subheading
          style={{fontWeight: 'bold', textAlign: 'center', color: colors.dark}}>
          {`${appDefaults.appDisplayName} needs device storage access`}
        </Subheading>
        {/* <Text style={[styles.text, {marginBottom: 15}]}>
        {`In order to securely enable ${appDefaults.appDisplayName} features, your permission for management of all files is needed.`}
      </Text> */}

        <Text style={[styles.text, {marginBottom: 15}]}>
          {`This app is primarily designed for offline use. To keep your data secure, we need permission to access your device’s storage.`}
        </Text>

        <View
          style={[
            styles.card,
            {marginTop: 12, borderColor: colors.neutralTint2},
          ]}>
          <Text style={[styles.contentHeading]}>Why It's Required:</Text>

          <View style={[styles.contentWrapper]}>
            <View style={{flexDirection: 'row'}}>
              <MaterialCommunityIcons
                size={16}
                name="shield-check"
                style={{marginRight: 8}}
              />
              <Text style={[styles.contentSubheading]}>
                {`Prevents data loss if the app is uninstalled`}
              </Text>
            </View>

            <Text>
              {`Your user accounts and data are saved and stored securely. Without this, anyone could erase your data simply by uninstalling the app — including your root user account — and start over as a new user.`}
            </Text>
          </View>

          <View style={[styles.contentWrapper]}>
            <View style={{flexDirection: 'row'}}>
              <MaterialCommunityIcons
                size={16}
                name="database-cog"
                style={{marginRight: 8}}
              />
              <Text style={[styles.contentSubheading]}>
                {`Enables local backup and recovery`}
              </Text>
            </View>

            <Text>
              {`Back up and restore your data directly from your device.`}
            </Text>
          </View>

          <View style={[styles.contentWrapper, {marginTop: 10}]}>
            <View style={{flexDirection: 'row'}}>
              <Text style={{fontStyle: 'italic', fontWeight: 'bold'}}>
                {`We do not access personal files. Your data stays private.`}
              </Text>
            </View>
          </View>
        </View>

        <View style={{marginTop: 30}}>
          <Button mode="contained" onPress={openManageExternalStorageSettings}>
            Enable in Settings
          </Button>
          <Button
            mode="text"
            onPress={() => {
              RNExitApp.exitApp();
            }}
            style={{marginTop: 20}}>
            Exit App
          </Button>
        </View>
      </View>
    </ScrollView>
  );
};

export default FilesAndMediaManagementPermissionNeeded;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    paddingTop: 60,
    paddingBottom: 50,
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 25,
    padding: 20,
  },
  contentHeading: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentSubheading: {
    fontWeight: '700',
    marginBottom: 5,
  },
  contentParagraph: {},
  contentWrapper: {
    marginTop: 15,
  },
});
