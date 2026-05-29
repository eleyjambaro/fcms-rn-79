import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import semver from 'semver';
import axios from 'axios';

import {
  versionCheckUrl,
  iosStoreUrl,
  androidStoreUrl,
} from '../config/env';

const STORE_URLS = {
  ios: iosStoreUrl,
  android: androidStoreUrl,
};

const getLatestVersion = async () => {
  let latestVersions = {
    ios: '0.0.0',
    android: '1.0.7',
    minimumSupported: '1.0.0',
  };

  try {
    const {data} = await axios.get(versionCheckUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!data) throw Error('Invalid data response.');

    latestVersions = data;
    return latestVersions;
  } catch (error) {
    console.warn(
      'Getting version and minimum supported version from backend error:',
      error,
    );

    return latestVersions;
  }
};

export const checkVersion = async () => {
  try {
    const currentVersion = DeviceInfo.getVersion();
    const platform = Platform.OS;

    const {ios, android, minimumSupported} = await getLatestVersion();
    const latestVersion = platform === 'ios' ? ios : android;

    const needsUpdate = semver.lt(currentVersion, latestVersion);
    const isForceUpdate = semver.lt(currentVersion, minimumSupported);

    return {
      currentVersion,
      latestVersion,
      needsUpdate,
      isForceUpdate,
      storeUrl: STORE_URLS[platform],
    };
  } catch (error) {
    console.error('Version check failed:', error);
    return null;
  }
};
