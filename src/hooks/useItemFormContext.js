import {useContext} from 'react';

import {ItemFormContext} from '../context/types';

const useItemFormContext = () => {
  return useContext(ItemFormContext);
};

export default useItemFormContext;
