import React, {useState} from 'react';

import useAppLifecycle from './src/hooks/useAppLifecycle';
import useAppInitialization from './src/hooks/useAppInitialization';
import usePermissions from './src/hooks/usePermissions';
import useExpiredAuthDialog from './src/hooks/useExpiredAuthDialog';
import {useVersionCheck} from './src/hooks/useVersionCheck';
import UpdatePromptModal from './src/components/modals/UpdatePromptModal';

import FilesAndMediaManagementPermissionNeeded from './src/screens/FilesAndMediaManagementPermissionNeeded';
import FilesAndMediaReadAndWritePermissionNeeded from './src/screens/FilesAndMediaReadAndWritePermissionNeeded';
import Splash from './src/screens/Splash';
import AuthStack from './src/stacks/AuthStack';
import RootStack from './src/stacks/RootStack';
import ReinstallDetectedStack from './src/stacks/ReinstallDetectedStack';

import withAccountSetupContextProvider from './src/hoc/withAccountSetupContextProvider';
import useAuthContext from './src/hooks/useAuthContext';

const App = () => {
  const [authState] = useAuthContext();
  const {
    isCheckingPermission,
    needStorageReadAndWritePermissionScreenVisible,
    needStorageManagementPermissionScreenVisible,
  } = usePermissions({enabled: false});

  const [reinstallDetectedStackVisible, setReinstallDetectedStackVisible] =
    useState(false);

  const {ExpiredAuthDialog} = useExpiredAuthDialog();

  const {isInitializing} = useAppInitialization({
    onAppPreviouslyInstalledDetected: () => {
      setReinstallDetectedStackVisible(() => true);
    },
  });

  useAppLifecycle(); // handles app state change + refetch

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

    if (reinstallDetectedStackVisible) {
      return <ReinstallDetectedStack />;
    }

    if (!authState.authToken || !authState.authUser) {
      return <AuthStack />;
    }

    return <RootStack />;
  };

  const {
    showUpdateModal,
    hideUpdateModal,
    isForceUpdate,
    currentVersion,
    latestVersion,
    storeUrl,
  } = useVersionCheck();

  return (
    <>
      <ExpiredAuthDialog />
      <UpdatePromptModal
        visible={showUpdateModal}
        onDismiss={hideUpdateModal}
        isForceUpdate={isForceUpdate}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
        storeUrl={storeUrl}
      />
      {renderContent()}
    </>
  );
};

export default withAccountSetupContextProvider(App);
