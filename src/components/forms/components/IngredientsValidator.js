import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';

import {getRecipe, getRecipeIngredients} from '../../../localDbQueries/recipes';

const IngredientsValidator = props => {
  const {recipeId} = props;

  const {status: getRecipeStatus, data: getRecipeData} = useQuery(
    ['recipe', {id: recipeId}],
    getRecipe,
  );
  const {status: getRecipeIngredientsStatus, data: getRecipeIngredientsData} =
    useQuery(['recipeIngredients', {recipeId}], getRecipeIngredients);

  return (
    <View>
      <Text>IngredientsValidator</Text>
    </View>
  );
};

export default IngredientsValidator;

const styles = StyleSheet.create({});
