import React from 'react';

import AccountSetupContextProvider from '../context/providers/AccountSetupContextProvider';

const withAccountSetupContextProvider = WrappedComponent => {
  return function (props) {
    return (
      <AccountSetupContextProvider>
        <WrappedComponent {...props} />
      </AccountSetupContextProvider>
    );
  };
};

export default withAccountSetupContextProvider;
