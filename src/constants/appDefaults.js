import * as RNFS from 'react-native-fs';

const externalStorageAppDirectoryName = 'FCMS_Config';

export const appDefaults = {
  appDisplayName: 'FCMS',
  localAccountDbName: 'FCMSLocalAccountDb',
  dbName: 'FCMSDb',
  packageName: 'rocks.uxi.fcms',
  externalStorageAppDirectoryName,
  externalStorageAppDirectoryPath: `${RNFS.DownloadDirectoryPath}/${externalStorageAppDirectoryName}`,
};

export const appDefaultsTypeRefs = {
  sellingSizeOptions: 'app_default_modifiers@selling_size_options',
};

export default appDefaults;
