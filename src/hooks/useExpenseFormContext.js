import {useContext} from 'react';

import {ExpenseFormContext} from '../context/types';

const useExpenseFormContext = () => {
  return useContext(ExpenseFormContext);
};

export default useExpenseFormContext;
