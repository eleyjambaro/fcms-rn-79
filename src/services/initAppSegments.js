import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds from 'react-native-google-mobile-ads';

import {createTables, alterTables} from '../localDb';
import {appVersion} from '../constants/appConfig';
import {deleteDefaultRoles, createDefaultRoles} from '../localDbQueries/roles';
import {
  deleteDefaultOperations,
  createDefaultInventoryOperations,
} from '../localDbQueries/operations';
import {
  deleteAllSettings,
  createDefaultSettings,
} from '../localDbQueries/settings';
import {deleteDefaultTaxes, createDefaultTaxes} from '../localDbQueries/taxes';
import {deleteAllUnits, setDefaultUnits} from '../localData/units';
import {handleNewAppVersion} from '../localDbQueries/appVersions';

export async function initializeTablesAndHandleAppVersion() {
  await createTables();
  await alterTables(appVersion);

  await handleNewAppVersion({
    onNewVersionDetected: async () => {
      const keys = await AsyncStorage.getAllKeys();
      const versionedKeys = keys.filter(k => k.includes(appVersion) === false);
      await AsyncStorage.multiRemove(versionedKeys);

      await deleteDefaultRoles();
      await deleteAllSettings();
      await deleteDefaultOperations();
      await deleteDefaultTaxes();
      await deleteAllUnits();
    },
  });

  await createDefaultRoles(appVersion);
  await createDefaultSettings(appVersion);
  await createDefaultInventoryOperations(appVersion);
  await createDefaultTaxes(appVersion);
  await setDefaultUnits(appVersion);
}

export async function initializeOtherServices() {
  await mobileAds().initialize();
  console.info('Mobile ads initialized.');
}
