import {createTables, alterTables} from '../localDb';
import {appVersion} from '../constants/appConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import {handleAccountCheckingForThisDevice} from '../localDbQueries/accounts';
import deviceInfo from '../lib/deviceInfo';
import mobileAds from 'react-native-google-mobile-ads';

export async function initializeSegment1() {
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

export async function initializeSegment2() {
  await handleAccountCheckingForThisDevice();
  const deviceId = await deviceInfo.getDeviceId();
  console.info('Device ID:', deviceId);
}

export async function initializeSegment3() {
  await mobileAds().initialize();
  console.info('Mobile ads initialized.');
}
