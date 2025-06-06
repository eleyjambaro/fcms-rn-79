import React, {useState} from 'react';

import {AddedIngredientsContext} from '../types';

const AddedIngredientsContextProvider = props => {
  const {children} = props;
  const [addedIngredients, setAddedIngredients] = useState([]);
  const [addedIngredientIds, setAddedIngredientIds] = useState([]);

  const resetIngredients = () => {
    setAddedIngredients(() => []);
  };

  const resetIngredientIds = () => {
    setAddedIngredientIds(() => []);
  };

  const resetData = () => {
    resetIngredients();
    resetIngredientIds();
  };

  return (
    <AddedIngredientsContext.Provider
      value={{
        addedIngredients,
        addedIngredientIds,
        setAddedIngredients,
        setAddedIngredientIds,
        resetData,
      }}>
      {children}
    </AddedIngredientsContext.Provider>
  );
};

export default AddedIngredientsContextProvider;
