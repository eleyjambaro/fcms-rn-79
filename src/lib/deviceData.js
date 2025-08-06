import * as RNFS from 'react-native-fs';

import appDefaults from '../constants/appDefaults';
import manualDataRecovery from '../constants/dataRecovery';
import * as appMediaStore from '../lib/appMediaStore';

export const DATA_FOLDER = appDefaults.dataDirPath;

export const ensureDataDirectoryExists = async () => {
  const exists = await RNFS.exists(DATA_FOLDER);
  if (!exists) {
    await RNFS.mkdir(DATA_FOLDER);
  }
};

export const saveBackupDataToThisDevice = async () => {
  try {
    await ensureDataDirectoryExists();

    const backupDbName = `${manualDataRecovery.backupDbPrefix}${Date.now()}.db`;

    /**
     * Locate databases path (where sqlite database file is located)
     *
     * /data/user/0/{packageName}/databases
     */
    const paths = RNFS.DocumentDirectoryPath.split('/');
    paths.pop();
    paths.push('databases');
    const databasesDirectoryPath = paths.join('/');

    /**
     * Copy sqlite database file from databases directory to data recovery directory
     */
    const dbFilePath = `${databasesDirectoryPath}/${appDefaults.dbName}`;

    const dbFileExists = await RNFS.exists(dbFilePath);

    if (dbFileExists) {
      await appMediaStore.copyFileToMediaStore(
        dbFilePath,
        `${backupDbName}`,
        'application/octet-stream',
        'Download/FCMS_Data',
      );
    }
  } catch (error) {
    throw error;
  }
};
