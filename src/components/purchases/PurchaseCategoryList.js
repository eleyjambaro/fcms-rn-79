import React from 'react';
import {StyleSheet, Text, View, FlatList, Pressable} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Button, useTheme} from 'react-native-paper';

import {categories} from '../../__dummyData';
import PurchaseCategoryListItem from './PurchaseCategoryListItem';
import routes from '../../constants/routes';

const PurchaseCategoryList = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();

  const renderItem = ({item}) => {
    return (
      <Pressable
        onPress={() => {
          navigation.navigate(routes.purchaseCategoryView(), {
            category_id: item.id,
          });
        }}>
        <PurchaseCategoryListItem item={item} />
      </Pressable>
    );
  };

  return (
    <FlatList
      style={{backgroundColor: colors.surface}}
      data={categories}
      keyExtractor={item => item.name}
      renderItem={renderItem}
    />
  );
};

const styles = StyleSheet.create({});

export default PurchaseCategoryList;
