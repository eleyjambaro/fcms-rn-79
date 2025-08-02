import {PermissionsAndroid, Platform} from 'react-native';

export async function checkPermissions({onRWDenied, onMgmtNeeded}) {
  const sdkVersion = Platform.Version;

  if (Platform.OS === 'android' && sdkVersion >= 30) {
    onMgmtNeeded && onMgmtNeeded();
    return;
  }

  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  );

  if (!granted) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );

    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      onRWDenied && onRWDenied();
    }
  }
}
