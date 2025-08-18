import React, {useEffect, useState} from 'react';
import {StyleSheet, ScrollView, View} from 'react-native';
import {
  Button,
  useTheme,
  Paragraph,
  Dialog,
  Portal,
  Banner,
  Text,
} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import RecipeForm from '../components/forms/RecipeForm';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import useAddedIngredientsContext from '../hooks/useAddedIngredientsContext';
import {
  createOrGetUnsavedRecipe,
  deleteRecipe,
  getAllRecipeIngredients,
  saveRecipe,
  isUnsavedRecipeHasIngredient,
  deleteRecipeIngredients,
} from '../localDbQueries/recipes';
import {getItem} from '../localDbQueries/items';
import routes from '../constants/routes';

const CreateRecipe = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const createNewFromFinishedProduct =
    route.params?.create_new_from_finished_product;
  const finishedProductId = route.params?.finished_product_id;

  const [creatingForFPBannerVisible, setCreatingForFPBannerVisible] = useState(
    createNewFromFinishedProduct && finishedProductId ? true : false,
  );

  const {resetData} = useAddedIngredientsContext();
  const {status, data} = useQuery(['currentRecipe'], createOrGetUnsavedRecipe);
  const {
    status: isUnsavedRecipeHasIngredientsStatus,
    data: isUnsavedRecipeHasIngredientsData,
  } = useQuery(['isUnsavedRecipeHasIngredient'], isUnsavedRecipeHasIngredient);
  const queryClient = useQueryClient();
  const saveRecipeMutation = useMutation(saveRecipe, {
    onSuccess: () => {
      queryClient.invalidateQueries('currentRecipe');
      queryClient.invalidateQueries('recipes');

      if (createNewFromFinishedProduct && finishedProductId) {
        queryClient.invalidateQueries('item');
      }
    },
  });
  const deleteRecipeIngredientsMutation = useMutation(deleteRecipeIngredients, {
    onSuccess: () => {
      queryClient.invalidateQueries('currentRecipe');
      queryClient.invalidateQueries('recipes');
    },
  });
  const [newOrFromUnsavedDialogVisible, setNewOrFromUnsavedDialogVisible] =
    useState(false);
  const [successDialogVisible, setSuccessDialogVisible] = useState(false);
  const [createdRecipeId, setCreatedRecipeId] = useState(null);

  /**
   * Finished product with deleted associated recipe
   */
  const {status: getFinishedProductStatus, data: getFinishedProductData} =
    useQuery(['item', {id: finishedProductId}], getItem, {
      enabled: createNewFromFinishedProduct && finishedProductId ? true : false,
    });

  const deleteUnsavedRecipeIngredients = async id => {
    try {
      await deleteRecipeIngredientsMutation.mutateAsync({
        id,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      setNewOrFromUnsavedDialogVisible(() => false);
    }
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);

    let linkToFinishedProduct =
      createNewFromFinishedProduct && finishedProductId ? true : false;

    try {
      await saveRecipeMutation.mutateAsync({
        values,
        linkToFinishedProduct,
        finishedProductId,
        onSuccess: ({recipeId}) => {
          setCreatedRecipeId(() => recipeId);
          setSuccessDialogVisible(() => true);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      resetData();
    }
  };

  useEffect(() => {
    return () => {
      resetData();
    };
  }, []);

  useEffect(() => {
    const runCheck = async () => {
      try {
        const hasIngredients = await isUnsavedRecipeHasIngredient();

        if (hasIngredients) {
          setNewOrFromUnsavedDialogVisible(() => true);
        }
      } catch (error) {
        console.debug(error);
      }
    };

    runCheck();
  }, []);

  if (
    status === 'loading' ||
    isUnsavedRecipeHasIngredientsStatus === 'loading' ||
    (createNewFromFinishedProduct &&
      finishedProductId &&
      getFinishedProductStatus === 'loading')
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    status === 'error' ||
    isUnsavedRecipeHasIngredientsStatus === 'error' ||
    (createNewFromFinishedProduct &&
      finishedProductId &&
      getFinishedProductStatus === 'error')
  ) {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  let initialValues = {
    recipe_kind_id: route.params?.recipe_kind_id?.toString() || '',
    group_name: data.result?.group_name || '',
    name: data.result?.name || '',
    yield: data.result?.yield?.toString() || '',
  };

  const finishedProduct = getFinishedProductData?.result;

  if (createNewFromFinishedProduct && finishedProductId && finishedProduct) {
    initialValues = {
      ...initialValues,
      name: finishedProduct?.name,
    };
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      <Portal>
        <Dialog
          visible={newOrFromUnsavedDialogVisible}
          onDismiss={() => setNewOrFromUnsavedDialogVisible(() => false)}>
          <Dialog.Title>Continue editing your unsaved recipe?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              You can keep editing ingredients from your unsaved recipe or start
              a new one from scratch.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setNewOrFromUnsavedDialogVisible(() => false);
              }}>
              Continue Editing
            </Button>
            <Button
              onPress={() => {
                if (data?.result?.id && isUnsavedRecipeHasIngredientsData)
                  deleteUnsavedRecipeIngredients(data.result.id);
              }}
              color={colors.dark}>
              Start New
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={successDialogVisible}
          onDismiss={() => {
            setSuccessDialogVisible(() => false);
            if (
              createNewFromFinishedProduct &&
              finishedProductId &&
              createdRecipeId
            ) {
              navigation.navigate(routes.recipeView(), {
                recipe_id: createdRecipeId,
              });
            } else {
              navigation.goBack();
            }
          }}>
          <Dialog.Title>Done!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>Recipe successfully created.</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setSuccessDialogVisible(() => false);
                if (
                  createNewFromFinishedProduct &&
                  finishedProductId &&
                  createdRecipeId
                ) {
                  navigation.navigate(routes.recipeView(), {
                    recipe_id: createdRecipeId,
                  });
                }
              }}>
              Close
            </Button>
            <Button
              onPress={() => {
                if (createdRecipeId) {
                  setSuccessDialogVisible(() => false);
                  navigation.pop();
                  navigation.navigate(routes.recipeView(), {
                    recipe_id: createdRecipeId,
                  });
                }
              }}
              color={colors.dark}>
              View recipe
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {createNewFromFinishedProduct && finishedProductId && finishedProduct && (
        <Banner
          style={{backgroundColor: colors.neutralTint5}}
          visible={creatingForFPBannerVisible}
          actions={[
            {
              label: 'Okay',
              onPress: () => {
                setCreatingForFPBannerVisible(() => false);
              },
            },
          ]}
          icon="information-outline">
          <Text>
            {`You are now creating a recipe that will be automatically linked to your finished product item:`}
            <Text
              style={{fontWeight: 'bold'}}>{` ${finishedProduct?.name}`}</Text>
          </Text>
        </Banner>
      )}
      <RecipeForm
        onSubmit={handleSubmit}
        isUnsavedRecipe={data.result?.id ? true : false}
        recipeId={data.result?.id}
        initialValues={initialValues}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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

export default CreateRecipe;
