import * as RNFS from 'react-native-fs';

const appDisplayName = 'FCMS Cloud';
const appShortName = 'FCMSCloud';
const configDirName = `${appShortName}_Config`;
const dataDirName = `${appShortName}_Data`;

export const appDefaults = {
  appDisplayName,
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
