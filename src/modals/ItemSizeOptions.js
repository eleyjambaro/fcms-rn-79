import React from 'react';
import {useRoute} from '@react-navigation/native';
import {StyleSheet, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';

import ItemStockSummary from '../components/items/ItemStockSummary';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {getItem} from '../localDbQueries/items';
import ItemSizeOptionList from '../components/sizeOptions/ItemSizeOptionList';

const ItemSizeOptions = _props => {
  const route = useRoute();
  const itemId = route.params?.item_id;
  const {status, data} = useQuery(['item', {id: itemId}], getItem);
  const item = data?.result;

  if (!itemId) return null;

  if (status === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  if (!item) return null;

  return (
    <View style={styles.container}>
      {item && (
        <ItemStockSummary
          item={item}
          containerStyle={{marginBottom: 9}}
          showStockDetails={false}
          showItemOptionsButton={false}
        />
      )}
      <ItemSizeOptionList itemId={itemId} item={item} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default ItemSizeOptions;
