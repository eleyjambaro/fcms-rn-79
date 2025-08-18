import React, {useState} from 'react';

import {AddedSellingMenuItemsContext} from '../types';

const AddedSellingMenuItemsContextProvider = props => {
  const {children} = props;
  const [addedSellingMenuItems, setAddedSellingMenuItems] = useState([]);
  const [addedSellingMenuItemIds, setAddedSellingMenuItemIds] = useState([]);

  const resetSellingMenuItems = () => {
    setAddedSellingMenuItems(() => []);
  };

  const resetSellingMenuIds = () => {
    setAddedSellingMenuItemIds(() => []);
  };

  const resetData = () => {
    resetSellingMenuItems();
    resetSellingMenuIds();
  };

  return (
    <AddedSellingMenuItemsContext.Provider
      value={{
        addedSellingMenuItems,
        addedSellingMenuItemIds,
        setAddedSellingMenuItems,
        setAddedSellingMenuItemIds,
        resetData,
      }}>
      {children}
    </AddedSellingMenuItemsContext.Provider>
  );
};

export default AddedSellingMenuItemsContextProvider;
