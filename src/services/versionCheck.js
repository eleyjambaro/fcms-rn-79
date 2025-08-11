import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import semver from 'semver';

// Replace these with your actual store URLs
const STORE_URLS = {
  ios: 'https://apps.apple.com/app/your-app-id',
  android: 'https://play.google.com/store/apps/details?id=rocks.uxi.fcms',
};

// We can replace this with an API call to our backend
const getLatestVersion = async () => {
  // This is a placeholder. In production, we should fetch this from our backend
  const latestVersions = {
    ios: '0.0.0',
    android: '1.0.7',
    minimumSupported: '1.0.0',
  };

  return latestVersions;
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
