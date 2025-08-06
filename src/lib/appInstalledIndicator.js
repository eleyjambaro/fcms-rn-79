import * as RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import appDefaults from '../constants/appDefaults';
import {asyncStorageKeys} from '../constants/asyncStorageKeys';

export const CONFIG_FOLDER = appDefaults.configDirPath;

// File to indicate that the app has been installed and configured on this device
export const APP_INSTALLED_INDICATOR_FILE = `${CONFIG_FOLDER}/app-installed-indicator`;

// Ensure config folder exists
export const ensureConfigDirectoryExists = async () => {
  const exists = await RNFS.exists(CONFIG_FOLDER);
  if (!exists) {
    await RNFS.mkdir(CONFIG_FOLDER);
  }
};

/**
 * Writes a file to indicate that the app has been installed on this device.
 * This file is used to check if the app was previously installed.
 */
export const writeAppInstalledIndicator = async () => {
  try {
    await ensureConfigDirectoryExists();

    const exists = await RNFS.exists(APP_INSTALLED_INDICATOR_FILE);
    if (!exists) {
      await RNFS.writeFile(APP_INSTALLED_INDICATOR_FILE, 'installed', 'utf8');
      console.info('App install indicator written.');
    } else {
      console.info('App install indicator already exists.');
    }
    return true;
  } catch (err) {
    console.error('Error writing app-installed indicator:', err);
    return false;
  }
};

/**
 * Checks if the indicator file exists to determine if the app was previously installed.
 * Returns true if the file exists, false otherwise.
 */
export const checkIfAppInstalledIndicatorExists = async () => {
  try {
    const exists = await RNFS.exists(APP_INSTALLED_INDICATOR_FILE);

    if (exists) {
      console.info('App installed indicator exists.');
    }

    return exists;
  } catch (err) {
    console.error('Error checking app-installed indicator:', err);
    return false;
  }
};

export const ignoreExistingAppData = async () => {
  try {
    await AsyncStorage.setItem(asyncStorageKeys.ignoredExistingAppData, 'true');
    console.info('Existing app data ignored.');
  } catch (err) {
    console.error('Error ignoring existing app data:', err);
  }
};

export const isIgnoredExistingAppData = async () => {
  const isIgnored = await AsyncStorage.getItem(
    asyncStorageKeys.ignoredExistingAppData,
  );

  if (!isIgnored || isIgnored === 'false') {
    return false;
  } else if (isIgnored || isIgnored === 'true') {
    return true;
  } else {
    return false;
  }
};

export const recoverExistingAppData = async () => {
  try {
    await AsyncStorage.setItem(
      asyncStorageKeys.recoveredExistingAppData,
      'true',
    );
    console.info('Existing app data recovered.');
  } catch (err) {
    console.error('Error recovering existing app data:', err);
  }
};

export const isRecoveredExistingAppData = async () => {
  const isRecovered = await AsyncStorage.getItem(
    asyncStorageKeys.recoveredExistingAppData,
  );

  if (!isRecovered || isRecovered === 'false') {
    return false;
  } else if (isRecovered || isRecovered === 'true') {
    return true;
  } else {
    return false;
  }
};
