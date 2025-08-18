import {useContext} from 'react';

import {AddedSellingMenuItemsContext} from '../context/types';

const useAddedSellingMenuItemsContext = () => {
  return useContext(AddedSellingMenuItemsContext);
};

export default useAddedSellingMenuItemsContext;
