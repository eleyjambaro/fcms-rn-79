import React, {useState} from 'react';

import {SellingMenuFormContext} from '../types';

const SellingMenuFormContextProvider = props => {
  const {children} = props;
  const [formikActions, setFormikActions] = useState({});

  return (
    <SellingMenuFormContext.Provider
      value={{
        formikActions,
        setFormikActions,
      }}>
      {children}
    </SellingMenuFormContext.Provider>
  );
};

export default SellingMenuFormContextProvider;
