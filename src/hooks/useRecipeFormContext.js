import {useContext} from 'react';

import {RecipeFormContext} from '../context/types';

const useRecipeFormContext = () => {
  return useContext(RecipeFormContext);
};

export default useRecipeFormContext;
