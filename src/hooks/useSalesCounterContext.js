import {useContext} from 'react';

import {SalesCounterContext} from '../context/types';

const useSalesCounterContext = () => {
  return useContext(SalesCounterContext);
};

export default useSalesCounterContext;
