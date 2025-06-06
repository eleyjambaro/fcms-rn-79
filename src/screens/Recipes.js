import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, Pressable, View, ToastAndroid} from 'react-native';
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

import routes from '../constants/routes';
import UnitList from '../components/units/UnitList';
import useSearchbarContext from '../hooks/useSearchbarContext';
import RecipeList from '../components/recipes/RecipeList';
import SubRecipeList from '../components/recipes/SubRecipeList';
import RecipeReportFileExport from '../components/reports/RecipeReportFileExport';

const TopTab = createMaterialTopTabNavigator();

function SubRecipes(props) {
  const {navigation} = props;
  const [searchQuery, setSearchQuery] = useState('');
  const [createUOMModalVisible, setCreateUOMModalVisible] = useState(false);
  const {colors} = useTheme();

  const onChangeSearch = query => setSearchQuery(query);

  const handlePressCreate = () => {
    ToastAndroid.showWithGravityAndOffset(
      'Create Sub Recipe feature is coming soon',
      ToastAndroid.SHORT,
      ToastAndroid.BOTTOM,
      0,
      200,
    );
    return;
    navigation.navigate(routes.createSubRecipe());
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createUOMModalVisible}
          onDismiss={() => setCreateUOMModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create New Unit of Measurement
          </Title>
          <TextInput label="Name of Measurement (e.g. Kilogram)" />
          <TextInput label="Measurement abbreviation (e.g. kg)" />
          <Button
            mode="contained"
            onPress={() => setCreateUOMModalVisible(() => false)}
            style={{marginTop: 20}}>
            Create
          </Button>
          <Button
            onPress={() => setCreateUOMModalVisible(() => false)}
            style={{marginTop: 10}}>
            Cancel
          </Button>
        </Modal>
      </Portal>
      <View style={{flex: 1}}>
        <View style={{flexDirection: 'row', padding: 5}}>
          <Searchbar
            placeholder="Search sub recipe"
            onChangeText={onChangeSearch}
            value={searchQuery}
            style={{flex: 1}}
          />
        </View>

        <View style={{flex: 1}}>
          <SubRecipeList />
        </View>

        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button mode="contained" icon="plus" onPress={handlePressCreate}>
            Create Sub Recipe
          </Button>
        </View>
      </View>
    </>
  );
}

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

      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button mode="contained" icon="plus" onPress={handlePressCreate}>
          Create Recipe
        </Button>
      </View>
      <RecipeReportFileExport
      // filter={listFilters}
      // dateFilter={startDatetimeString}
      // selectedDateFilter={selectedDateFilter}
      // selectedMonthYearDateFilter={selectedMonthYearDateFilter}
      // exactDateFilter={exactDateFilter}
      />
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

const RecipesTab = () => {
  const {colors} = useTheme();

  return (
    <TopTab.Navigator
      screenOptions={() => ({
        tabBarStyle: {
          elevation: 0,
          borderBottomWidth: 2,
          borderColor: colors.neutralTint5,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.dark,
        tabBarPressColor: colors.primary,
        tabBarIndicatorStyle: {
          backgroundColor: colors.primary,
          height: 3,
        },
        tabBarLabelStyle: {
          textTransform: 'none',
        },
      })}>
      <TopTab.Screen
        name="ServingRecipes"
        options={{tabBarLabel: 'Serving Recipes'}}
        component={ServingRecipes}
      />
      <TopTab.Screen
        name="SubRecipes"
        component={SubRecipes}
        options={{tabBarLabel: 'Sub Recipes'}}
      />
    </TopTab.Navigator>
  );
};

export default RecipesTab;
