import {useContext} from 'react';

import {AccountSetupContext} from '../context/types';

const useAuthContext = () => {
  return useContext(AccountSetupContext);
};

export default useAuthContext;
