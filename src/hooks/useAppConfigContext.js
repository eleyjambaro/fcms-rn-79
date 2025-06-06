import {useContext} from 'react';

import {AppConfigContext} from '../context/types';

const useAppConfigContext = () => {
  return useContext(AppConfigContext);
};

export default useAppConfigContext;
