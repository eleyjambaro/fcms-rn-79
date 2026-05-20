import {createLocalAccountTables, createTables, alterTables} from '../localDb';
import {appVersion} from '../constants/appConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {deleteDefaultRoles, createDefaultRoles} from '../localDbQueries/roles';
import {deleteDefaultOperations} from '../localDbQueries/operations';
import {handleNewAppVersion} from '../localDbQueries/appVersions';
import mobileAds from 'react-native-google-mobile-ads';

export async function initializeTablesAndHandleAppVersion() {
  await createLocalAccountTables();
  await createTables();
  await alterTables(appVersion);

  await handleNewAppVersion({
    onNewVersionDetected: async () => {
      const keys = await AsyncStorage.getAllKeys();
      const versionedKeys = keys.filter(k => k.includes(appVersion) === false);
      await AsyncStorage.multiRemove(versionedKeys);

      await deleteDefaultRoles();
      await deleteDefaultOperations();
      // Settings, units, and taxes are company-scoped — seeded per-company in
      // CloudAuthContextProvider after setActiveCompanyDb, not here.
    },
  });

  await createDefaultRoles(appVersion);
  // createDefaultSettings, setDefaultUnits, createDefaultInventoryOperations,
  // and createDefaultTaxes are company-specific and are called in
  // CloudAuthContextProvider after the company DB is activated.
}

export async function initializeOtherServices() {
  await mobileAds().initialize();
  console.info('Mobile ads initialized.');
}
