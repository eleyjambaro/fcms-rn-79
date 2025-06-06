import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, useTheme, Divider} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';

import ItemForm from '../components/forms/ItemForm';
import routes from '../constants/routes';
import {updateItem, getItem} from '../localDbQueries/items';
import {getRecipe, updateRecipe} from '../localDbQueries/recipes';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import RecipeForm from '../components/forms/RecipeForm';

const EditRecipe = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const recipeId = route.params?.recipe_id;
  const queryClient = useQueryClient();
  const {status, data} = useQuery(['recipe', {id: recipeId}], getRecipe, {
    enabled: recipeId ? true : false,
  });
  const updateRecipeMutation = useMutation(updateRecipe, {
    onSuccess: () => {
      queryClient.invalidateQueries('recipes');
    },
  });

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await updateRecipeMutation.mutateAsync({
        id: recipeId,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      navigation.goBack();
    }
  };

  if (!recipeId) return null;

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

  const recipe = data.result;

  if (!recipe) return null;

  const initialValues = {
    group_name: recipe.group_name || '',
    name: recipe.name || '',
    yield: recipe.yield?.toString() || '',
  };

  return (
    <View style={styles.container}>
      <RecipeForm
        onSubmit={handleSubmit}
        recipeId={recipe.id}
        initialValues={initialValues}
        editMode={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 7,
  },
  surface: {
    padding: 8,
    height: 80,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});

export default EditRecipe;
