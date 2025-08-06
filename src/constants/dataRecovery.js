import {appDefaults} from './appDefaults';

const dbPrefix = `${appDefaults.appDisplayName?.toLocaleLowerCase()}_dbr_`;

export const manualDataRecovery = {
  directoryName: `${appDefaults.appDisplayName}_Data`,
  configFileName: 'dbr_cfg.json',
  backupDbPrefix: dbPrefix,
  configTokenKey: 'test', // should be device's Mac Address
  packageName: appDefaults.packageName,
};

export const cloudDataRecovery = {
  directoryName: `${appDefaults.appDisplayName}_Cloud`,
  configFileName: 'dbr_cfg.json',
  backupDbPrefix: dbPrefix,
  stagingDbPrefix: dbPrefix, // alias for backupDbPrefix
  filesDirectoryName: 'files',
  stagingDirectoryName: 'staging',
  replacedFilesDirectoryName: 'replaced',
  configTokenKey: 'test', // should be the device DIUID
};

export default manualDataRecovery;
