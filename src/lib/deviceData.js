import * as RNFS from 'react-native-fs';
import * as DocumentPicker from '@react-native-documents/picker';
import moment from 'moment';
import RNFetchBlob from 'rn-fetch-blob';

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
      await appMediaStore.copyFile(dbFilePath, 'FCMS_Data', `${backupDbName}`);
    }
  } catch (error) {
    throw error;
  }
};

export const selectBackupDataFromThisDevice = async () => {
  try {
    const [file] = await DocumentPicker.pick({
      type: [
        'application/x-sqlite3',
        'application/vnd.sqlite3',
        'application/octet-stream',
      ],
      allowMultiSelection: false,
      allowVirtualFiles: true,
      requestLongTermAccess: true,
      presentationStyle: 'fullScreen',
    });

    // Additional validation to ensure the file has .db extension
    if (file && file.name && !file.name.toLowerCase().endsWith('.db')) {
      throw new Error('Please select a valid .db file');
    }

    return file;
  } catch (err) {
    if (!DocumentPicker.isCancel(err)) {
      console.error('DocumentPicker Error:', err);
    }
  }
};

export const formatSelectedBackupFile = async file => {
  if (!file || !file.name || !file.uri) return null;

  const timestamp = file.name
    .split(`${manualDataRecovery.backupDbPrefix}`)
    .pop() // e.g.: "1754414900020.db"
    .split('.')[0];
  const backupDate = new Date(parseInt(timestamp));
  const backupDateFormatted = moment(backupDate).format(
    'MMMM DD, YYYY, hh:mm A',
  );

  // Try to resolve a filesystem path, but allow null for content URIs
  let path = null;
  try {
    const stats = await RNFetchBlob.fs.stat(decodeURI(file.uri));
    path = stats?.path || null;
  } catch (_e) {
    path = null;
  }

  return {
    name: file.name,
    uri: file.uri,
    path,
    backupDate: backupDate,
    backupDateFormatted,
  };
};

export const restoreSelectedBackupDataFromThisDevice = async ({
  fileUri,
  destinationPath,
}) => {
  try {
    await ensureDataDirectoryExists();

    if (!fileUri || !destinationPath) return;

    const decodedUri = decodeURI(fileUri);

    // If it's a plain filesystem path, copy directly
    if (!decodedUri.startsWith('content://')) {
      await RNFS.copyFile(decodedUri, destinationPath);
      return;
    }

    // Try to resolve a real path for the content URI
    let resolvedPath = null;
    try {
      const stats = await RNFetchBlob.fs.stat(decodedUri);
      resolvedPath = stats?.path || null;
    } catch (_e) {
      resolvedPath = null;
    }

    if (resolvedPath) {
      await RNFS.copyFile(resolvedPath, destinationPath);
      return;
    }

    // Fallback: stream read base64 from content URI then write to destination
    const base64Data = await RNFetchBlob.fs.readFile(decodedUri, 'base64');
    await RNFS.writeFile(destinationPath, base64Data, 'base64');
  } catch (error) {
    throw error;
  }
};
