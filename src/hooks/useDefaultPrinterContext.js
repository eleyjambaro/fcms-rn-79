import {useContext} from 'react';

import {DefaultPrinterContext} from '../context/types';

const useDefaultPrinterContext = () => {
  return useContext(DefaultPrinterContext);
};

export default useDefaultPrinterContext;
