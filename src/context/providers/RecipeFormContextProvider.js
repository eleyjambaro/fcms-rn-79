import React, {useState} from 'react';

import {RecipeFormContext} from '../types';

const RecipeFormContextProvider = props => {
  const {children} = props;
  const [formikActions, setFormikActions] = useState({});

  return (
    <RecipeFormContext.Provider
      value={{
        formikActions,
        setFormikActions,
      }}>
      {children}
    </RecipeFormContext.Provider>
  );
};

export default RecipeFormContextProvider;
