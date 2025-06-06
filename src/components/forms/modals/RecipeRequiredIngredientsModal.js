import React, {useState, useRef, useMemo, useCallback} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Dimensions,
  Pressable,
  RefreshControl,
} from 'react-native';
import {
  Button,
  useTheme,
  DataTable,
  Modal,
  Portal,
  Title,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import {Tabs, TabScreen} from 'react-native-paper-tabs';

import useCurrencySymbol from '../../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../../utils/stringHelpers';

const RecipeRequiredIngredientsModal = props => {
  const {visible, onDismiss, contentContainerStyle, ingredientsValidator} =
    props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const currencySymbol = useCurrencySymbol();
  const {hasError, requiredIngredients} = ingredientsValidator;

  if (!ingredientsValidator) return null;

  const renderRequiredIngredientsSummaryErrorMessage = () => {
    return (
      <Pressable style={{marginTop: 10}}>
        <Text style={{color: colors.error}}>
          Some of your ingredients have insufficient stock based on the total
          yield you want to produce.
        </Text>
      </Pressable>
    );
  };

  const renderRequiredIngredientsSummary = () => {
    if (!requiredIngredients?.length) return null;

    const requiredIngredientsList = requiredIngredients.map(ingredient => {
      return (
        <View
          key={ingredient.item_id}
          style={{flexDirection: 'row', marginVertical: 2}}>
          <Text
            style={{flex: 1, fontWeight: 'bold', color: colors.neutralTint2}}
            numberOfLines={1}>
            {ingredient.name}
          </Text>
          <View style={{flexDirection: 'row', marginLeft: 'auto'}}>
            <Text
              style={{
                marginLeft: 5,
                fontWeight: 'bold',
                fontStyle: 'italic',
                color: ingredient.isInsufficientStock
                  ? colors.error
                  : colors.dark,
              }}>
              {`${commaNumber(
                ingredient.ingredientQtyBasedOnUpdatedYield?.toFixed(2),
              )} ${formatUOMAbbrev(ingredient.in_recipe_uom_abbrev)}`}
            </Text>
          </View>
        </View>
      );
    });

    return (
      <View style={{marginHorizontal: 10}}>
        {requiredIngredientsList}
        {hasError && renderRequiredIngredientsSummaryErrorMessage()}
      </View>
    );
  };

  const renderList = () => {
    return renderRequiredIngredientsSummary();
  };

  return (
    <>
      <Portal>
        <Modal
          visible={visible}
          onDismiss={() => onDismiss && onDismiss()}
          contentContainerStyle={[
            {backgroundColor: 'white', padding: 10},
            contentContainerStyle,
          ]}>
          <Title style={{textAlign: 'center'}}>Required Ingredients</Title>

          <ScrollView style={{marginVertical: 25}}>{renderList()}</ScrollView>
          <View
            style={{
              backgroundColor: 'white',
              padding: 10,
              paddingBottom: 20,
            }}>
            <Button
              mode="contained"
              icon="close"
              onPress={() => {
                onDismiss && onDismiss();
              }}>
              Close
            </Button>
          </View>
        </Modal>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  table: {
    flex: 1,
  },
  tableColumn: {},
});

export default RecipeRequiredIngredientsModal;
