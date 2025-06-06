import React, {useState} from 'react';

import {AppConfigContext} from '../types';
import {defaultAppConfig} from '../../constants/appConfig';

const AppConfigContextProvider = props => {
  const {children} = props;
  const [appConfig, setAppConfig] = useState(defaultAppConfig);

  return (
    <AppConfigContext.Provider
      value={{
        appConfig,
        setAppConfig,
      }}>
      {children}
    </AppConfigContext.Provider>
  );
};

export default AppConfigContextProvider;
