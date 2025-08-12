import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import semver from 'semver';
import axios from 'axios';

// Replace these with your actual store URLs
const STORE_URLS = {
  ios: 'https://apps.apple.com/app/your-app-id',
  android: 'https://play.google.com/store/apps/details?id=rocks.uxi.fcms',
};

// We can replace this with an API call to our backend
const getLatestVersion = async () => {
  // This is a placeholder. In production, we should fetch this from our backend
  let latestVersions = {
    ios: '0.0.0',
    android: '1.0.7',
    minimumSupported: '1.0.0',
  };

  try {
    const {data} = await axios.get(
      'https://uxi-fcms-developers.github.io/app-version/version.json',
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!data) throw Error('Invalid data response.');

    latestVersions = data;
    return latestVersions;
  } catch (error) {
    console.warn(
      'Getting version and minimum supported version from backend error:',
      error,
    );

    // Fallback to the hardcoded versions if the API call fails
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
