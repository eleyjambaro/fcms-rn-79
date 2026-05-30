import React from 'react';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import CloudAccountAuthTab from './CloudAccountAuthTab';
import CloudAccountRootTab from './CloudAccountRootTab';

const CloudAccountMainTab = () => {
  const [authState] = useCloudAuthContext();

  // In FCMS Cloud v2 this tab is only ever mounted inside RootStack, which
  // App.js already gates on a fully authenticated session — so we key the
  // rendered tab off the v2 auth state directly.
  //
  // The legacy `useQuery(['loggedInUser'])` + `restoreAuth` effect that used to
  // live here were V1 local-auth remnants: `restoreAuth` doesn't exist on the
  // v2 auth context, and the query's `queryClient.clear()`-triggered refetch
  // (clear() is called by `signOut`) fought the sign-out flow — which is why
  // the Logout button needed to be pressed twice.
  if (!authState.authToken || !authState.authUser) {
    return <CloudAccountAuthTab />;
  }

  return <CloudAccountRootTab />;
};

export default CloudAccountMainTab;
