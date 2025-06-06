import React, {useState} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {StyleSheet, Text, View, BackHandler, ScrollView} from 'react-native';
import {
  Button,
  useTheme,
  Paragraph,
  Dialog,
  Portal,
  Provider,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';

import routes from '../constants/routes';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {
  deleteRecipe,
  getRecipe,
  getRecipeRegisteredFinishedProduct,
  getRecipeTotalCost,
} from '../localDbQueries/recipes';
import AddedIngredientList from '../components/recipes/AddedIngredientList';
import FinishedProductForm from '../components/forms/FinishedProductForm';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import {registerItem} from '../localDbQueries/items';

const ProduceFinishedProductStock = props => {
  const {backAction} = props;
  const {colors} = useTheme();
  const route = useRoute();
  const recipeId = route.params?.recipe_id;
  const viewMode = route.params?.viewMode;
  const {status, data} = useQuery(['recipe', {id: recipeId}], getRecipe);
  const {status: recipeTotalCostStatus, data: recipeTotalCostData} = useQuery(
    ['recipeTotalCost', {recipeId}],
    getRecipeTotalCost,
  );
  const {
    status: getRegisteredFinishedProductStatus,
    data: getRegisteredFinishedProductData,
  } = useQuery(
    ['registeredFinishedProduct', {recipeId: recipeId}],
    getRecipeRegisteredFinishedProduct,
    {
      enabled: recipeId ? true : false,
    },
  );
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const registerItemMutation = useMutation(registerItem, {
    onSuccess: () => {
      queryClient.invalidateQueries('items');
    },
  });

  const [limitReachedMessage, setLimitReachedMessage] = useState('');
  const [successDialogVisible, setSuccessDialogVisible] = useState(false);
  const [regiteredItemId, setRegiteredItemId] = useState(null);

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await registerItemMutation.mutateAsync({
        item: values,
        isFinishedProduct: true,
        // finishedProductOriginId: recipeId,
        // finishedProductOriginTable: 'recipes',
        recipeId, // use this instead of finishedProductOriginId (changes from v1.1.111)
        recipeRegisteredFinishedProduct,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: ({itemId}) => {
          setRegiteredItemId(() => itemId);
          setSuccessDialogVisible(() => true);
          actions.resetForm();
        },
      });
    } catch (error) {
      console.debug(error);
    }
  };

  if (
    status === 'loading' ||
    recipeTotalCostStatus === 'loading' ||
    getRegisteredFinishedProductStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    status === 'error' ||
    recipeTotalCostStatus === 'error' ||
    getRegisteredFinishedProductStatus === 'error'
  ) {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  if (!recipeId) return null;

  const recipe = data.result;

  const totalCost = recipeTotalCostData?.totalCost;
  const totalCostPerServing = totalCost / recipe.yield;

  const totalCostNet = recipeTotalCostData?.totalCostNet;
  const totalCostNetPerServing = totalCostNet / recipe.yield;

  const totalCostTax = recipeTotalCostData?.totalCostTax;
  const totalCostTaxPerServing = totalCostTax / recipe.yield;

  const recipeRegisteredFinishedProduct =
    getRegisteredFinishedProductData?.result;
  const registeredFinishedProductInitValues = {
    category_id: recipeRegisteredFinishedProduct?.category_id,
    name: recipeRegisteredFinishedProduct?.name || recipe?.name,
    uom_abbrev: recipeRegisteredFinishedProduct?.uom_abbrev,
    uom_abbrev_per_piece: recipeRegisteredFinishedProduct?.uom_abbrev_per_piece,
    qty_per_piece: recipeRegisteredFinishedProduct?.qty_per_piece,
  };

  let successMessage =
    'Finished product successfully registered in the inventory.';

  if (recipeRegisteredFinishedProduct) {
    successMessage =
      'New yield stock of your finished product has been successfully added to your inventory.';
  }

  return (
    <ScrollView style={styles.container}>
      <Portal>
        <Dialog
          visible={successDialogVisible}
          onDismiss={() => {
            setSuccessDialogVisible(() => false);
            navigation.goBack();
          }}>
          <Dialog.Title>Done!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{successMessage}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setSuccessDialogVisible(() => false);
                navigation.goBack();
              }}>
              Okay
            </Button>
            <Button
              onPress={() => {
                if (regiteredItemId) {
                  setSuccessDialogVisible(() => false);
                  navigation.pop();
                  navigation.navigate(routes.itemView(), {
                    item_id: regiteredItemId,
                  });
                }
              }}
              color={colors.dark}>
              View item
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <FinishedProductForm
        item={recipe}
        recipeRegisteredFinishedProduct={recipeRegisteredFinishedProduct}
        initialValues={{
          ...registeredFinishedProductInitValues,
          initial_stock_qty: recipe.yield,
          unit_cost: totalCostPerServing, // gross
          unit_cost_net: totalCostNetPerServing,
          unit_cost_tax: totalCostTaxPerServing,
          total_cost: totalCost, // gross
        }}
        onSubmit={handleSubmit}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 7,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default ProduceFinishedProductStock;
