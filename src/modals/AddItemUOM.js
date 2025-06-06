import React from 'react';
import {StyleSheet, View} from 'react-native';

import ItemUOMList from '../components/items/ItemUOMList';

const AddItemUOM = () => {
  return (
    <View style={styles.container}>
      <ItemUOMList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AddItemUOM;
