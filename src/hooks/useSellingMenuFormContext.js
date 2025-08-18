import {useContext} from 'react';

import {SellingMenuFormContext} from '../context/types';

const useSellingMenuFormContext = () => {
  return useContext(SellingMenuFormContext);
};

export default useSellingMenuFormContext;
