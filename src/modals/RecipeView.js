import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {StyleSheet, Text, View, BackHandler} from 'react-native';
import {
  Button,
  useTheme,
  Paragraph,
  Dialog,
  Portal,
  Provider,
} from 'react-native-paper';
import {
  Tabs,
  TabScreen,
  useTabIndex,
  useTabNavigation,
} from 'react-native-paper-tabs';
import commaNumber from 'comma-number';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';
import {BottomSheetModal, BottomSheetBackdrop} from '@gorhom/bottom-sheet';

import routes from '../constants/routes';
import {recipes} from '../__dummyData';
import GrandTotal from '../components/purchases/GrandTotal';
import RecipeSummary from '../components/recipes/RecipeSummary';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import OptionsList from '../components/buttons/OptionsList';
import IngredientList from '../components/recipes/IngredientList';
import {deleteRecipe, getRecipe} from '../localDbQueries/recipes';
import AddedIngredientList from '../components/recipes/AddedIngredientList';
import ScreenEmpty from '../components/stateIndicators/ScreenEmpty';

const RecipeView = props => {
  const {backAction} = props;
  const {colors} = useTheme();
  const route = useRoute();
  const recipeId = route.params?.recipe_id;
  const finishedProductId = route.params?.finished_product_id;
  const viewMode = route.params?.viewMode;
  const {status, data, isRefetching} = useQuery(
    ['recipe', {id: recipeId}],
    getRecipe,
    {
      enabled: recipeId ? true : false,
    },
  );
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const deleteRecipeMutation = useMutation(deleteRecipe, {
    onSuccess: () => {
      queryClient.invalidateQueries('recipes');
      navigation.goBack();
    },
  });
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const showDeleteDialog = () => setDeleteDialogVisible(true);

  const hideDeleteDialog = () => setDeleteDialogVisible(false);

  const itemOptions = [
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        navigation.navigate(routes.editRecipe(), {recipe_id: recipeId});
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Delete',
      labelColor: colors.notification,
      icon: 'delete-outline',
      iconColor: colors.notification,
      handler: () => {
        showDeleteDialog();
        closeOptionsBottomSheet();
      },
    },
  ];

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        backAction && backAction();
        closeOptionsBottomSheet();
      },
    );

    return () => backHandler.remove();
  }, []);

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, itemOptions.length * 75 + 30],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmDeleteItem = async () => {
    try {
      await deleteRecipeMutation.mutateAsync({
        id: recipeId,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      hideDeleteDialog();
    }
  };

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const renderBottomSheetBackdrop = useCallback(
    props => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={1}
      />
    ),
    [],
  );

  const renderOptions = () => {
    return (
      <View style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Item options'}
        </Text>
        <OptionsList options={itemOptions} />
      </View>
    );
  };

  if (status === 'loading' || isRefetching) {
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

  const actions = [
    {
      icon: 'plus',
      iconSize: 17,
      label: 'Create new recipe and link your item',
      handler: () => {
        navigation.navigate(routes.createRecipe(), {
          create_new_from_finished_product: true,
          finished_product_id: finishedProductId,
        });
      },
    },
  ];

  if (!recipe) {
    return (
      <View style={styles.container}>
        <ScreenEmpty message="Recipe not found" actions={actions} />
      </View>
    );
  }

  const deleteDialog = (
    <Portal>
      <Dialog visible={deleteDialogVisible} onDismiss={hideDeleteDialog}>
        <Dialog.Title>Delete recipe?</Dialog.Title>
        <Dialog.Content>
          <Paragraph>
            Are you sure you want to delete recipe? You can't undo this action.
          </Paragraph>
        </Dialog.Content>
        <Dialog.Actions style={{justifyContent: 'space-around'}}>
          <Button onPress={hideDeleteDialog}>Cancel</Button>
          <Button
            icon={'delete-outline'}
            onPress={handleConfirmDeleteItem}
            color={colors.notification}>
            Delete item
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  return (
    <>
      {deleteDialog}
      <View style={styles.container}>
        {recipe && (
          <RecipeSummary
            recipe={recipe}
            onPressItemOptions={openOptionsBottomSheet}
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 2,
            borderColor: colors.background,
            backgroundColor: colors.surface,
            // borderWidth: 2,
          }}>
          <Text style={{fontWeight: 'bold'}}>Ingredients</Text>
          <View style={{marginLeft: 'auto', marginRight: 40}}>
            <Text style={{fontWeight: '500', textAlign: 'right', fontSize: 12}}>
              Gross
            </Text>
            <Text
              style={{
                color: colors.dark,
                fontWeight: '500',
                textAlign: 'right',
                fontSize: 12,
              }}>
              Net
            </Text>
          </View>
        </View>
        <AddedIngredientList recipeId={recipeId} showFooter />
      </View>
      <BottomSheetModal
        ref={optionsBottomSheetModalRef}
        index={1}
        snapPoints={optionsBottomSheetSnapPoints}
        backdropComponent={renderBottomSheetBackdrop}
        onChange={handleBottomSheetChange}>
        {renderOptions()}
      </BottomSheetModal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default RecipeView;
