import {useContext} from 'react';

import {AddedIngredientsContext} from '../context/types';

const useAddedIngredientsContext = () => {
  return useContext(AddedIngredientsContext);
};

export default useAddedIngredientsContext;
