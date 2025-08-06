import * as RNFS from 'react-native-fs';

const appDisplayName = 'FCMS';
const configDirName = `${appDisplayName}_Config`;
const dataDirName = `${appDisplayName}_Data`;

export const appDefaults = {
  appDisplayName: 'FCMS',
  localAccountDbName: 'FCMSLocalAccount.db',
  dbName: 'FCMS.db',
  packageName: 'rocks.uxi.fcms',
  configDirName,
  dataDirName,
  externalStorageAppDirectoryPath: `${RNFS.DownloadDirectoryPath}/${configDirName}`,
  configDirPath: `${RNFS.DownloadDirectoryPath}/${configDirName}`, // alias of externalStorageAppDirectoryPath
  dataDirPath: `${RNFS.DownloadDirectoryPath}/${dataDirName}`,
};

export const appDefaultsTypeRefs = {
  sellingSizeOptions: 'app_default_modifiers@selling_size_options',
};

export default appDefaults;
