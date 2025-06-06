import React, {useState} from 'react';

import {ItemFormContext} from '../types';

const ItemFormContextProvider = props => {
  const {children} = props;
  const [formikActions, setFormikActions] = useState({});

  return (
    <ItemFormContext.Provider
      value={{
        formikActions,
        setFormikActions,
      }}>
      {children}
    </ItemFormContext.Provider>
  );
};

export default ItemFormContextProvider;
