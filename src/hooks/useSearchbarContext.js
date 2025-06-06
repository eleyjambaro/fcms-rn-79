import {useContext} from 'react';

import {SearchbarContext} from '../context/types';

const useSearchbarContext = () => {
  return useContext(SearchbarContext);
};

export default useSearchbarContext;
