import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
const { RNMediaStore } = NativeModules;

async function ensureReadPermission() {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 29) return true; // scoped storage reads via content URIs often fine
  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
  if (granted) return true;
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

async function ensureWritePermission() {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 29) return true; // scoped storage
  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  if (granted) return true;
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export async function writeFile(fileName, directory, base64Data) {
  await ensureWritePermission();
  return RNMediaStore.writeFile(fileName, directory || '', base64Data);
}

export async function readFile(fileName, directory) {
  await ensureReadPermission();
  return RNMediaStore.readFile(fileName, directory || '');
}

export async function deleteFile(fileName, directory) {
  await ensureWritePermission();
  return RNMediaStore.deleteFile(fileName, directory || '');
}

export async function listFiles(directory) {
  await ensureReadPermission();
  return RNMediaStore.listFiles(directory || '');
}

/**
 * copyFile: sourcePath can be:
 *  - absolute path: /storage/emulated/0/Download/myfile.pdf
 *  - content URI: content://com.android.providers.documents/document/...
 * For DocumentPicker, use the `uri` property you get back, or the file path if you copied the document locally.
 */
export async function copyFile(sourcePath, destDirectory, destFileName) {
  await ensureWritePermission();
  return RNMediaStore.copyFile(sourcePath, destDirectory || '', destFileName);
}

export async function moveFile(sourcePath, destDirectory, destFileName) {
  await ensureWritePermission();
  return RNMediaStore.moveFile(sourcePath, destDirectory || '', destFileName);
}
