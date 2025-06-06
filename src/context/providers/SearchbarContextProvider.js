import React, {useState} from 'react';

import {SearchbarContext} from '../types';

const SearhbarContextProvider = props => {
  const {children} = props;
  const [keyword, setKeyword] = useState('');

  return (
    <SearchbarContext.Provider
      value={{
        keyword,
        setKeyword,
      }}>
      {children}
    </SearchbarContext.Provider>
  );
};

export default SearhbarContextProvider;
