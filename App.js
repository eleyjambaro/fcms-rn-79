import React from 'react';

import useAppLifecycle from './src/hooks/useAppLifecycle';
import useAppInitialization from './src/hooks/useAppInitialization';
import usePermissions from './src/hooks/usePermissions';
import useExpiredAuthDialog from './src/hooks/useExpiredAuthDialog';
import useCloudExpiredAuthDialog from './src/hooks/useCloudExpiredAuthDialog';
import {useVersionCheck} from './src/hooks/useVersionCheck';
import UpdatePromptModal from './src/components/modals/UpdatePromptModal';

import FilesAndMediaManagementPermissionNeeded from './src/screens/FilesAndMediaManagementPermissionNeeded';
import FilesAndMediaReadAndWritePermissionNeeded from './src/screens/FilesAndMediaReadAndWritePermissionNeeded';
import Splash from './src/screens/Splash';
import RootStack from './src/stacks/RootStack';
import CloudAuthStackV2 from './src/stacks/CloudAuthStackV2';

import withAccountSetupContextProvider from './src/hoc/withAccountSetupContextProvider';
import useCloudAuthContext from './src/hooks/useCloudAuthContext';

const App = () => {
  const [cloudAuthState] = useCloudAuthContext();
  const {
    isCheckingPermission,
    needStorageReadAndWritePermissionScreenVisible,
    needStorageManagementPermissionScreenVisible,
  } = usePermissions({enabled: false});

  const {ExpiredAuthDialog} = useExpiredAuthDialog();
  const {CloudExpiredAuthDialog} = useCloudExpiredAuthDialog();

  const {isInitializing} = useAppInitialization();

  useAppLifecycle();

  const {
    showUpdateModal,
    hideUpdateModal,
    isForceUpdate,
    currentVersion,
    latestVersion,
    storeUrl,
  } = useVersionCheck();

  const renderContent = () => {
    if (needStorageManagementPermissionScreenVisible) {
      return <FilesAndMediaManagementPermissionNeeded />;
    }

    if (needStorageReadAndWritePermissionScreenVisible) {
      return <FilesAndMediaReadAndWritePermissionNeeded />;
    }

    // Wait for permissions, app init, AND cloud auth restore to finish.
    // Also hold on Splash while a branch switch is in progress so we don't
    // briefly render the empty new-branch DB before its initial pull lands.
    if (
      isCheckingPermission ||
      isInitializing ||
      cloudAuthState.isLoading ||
      cloudAuthState.isSwitchingBranch
    ) {
      return <Splash />;
    }

    const isCloudAuthenticated = !!(
      cloudAuthState.authToken && cloudAuthState.authUser
    );
    const hasDevice = !!(
      cloudAuthState.deviceId && cloudAuthState.deviceToken
    );
    const hasBranch = !!cloudAuthState.designatedBranch;

    // Not fully set up → cloud auth / onboarding flow
    if (!isCloudAuthenticated || !hasDevice || !hasBranch) {
      return <CloudAuthStackV2 />;
    }

    return <RootStack />;
  };

  return (
    <>
      <ExpiredAuthDialog />
      <CloudExpiredAuthDialog />
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
