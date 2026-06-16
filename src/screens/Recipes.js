import React, {useEffect} from 'react';
import {View} from 'react-native';
import {Button, Searchbar, useTheme} from 'react-native-paper';

import routes from '../constants/routes';
import useSearchbarContext from '../hooks/useSearchbarContext';
import RecipeList from '../components/recipes/RecipeList';
import RecipeReportFileExport from '../components/reports/RecipeReportFileExport';
import PermissionGate from '../components/permissions/PermissionGate';

export const ServingRecipes = props => {
  const {navigation} = props;
  const {colors} = useTheme();
  const {keyword, setKeyword} = useSearchbarContext();

  const onChangeSearch = keyword => setKeyword(keyword);

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const handlePressCreate = () => {
    navigation.navigate(routes.createRecipe());
  };

  return (
    <View style={{flex: 1}}>
      <View style={{flexDirection: 'row', padding: 5}}>
        <Searchbar
          placeholder="Search recipe"
          onChangeText={onChangeSearch}
          value={keyword}
          style={{flex: 1}}
        />
      </View>

      <View style={{flex: 1, backgroundColor: colors.surface}}>
        <RecipeList
          filter={{'%LIKE': {key: 'name', value: `'%${keyword}%'`}}}
        />
      </View>

      <PermissionGate permission="recipes.create">
        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button mode="contained" icon="plus" onPress={handlePressCreate}>
            Create Recipe
          </Button>
        </View>
      </PermissionGate>
      <RecipeReportFileExport />
    </View>
  );
};

export default ServingRecipes;
