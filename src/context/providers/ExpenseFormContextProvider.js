import React, {useState} from 'react';

import {ExpenseFormContext} from '../types';

const ExpenseFormContextProvider = props => {
  const {children} = props;
  const [formikActions, setFormikActions] = useState({});

  return (
    <ExpenseFormContext.Provider
      value={{
        formikActions,
        setFormikActions,
      }}>
      {children}
    </ExpenseFormContext.Provider>
  );
};

export default ExpenseFormContextProvider;
