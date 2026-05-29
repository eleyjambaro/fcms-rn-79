import * as RNFS from 'react-native-fs';

const appDisplayName = 'FCMSCloud';
const configDirName = `${appDisplayName}_Config`;
const dataDirName = `${appDisplayName}_Data`;

export const appDefaults = {
  appDisplayName: 'FCMSCloud',
  localAccountDbName: 'FCMSLocalAccount.db',
  dbName: 'FCMS.db',
  packageName: 'rocks.uxi.fcmscloud',
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
