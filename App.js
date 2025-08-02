import React from 'react';

import useAppLifecycle from './src/hooks/useAppLifecycle';
import useAppInitialization from './src/hooks/useAppInitialization';
import usePermissions from './src/hooks/usePermissions';
import useExpiredAuthDialog from './src/hooks/useExpiredAuthDialog';

import FilesAndMediaManagementPermissionNeeded from './src/screens/FilesAndMediaManagementPermissionNeeded';
import FilesAndMediaReadAndWritePermissionNeeded from './src/screens/FilesAndMediaReadAndWritePermissionNeeded';
import Splash from './src/screens/Splash';
import AuthStack from './src/stacks/AuthStack';
import RootStack from './src/stacks/RootStack';

import withAccountSetupContextProvider from './src/hoc/withAccountSetupContextProvider';
import withAuthContextProvider from './src/hoc/withAuthContextProvider';
import useAuthContext from './src/hooks/useAuthContext';

const App = () => {
  const [authState] = useAuthContext();
  const {
    isCheckingPermission,
    needStorageReadAndWritePermissionScreenVisible,
    needStorageManagementPermissionScreenVisible,
  } = usePermissions({enabled: false});

  const {isInitializing} = useAppInitialization();
  useAppLifecycle(); // handles app state change + refetch

  const {ExpiredAuthDialog} = useExpiredAuthDialog();

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
    }

    return <RootStack />;
  };

  return (
    <>
      <ExpiredAuthDialog />
      {renderContent()}
    </>
  );
};

export default withAccountSetupContextProvider(withAuthContextProvider(App));
