import {StyleSheet, Text, View} from 'react-native';
import React, {useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {getRecipe, getRecipeIngredients} from '../../../localDbQueries/recipes';

const useIngredientsValidator = ({enabled = false, recipeId, updatedYield}) => {
  const {
    isLoading: getRecipeIsLoading,
    isError: getRecipeIsError,
    status: getRecipeStatus,
    data: getRecipeData,
  } = useQuery(['recipeValidator', {id: recipeId}], getRecipe, {
    enabled: enabled && recipeId ? true : false,
  });

  const {
    isLoading: getRecipeIngredientsIsLoading,
    isError: getRecipeIngredientsIsError,
    status: getRecipeIngredientsStatus,
    data: getRecipeIngredientsData,
  } = useQuery(
    ['recipeIngredientsValidator', {recipeId}],
    getRecipeIngredients,
    {
      enabled: enabled && recipeId ? true : false,
    },
  );

  let isLoading = getRecipeIsLoading || getRecipeIngredientsIsLoading;
  let isError = getRecipeIsError || getRecipeIngredientsIsError;
  const recipe = getRecipeData?.result || null;
  const recipeIngredients = getRecipeIngredientsData?.result || [];
  const recipeIngredientsMap = {};
  const requiredIngredients = [];
  let hasError = isError;

  if (enabled && recipe && recipeIngredients?.length) {
    for (let ingredient of recipeIngredients) {
      let ingredientQtyPerRecipeYield =
        parseFloat(ingredient.in_recipe_qty_based_on_item_uom) / recipe.yield ||
        0;
      let ingredientQtyBasedOnUpdatedYield =
        ingredientQtyPerRecipeYield * updatedYield;

      let isInsufficientStock =
        ingredientQtyBasedOnUpdatedYield > ingredient.current_stock_qty;

      if (isInsufficientStock) {
        hasError = true;
      }

      const recipeIngredient = {
        name: ingredient.name,
        item_id: ingredient.item_id,
        current_stock_qty: ingredient.current_stock_qty,
        avg_unit_cost: ingredient.avg_unit_cost,
        avg_unit_cost_net: ingredient.avg_unit_cost_net,
        avg_unit_cost_tax: ingredient.avg_unit_cost_tax,
        in_recipe_qty_based_on_item_uom:
          ingredient.in_recipe_qty_based_on_item_uom,
        in_recipe_qty: ingredient.in_recipe_qty,
        in_recipe_uom_abbrev: ingredient.in_recipe_uom_abbrev,
        ingredientQtyBasedOnUpdatedYield,
        isInsufficientStock,
      };

      recipeIngredientsMap[ingredient.id] = recipeIngredient;
      requiredIngredients.push(recipeIngredient);
    }
  }

  const [ingredients, setIngredients] = useState(recipeIngredients);
  const [ingredientsMap, setIngredientsMap] = useState(recipeIngredientsMap);

  return {
    isLoading,
    isError,
    requiredIngredients,
    ingredients,
    setIngredients,
    ingredientsMap,
    setIngredientsMap,
    hasError,
  };
};

export default useIngredientsValidator;

const styles = StyleSheet.create({});
