import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TouchableOpacity,
  BackHandler,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  Button,
  useTheme,
  Modal,
  Title,
  Portal,
  Dialog,
  Paragraph,
} from 'react-native-paper';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';
import commaNumber from 'comma-number';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import AddedIngredientListItem from './AddedIngredientListItem';
import IngredientUnitAndQuantityForm from '../forms/IngredientUnitAndQuantityForm';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import GrandTotal from '../purchases/GrandTotal';
import useAddedIngredientsContext from '../../hooks/useAddedIngredientsContext';
import {
  createRecipeIngredient,
  deleteRecipeIngredient,
  getRecipeIngredients,
  getRecipeTotalCost,
} from '../../localDbQueries/recipes';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const AddedIngredientList = props => {
  const {recipeId, backAction, showFooter = false, containerStyle} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const [focusedItem, setFocusedItem] = useState(null);
  const [infoDialogVisible, setInfoDialogVisible] = useState(false);
  const [ingredientModalVisible, setIngredientModalVisible] = useState(false);
  const {setAddedIngredients, setAddedIngredientIds} =
    useAddedIngredientsContext();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(
    ['recipeIngredients', {recipeId}],
    getRecipeIngredients,
    {
      getNextPageParam: (lastPage, pages) => {
        let pagesResult = [];

        for (let page of pages) {
          pagesResult.push(...page.result);
        }

        if (pagesResult.length < lastPage.totalCount) {
          return lastPage.page + 1;
        }
      },
      networkMode: 'always',
    },
  );
  const queryClient = useQueryClient();
  const createIngredientMutation = useMutation(createRecipeIngredient, {
    onSuccess: () => {
      queryClient.invalidateQueries('recipeIngredients');
    },
  });
  const deleteIngredientMutation = useMutation(deleteRecipeIngredient, {
    onSuccess: () => {
      queryClient.invalidateQueries('recipeIngredients');
    },
  });
  const {status: recipeTotalCostStatus, data: recipeTotalCostData} = useQuery(
    ['recipeTotalCost', {recipeId}],
    getRecipeTotalCost,
  );

  const itemOptions = [
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        // navigation.navigate(routes.editItem(), {item: focusedItem});
        showIngredientModal();
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Remove',
      labelColor: colors.notification,
      icon: 'delete-outline',
      iconColor: colors.notification,
      handler: async () => {
        try {
          await deleteIngredientMutation.mutateAsync({
            id: focusedItem?.id,
          });
        } catch (error) {
          console.debug(error);
        }

        setAddedIngredients(ingredients => {
          return ingredients.filter(ingredient => {
            return ingredient.id !== focusedItem?.id;
          });
        });

        setAddedIngredientIds(ids => {
          return ids.filter(id => id !== focusedItem?.id);
        });
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
    () => [120, itemOptions.length * 75 + 35],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const showIngredientModal = () => setIngredientModalVisible(true);
  const hideIngredientModal = () => setIngredientModalVisible(false);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (data.pages) {
      for (let page of data.pages) {
        pagesData.push(...page.result);
      }
    }

    return pagesData;
  };

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const handleIngredientFormSubmit = async (values, actions) => {
    const formValues = {
      item_id: focusedItem.item_id,
      name: focusedItem.name,
      inventory_unit: focusedItem.uom_abbrev,
      inventory_unit_cost: focusedItem.unit_cost,
      use_measurement_per_piece: values.use_measurement_per_piece,
      in_recipe_uom_abbrev: values.in_recipe_uom_abbrev,
      in_recipe_qty: values.in_recipe_qty || 0,
    };

    try {
      await createIngredientMutation.mutateAsync({
        values: formValues,
        recipeId,
      });
    } catch (error) {
      console.debug(error);
    }

    setAddedIngredientIds(ingredientIds => {
      const ids = [...ingredientIds, formValues.item_id];

      return [...new Set(ids)];
    });

    actions.resetForm();
    hideIngredientModal();
  };

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
      <BottomSheetView style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Ingredient options'}
        </Text>
        <OptionsList options={itemOptions} />
      </BottomSheetView>
    );
  };

  const renderItem = ({item}) => {
    return (
      <AddedIngredientListItem
        item={item}
        onPressItem={() => {
          setFocusedItem(() => item);
          showIngredientModal();
          closeOptionsBottomSheet();
        }}
        onPressItemOptions={() => {
          setFocusedItem(() => item);
          openOptionsBottomSheet();
        }}
      />
    );
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

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

  return (
    <>
      <Portal>
        <Modal
          visible={ingredientModalVisible}
          onDismiss={hideIngredientModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 10, textAlign: 'center'}}>
            Ingredient
          </Title>
          {focusedItem && (
            <>
              <View style={[styles.detailsContainer]}>
                <View style={styles.detailsListHeadingContainer}>
                  <Text
                    style={[
                      styles.detailsListHeading,
                      {
                        color: colors.dark,
                      },
                    ]}>
                    {`${focusedItem.name}`}
                  </Text>
                </View>
                <View style={styles.detailsListItemContainer}>
                  <Text>Current Avg. Unit Cost:</Text>
                  <Text
                    style={{
                      marginLeft: 7,
                      fontWeight: 'bold',
                      color: colors.dark,
                    }}>
                    {`${currencySymbol} ${commaNumber(
                      parseFloat(focusedItem.avg_unit_cost_net || 0).toFixed(2),
                    )}`}
                  </Text>
                  <Text
                    style={{
                      marginLeft: 5,
                      color: colors.dark,
                    }}>
                    {`/ ${formatUOMAbbrev(focusedItem.uom_abbrev)}`}
                  </Text>
                  <MaterialCommunityIcons
                    onPress={() => setInfoDialogVisible(() => true)}
                    name="information"
                    size={18}
                    color={colors.primary}
                    style={{paddingLeft: 7, paddingRight: 30}}
                  />
                </View>
                {/* {renderCurrentStockQuantity()} */}
              </View>

              <IngredientUnitAndQuantityForm
                itemId={focusedItem?.item_id}
                initialValues={{
                  in_recipe_qty: focusedItem.in_recipe_qty,
                  in_recipe_uom_abbrev: focusedItem.in_recipe_uom_abbrev,
                }}
                onSubmit={handleIngredientFormSubmit}
                onCancel={hideIngredientModal}
              />
            </>
          )}
        </Modal>
      </Portal>
      <Portal>
        <Dialog
          visible={infoDialogVisible}
          onDismiss={() => setInfoDialogVisible(() => false)}>
          <Dialog.Title>Info</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Current average unit cost updates automatically everytime you add
              or remove stock from the inventory.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setInfoDialogVisible(() => false);
              }}
              color={colors.primary}>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <FlatList
        style={{backgroundColor: colors.surface}}
        data={getAllPagesData()}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              padding: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text>No ingredients added</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            colors={[colors.primary, colors.accent, colors.dark]}
          />
        }
      />
      {showFooter && (
        <View>
          <GrandTotal
            label={`Total Cost (Gross)`}
            value={recipeTotalCostData?.totalCost || 0}
            labelStyle={{fontSize: 14}}
            valueStyle={{fontSize: 16}}
            containerStyle={{backgroundColor: colors.neutralTint4}}
          />
          <GrandTotal
            label="Total Cost (Net)"
            value={recipeTotalCostData?.totalCostNet || 0}
          />
          <View
            style={{
              backgroundColor: 'white',
              padding: 10,
            }}>
            <Button
              mode="outlined"
              icon="plus"
              onPress={() => {
                navigation.navigate(routes.selectRecipeIngredient(), {
                  recipe_id: recipeId,
                });
              }}>
              Add Ingredient
            </Button>
          </View>
        </View>
      )}
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
  detailsContainer: {
    marginVertical: 10,
    marginBottom: 25,
  },
  detailsListHeadingContainer: {
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: 16,
  },
  detailsListHeading: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailsListItemContainer: {
    flexDirection: 'row',
    marginTop: 5,
  },
  detailsListItem: {
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default AddedIngredientList;
