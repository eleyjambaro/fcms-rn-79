import {useContext} from 'react';

import {AuthContext} from '../context/types';

const useAuthContext = () => {
  return useContext(AuthContext);
};

export default useAuthContext;
