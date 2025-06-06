import uuid from 'react-native-uuid';
import * as RNFS from 'react-native-fs';

import {appDefaults} from './appDefaults';

export const diuidConfig = {
  diuidDirectoryPath: `${appDefaults.externalStorageAppDirectoryPath}/.device`,
  diuidFileName: 'diuid.json',
};

export const createNewOrGetDeviceImplantedUniqueId = async () => {
  try {
    const diuidDirectoryPath = diuidConfig.diuidDirectoryPath;
    const diuidFilePath = `${diuidDirectoryPath}/${diuidConfig.diuidFileName}`;

    /**
     * Get existing diuid file
     */
    // Check if diuid file exists
    const diuidFileExists = await RNFS.exists(`${diuidFilePath}`);

    if (!diuidFileExists) {
      /**
       * it means that the diuid file was deleted,
       * or it was the first time the app has been installed to this device.
       */

      /**
       * Create app directory on the device if NOT exist
       */
      const appDirectoryPath = appDefaults.externalStorageAppDirectoryPath;
      const appDirectoryExists = await RNFS.exists(appDirectoryPath);

      if (!appDirectoryExists) {
        await RNFS.mkdir(appDirectoryPath);
      }

      /**
       * Create diuid directory on the device if NOT exist
       */
      const diuidDirectoryExists = await RNFS.exists(diuidDirectoryPath);

      if (!diuidDirectoryExists) {
        await RNFS.mkdir(diuidDirectoryPath);
      }

      const diuid = uuid.v4();

      // Create diuid file
      const diuidJson = JSON.stringify({
        diuid,
      });

      await RNFS.writeFile(diuidFilePath, diuidJson, 'utf8');

      return diuid;
    }

    const diuidFileJson = await RNFS.readFile(diuidFilePath, 'utf8');

    const diuidFileData = JSON.parse(diuidFileJson);

    if (!diuidFileData.diuid) {
      throw Error('Parsed DIUID file with wrong format');
    }

    return diuidFileData.diuid;
  } catch (error) {
    console.debug(error);
    console.debug(
      'Failed to save DIUID (Device Implanted Unique Identifier) file.',
    );
  }
};

export const getDeviceImplantedUniqueId = async () => {
  try {
    const diuidDirectoryPath = diuidConfig.diuidDirectoryPath;
    const diuidFilePath = `${diuidDirectoryPath}/${diuidConfig.diuidFileName}`;

    /**
     * Get existing diuid file
     */
    // Check if diuid file exists
    const diuidFileExists = await RNFS.exists(`${diuidFilePath}`);

    if (!diuidFileExists) {
      throw Error('DIUID not found.');
    }

    const diuidFileJson = await RNFS.readFile(diuidFilePath, 'utf8');

    const diuidFileData = JSON.parse(diuidFileJson);

    if (!diuidFileData.diuid) {
      throw Error('Parsed DIUID file with wrong format');
    }

    return diuidFileData.diuid;
  } catch (error) {
    console.debug(error);
    console.debug(
      'Failed to get DIUID (Device Implanted Unique Identifier) file.',
    );
  }
};

export default diuidConfig;
