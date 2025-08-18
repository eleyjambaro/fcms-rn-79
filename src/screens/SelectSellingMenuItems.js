import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, Pressable, View} from 'react-native';
import {
  FAB,
  Button,
  Modal,
  Title,
  TextInput,
  Portal,
  Searchbar,
  useTheme,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import {useQuery} from '@tanstack/react-query';

import routes from '../constants/routes';
import {getCategories} from '../localDbQueries/categories';
import useSearchbarContext from '../hooks/useSearchbarContext';
import SellingMenuItemSelectionList from '../components/sellingMenus/SellingMenuItemSelectionList';
import FiltersList from '../components/buttons/FiltersList';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';

const SelectSellingMenuItems = props => {
  const {navigation, route} = props;
  const sellingMenuId = route.params?.selling_menu_id;
  const {colors} = useTheme();
  const {keyword, setKeyword} = useSearchbarContext();
  const {status: categoriesStatus, data: categoriesData} = useQuery(
    ['categories', {limit: 100}],
    getCategories,
  );
  const [itemListFilters, setItemListFilters] = useState({
    'items.category_id': '',
    'operations.id': '',
    '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
  });
  const [currentCategory, setCurrentCategory] = useState('');

  const onChangeSearch = keyword => {
    setKeyword(keyword);

    setItemListFilters(currentValues => {
      return {
        ...currentValues,
        '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
      };
    });
  };

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const handleCategoryFilterChange = (categoryId, categoryLabel) => {
    setItemListFilters(currentValues => {
      return {
        ...currentValues,
        'items.category_id': categoryId,
      };
    });

    setCurrentCategory(() => categoryLabel);
  };

  if (categoriesStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (categoriesStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const categories = categoriesData.result;

  if (!categories) return null;

  const categoryFilterSelections = categories.map(category => {
    return {
      label: category.name,
      value: category.id,
    };
  });

  categoryFilterSelections.unshift({
    label: 'All',
    value: '',
  });

  return (
    <View style={{flex: 1}}>
      <View style={{flexDirection: 'row', padding: 5}}>
        <Searchbar
          placeholder="Search"
          onChangeText={onChangeSearch}
          value={keyword}
          style={{flex: 1}}
        />
      </View>

      <View>
        <FiltersList
          filters={categoryFilterSelections}
          value={itemListFilters['items.category_id']}
          onChange={handleCategoryFilterChange}
          containerStyle={{marginTop: 5, marginBottom: 8}}
        />
      </View>

      <View style={{flex: 1}}>
        <SellingMenuItemSelectionList
          sellingMenuId={sellingMenuId}
          filter={itemListFilters}
          currentCategory={currentCategory}
        />
      </View>

      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button
          mode="contained"
          onPress={() => {
            navigation.goBack();
          }}>
          Done
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default SelectSellingMenuItems;
