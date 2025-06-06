import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import routes from '../constants/routes';

const Inventory = props => {
  const {navigation} = props;

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text>Inventory</Text>
    </View>
  );
};

const styles = StyleSheet.create({});

export default Inventory;
