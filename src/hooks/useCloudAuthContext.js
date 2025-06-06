import {useContext} from 'react';

import {CloudAuthContext} from '../context/types';

const useCloudAuthContext = () => {
  return useContext(CloudAuthContext);
};

export default useCloudAuthContext;
