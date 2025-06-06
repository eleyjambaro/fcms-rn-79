import React from 'react';
import {StyleSheet, Text, View, FlatList, Pressable} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Button, useTheme} from 'react-native-paper';

import {units} from '../../__dummyData';
import UnitListItem from './UnitListItem';
import routes from '../../constants/routes';

const UnitList = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();

  const renderItem = ({item}) => {
    return (
      <Pressable onPress={() => {}}>
        <UnitListItem item={item} />
      </Pressable>
    );
  };

  return (
    <FlatList
      style={{backgroundColor: colors.surface}}
      data={units}
      keyExtractor={item => item.name}
      renderItem={renderItem}
    />
  );
};

const styles = StyleSheet.create({});

export default UnitList;
