import * as RNFS from 'react-native-fs';

const externalStorageAppDirectoryName = '.FCMS';

export const appDefaults = {
  appDisplayName: 'FCMS',
  localAccountDbName: 'FCMSLocalAccountDb',
  dbName: 'FCMSDb',
  packageName: 'rocks.uxi.fcms',
  externalStorageAppDirectoryName,
  externalStorageAppDirectoryPath: `${RNFS.ExternalStorageDirectoryPath}/${externalStorageAppDirectoryName}`,
};

export const appDefaultsTypeRefs = {
  sellingSizeOptions: 'app_default_modifiers@selling_size_options',
};

export default appDefaults;
