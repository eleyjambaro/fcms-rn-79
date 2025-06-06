import React, {useEffect} from 'react';
import {Pressable, ToastAndroid, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';

import routes from '../constants/routes';
import useCloudAuthContext from '../hooks/useCloudAuthContext';
import CloudAccountAuthTab from './CloudAccountAuthTab';
import CloudAccountRootTab from './CloudAccountRootTab';
import {getLoggedInUser} from '../serverDbQueries/auth';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';

const CloudAccountMainTab = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const {
    isRefetching: isRefetchingLoggedInUser,
    status: loggedInUserStatus,
    data: loggedInUserData,
    error: loggedInUserError,
    refetch: refetchLoggedInUser,
  } = useQuery(['loggedInUser'], getLoggedInUser);
  const [
    authState,
    {signOut, restoreAuth},
    {expiredAuthTokenDialogVisible},
    {setExpiredAuthTokenDialogVisible},
  ] = useCloudAuthContext();

  useEffect(() => {
    if (
      loggedInUserStatus !== 'loading' &&
      !isRefetchingLoggedInUser &&
      loggedInUserData
    ) {
      const authUser = loggedInUserData?.authUser;
      const authToken = loggedInUserData?.authToken;

      restoreAuth({authUser, authToken});
    }
  }, [loggedInUserStatus, loggedInUserData, isRefetchingLoggedInUser]);

  if (loggedInUserStatus === 'loading' || isRefetchingLoggedInUser) {
    return (
      <DefaultLoadingScreen
        containerStyle={{backgroundColor: colors.surface}}
      />
    );
  }

  const renderCloudAccountTab = () => {
    if (
      !authState.authToken ||
      !authState.authUser ||
      loggedInUserStatus === 'error'
    ) {
      return <CloudAccountAuthTab />;
    } else {
      return <CloudAccountRootTab />;
    }
  };

  return <>{renderCloudAccountTab()}</>;
};

export default CloudAccountMainTab;
