import {getDBConnection} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {appVersion} from '../constants/appConfig';

export const appStorageKeySeperator = '_app_version_';

export const handleNewAppVersion = async ({onNewVersionDetected}) => {
  const installedAppVersion = appVersion;
  let isNewVersion = false;
  let isAppFreshInstalled = false;

  console.info('Current installed app version: ', appVersion);

  try {
    const db = await getDBConnection();

    /**
     * Get the previously installed app version exists on database
     */
    const getVersionQuery = `
      SELECT * FROM app_versions
    `;

    const getVersionResult = await db.executeSql(getVersionQuery);
    const fetchedVersion = getVersionResult[0].rows.item(0);

    console.info('Previously installed app version info: ', fetchedVersion);

    if (!fetchedVersion) {
      isAppFreshInstalled = true;
    } else {
      isAppFreshInstalled = false;
    }

    if (fetchedVersion && fetchedVersion.version === installedAppVersion) {
      isNewVersion = false;
    } else {
      isNewVersion = true;
    }

    console.info('Is app fresh installed/reinstalled: ', isAppFreshInstalled);
    console.info('Is new version: ', isNewVersion);

    if (isNewVersion || isAppFreshInstalled) {
      /**
       * Delete/clean up all previous app versions
       */
      const deleteAllPreviousAppVersionsQuery = `DELETE FROM app_versions WHERE version != '${installedAppVersion}'`;
      await db.executeSql(deleteAllPreviousAppVersionsQuery);

      /**
       * Save installed app version as latest version
       */
      const saveVersionQuery = `
        INSERT INTO app_versions (
          version
        )
      
        VALUES(
          '${installedAppVersion}'
        );
      `;

      const saveVersionResult = await db.executeSql(saveVersionQuery);

      if (saveVersionResult[0].rowsAffected > 0) {
        console.info('Installed app version saved to database.');
      } else {
        throw Error('Failed to save new app version');
      }

      onNewVersionDetected && (await onNewVersionDetected(installedAppVersion));
    }
  } catch (error) {
    console.debug(error);
    throw Error('Something went wrong on handling new app version.');
  }
};

export const deletePreviousAppVersionDefaults = async () => {
  try {
    const db = await getDBConnection();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete all previous app version defaults.');
  }
};

export const getLatestAppVersion = async () => {
  try {
    const db = await getDBConnection();
    const query = `SELECT * FROM app_versions ORDER BY date ASC LIMIT 1`;
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get latest app version.');
  }
};

export const deleteAllPreviousAppVersions = async () => {
  try {
    const db = await getDBConnection();
    const {result: latestVersion} = await getLatestAppVersion();

    if (!latestVersion) {
      return;
    }

    const deleteAllPreviousAppVersionsQuery = `DELETE FROM app_versions WHERE id != ${latestVersion?.id}`;

    await db.executeSql(deleteAllPreviousAppVersionsQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete all previous app versions.');
  }
};
