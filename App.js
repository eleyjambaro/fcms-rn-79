/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React, {useEffect, useState, useRef} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  AppState,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {Button, Dialog, Text, Portal} from 'react-native-paper';
import {NavigationContainer} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ManageExternalStorage from 'react-native-manage-external-storage';
import {useQuery} from '@tanstack/react-query';
import {FileLogger} from 'react-native-file-logger';
import * as RNFS from 'react-native-fs';

import AuthStack from './src/stacks/AuthStack';
import withAuthContextProvider from './src/hoc/withAuthContextProvider';
import withAccountSetupContextProvider from './src/hoc/withAccountSetupContextProvider';
import useAuthContext from './src/hooks/useAuthContext';
import RootStack from './src/stacks/RootStack';
import {
  alterTables,
  createLocalAccountTables,
  createTables,
  deleteTable,
} from './src/localDb';
import {
  createDefaultInventoryOperations,
  deleteAllOperations,
  deleteDefaultOperations,
} from './src/localDbQueries/operations';
import {deleteAllUnits, setDefaultUnits} from './src/localData/units';
import {
  createDefaultTaxes,
  deleteAllTaxes,
  deleteDefaultTaxes,
} from './src/localDbQueries/taxes';
import AccountSetupStack from './src/stacks/AccountSetupStack';
import {
  createDefaultSettings,
  deleteAllSettings,
} from './src/localDbQueries/settings';
import Splash from './src/screens/Splash';
import StoragePermissionNeeded from './src/screens/StoragePermissionNeeded';
import FilesAndMediaManagementPermissionNeeded from './src/screens/FilesAndMediaManagementPermissionNeeded';

import {appVersion} from './src/constants/appConfig';
import {
  appStorageKeySeperator,
  handleNewAppVersion,
} from './src/localDbQueries/appVersions';
import {
  getAuthTokenStatus,
  handleAccountCheckingForThisDevice,
} from './src/localDbQueries/accounts';
import FilesAndMediaReadAndWritePermissionNeeded from './src/screens/FilesAndMediaReadAndWritePermissionNeeded';
import {
  removeLicenseToken,
  saveLicenseToken,
  removeLicenseKey,
  saveLicenseKey,
} from './src/test/license';
import {
  createDefaultRoles,
  deleteDefaultRoles,
} from './src/localDbQueries/roles';
import {getLicenseStatus} from './src/localDbQueries/license';
import {
  deleteAllBatchPurchaseGroupsAndEntries,
  deleteUnconfirmedBatchPurchaseGroupsAndEntries,
} from './src/localDbQueries/batchPurchase';
import {createNewOrGetDeviceImplantedUniqueId} from './src/constants/deviceImplantedUniqueIdConfig';

const App = () => {
  const [
    authState,
    {signOut},
    {expiredAuthTokenDialogVisible},
    {setExpiredAuthTokenDialogVisible},
  ] = useAuthContext();
  const [
    needStorageReadAndWritePermissionScreenVisible,
    setNeedStorageReadAndWritePermissionScreebVisible,
  ] = useState(false);
  const [
    needStorageManagementPermissionScreenVisible,
    setNeedStorageManagementPermissionScreenVisible,
  ] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const appState = useRef(AppState.currentState);

  const {
    isRefetching: isRefetchingAuthTokenStatus,
    status: authTokenStatus,
    data: authTokenData,
    refetch: refetchAuthTokenStatus,
  } = useQuery(['authTokenStatus'], getAuthTokenStatus);

  const {
    status: getLicenseStatusReqStatus,
    data: getLicenseStatusReqData,
    refetch: refetchLicenseKeyStatus,
    error,
  } = useQuery(['licenseKeyStatus', {}], getLicenseStatus);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // app has come to the foreground
        refetchAuthTokenStatus();
        refetchLicenseKeyStatus();
      } else {
        // on the background
        refetchAuthTokenStatus();
        refetchLicenseKeyStatus();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    refetchAuthTokenStatus();
    refetchLicenseKeyStatus();
  }, [appVersion]);

  useEffect(() => {
    if (authTokenData) {
      const {isAuthTokenExpired, authToken} = authTokenData.result;

      if (
        authTokenStatus !== 'loading' &&
        !isRefetchingAuthTokenStatus &&
        authToken && // do not run if authToken was already deleted
        isAuthTokenExpired
      ) {
        setExpiredAuthTokenDialogVisible(() => true);
      }
    }
  }, [authTokenStatus, authTokenData]);

  async function initializeAppSegment1() {
    try {
      /**
       * RESET (for dev purpose only)
       */

      // Delete all app data tables
      // await deleteTable('categories');
      // await deleteTable('taxes');
      // await deleteTable('vendors');
      // await deleteTable('vendor_contact_persons');
      // await deleteTable('items');
      // await deleteTable('batch_purchase_groups');
      // await deleteTable('batch_purchase_entries');
      // await deleteTable('batch_stock_usage_groups');
      // await deleteTable('batch_stock_usage_entries');
      // await deleteTable('inventory_logs');
      // await deleteTable('operations');
      // await deleteTable('recipeKinds');
      // await deleteTable('recipes');
      // await deleteTable('ingredients');
      // await deleteTable('revenue_groups');
      // await deleteTable('revenues');
      // await deleteTable('expense_groups');
      // await deleteTable('monthly_expenses');
      // await deleteTable('expenses');
      // await deleteTable('revenue_deductions');
      // await deleteTable('revenue_categories');
      // await deleteTable('spoilages');
      // await deleteTable('modifiers');
      // await deleteTable('modifier_options');
      // await deleteTable('saved_printers');

      /**
       * Uncomment code below to simulate new installed app
       */

      // await deleteTable('app_versions');

      // await AsyncStorage.removeItem(
      //   `hasDefaultRoles${appStorageKeySeperator}${appVersion}`,
      // );
      // await AsyncStorage.removeItem(
      //   `hasDefaultInventoryOperations${appStorageKeySeperator}${appVersion}`,
      // );
      // await AsyncStorage.removeItem(
      //   `hasDefaultTaxes${appStorageKeySeperator}${appVersion}`,
      // );
      // await AsyncStorage.removeItem(
      //   `hasDefaultUnits${appStorageKeySeperator}${appVersion}`,
      // );
      // await AsyncStorage.removeItem(`units`);
      // await AsyncStorage.removeItem(`currentBatchPurchaseGroupId`);
      // await AsyncStorage.removeItem(`currentRecipeId`);

      // await deleteTable('roles', true);
      // await deleteTable('accounts', true);
      // await deleteTable('companies', true);
      // await deleteTable('settings', true);

      // await AsyncStorage.removeItem('isLocalAccountSetupCompleted');
      // await AsyncStorage.removeItem(
      //   `hasDefaultSettings${appStorageKeySeperator}${appVersion}`,
      // );

      /**
       * Create tables
       */
      await createLocalAccountTables();
      await createTables();

      /**
       * Alter tables
       */
      await alterTables(appVersion);

      /**
       * Save latest app version to db
       */
      await handleNewAppVersion({
        onNewVersionDetected: async currentAppVersion => {
          /**
           * Remove previous app version defaults (and previous version storage keys)
           */
          try {
            const appAsyncStorageKeys = await AsyncStorage.getAllKeys();
            const previousAppVersionKeys = appAsyncStorageKeys.filter(key => {
              const keyAndVersion = key.split(appStorageKeySeperator);

              /**
               * Return if length is 2, it means it the value has key and version
               */
              if (keyAndVersion.length === 2) {
                return true;
              } else {
                return false;
              }

              /**
               * Return all even without version
               */
              // const version = keyAndVersion.pop();
              // return version !== currentAppVersion;
            });

            await AsyncStorage.multiRemove(previousAppVersionKeys);

            console.info(
              'AsyncStorage all keys after multi-remove call: ',
              await AsyncStorage.getAllKeys(),
            );

            /**
             * Delete old version existing defaults
             */
            /**
             * TODO: To improve this, implement something like
             * createAppDefaultsIfNotExist function instead of
             * deleting and recreating app defaults on new/different
             * version detected. Or implement something like app
             * defaults manifest file of a specific version. Or
             * delete keys with version only after delettion of defaults
             */
            await deleteDefaultRoles();
            await deleteAllSettings();
            await deleteDefaultOperations();
            await deleteDefaultTaxes();
            await deleteAllUnits();
          } catch (error) {
            console.debug(error);
            throw error;
          }
        },
      });

      /**
       * Initialize new app version defaults
       */
      await createDefaultRoles(appVersion);
      await createDefaultSettings(appVersion);
      await createDefaultInventoryOperations(appVersion);
      await createDefaultTaxes(appVersion);
      await setDefaultUnits(appVersion);
    } catch (error) {
      console.debug(error);
    }
  }

  async function checkRequiredPermissions(onGranted) {
    const androidVersion = Platform.constants['Release'];
    const sdkVersion = Platform.Version;

    console.info('Android Version: ', androidVersion);
    console.info('SDK Version: ', sdkVersion);

    // for android 11 or higher
    if (sdkVersion >= 30) {
      await ManageExternalStorage.checkPermission(
        err => {
          if (err) {
            console.debug(err);
          }
        },
        isGranted => {
          if (!isGranted) {
            setNeedStorageManagementPermissionScreenVisible(() => true);
            onGranted && onGranted();
          }
        },
      );
    } else {
      // Check if write permission is already given or not
      let isWriteExternalStoragePermitted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );

      if (!isWriteExternalStoragePermitted) {
        // Then prompt user and ask for permission
        const requestResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage permission needed',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        if (requestResult === PermissionsAndroid.RESULTS.GRANTED) {
          // Permission granted
          console.log('Write External Storage Permission granted.');
        } else {
          // Permission denied
          console.log('Write External Storage Permission denied');

          setNeedStorageReadAndWritePermissionScreebVisible(() => true);
        }
      } else {
        // Already have Permission
      }
    }
  }

  async function initializeAppSegment2(callback) {
    try {
      /**
       * Local account checking
       */
      try {
        await handleAccountCheckingForThisDevice();
      } catch (error) {
        if (error.code === 'ENOENT') {
          // should prompt user to enable all files management permission
          setNeedStorageManagementPermissionScreenVisible(true);
        }

        throw error;
      }

      /**
       * Device Implanted Unique Identifier
       */
      const diuid = await createNewOrGetDeviceImplantedUniqueId();
      console.info('DIUID (Device Implanted Unique ID): ', diuid);

      /**
       * Place other initialization here
       */

      /**
       * Test license key and token
       */
      // await saveLicenseToken();
      // await removeLicenseToken();

      // await saveLicenseKey();
      // await removeLicenseKey();
    } catch (error) {
      console.debug(error);
    } finally {
      callback && callback();
    }
  }

  const enableFileLogger = async () => {
    try {
      /**
       * Enable file logger for debugging
       */

      /**
       * Create log files directory on the device if NOT exist
       */
      const logFilesDirectoryPath = `${RNFS.ExternalStorageDirectoryPath}/__log_files`;
      const localAccountConfigDirectoryExists = await RNFS.exists(
        logFilesDirectoryPath,
      );

      if (!localAccountConfigDirectoryExists) {
        await RNFS.mkdir(logFilesDirectoryPath);
      }

      FileLogger.configure({logsDirectory: logFilesDirectoryPath});
    } catch (error) {
      console.debug(error);
    }
  };

  useEffect(() => {
    setIsInitializing(() => true);

    checkRequiredPermissions();

    // enableFileLogger();

    initializeAppSegment1();

    initializeAppSegment2(() => {
      setIsInitializing(() => false);
      // FileLogger.disableConsoleCapture();
    }); // this segment requires permission
  }, []);

  useEffect(() => {}, []);

  const renderContent = () => {
    if (needStorageManagementPermissionScreenVisible) {
      return <FilesAndMediaManagementPermissionNeeded />;
    }

    if (needStorageReadAndWritePermissionScreenVisible) {
      return <FilesAndMediaReadAndWritePermissionNeeded />;
    }

    if (isCheckingPermission || isInitializing) {
      return <Splash />;
    }

    if (!authState.authToken || !authState.authUser) {
      return <AuthStack />;
    } else {
      return <RootStack />;
    }
  };

  return (
    <>
      <Portal>
        <Dialog
          visible={expiredAuthTokenDialogVisible}
          onDismiss={async () => {
            signOut();
            setExpiredAuthTokenDialogVisible(() => false);
          }}>
          <Dialog.Title>Session expired!</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {
                'Your authentication session has been expired, you must login again to continue.'
              }
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={async () => {
                signOut();
                setExpiredAuthTokenDialogVisible(() => false);
              }}>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {renderContent()}
    </>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default withAccountSetupContextProvider(withAuthContextProvider(App));
