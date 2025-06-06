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

import {items} from '../../__dummyData';
import {getItems, deleteItem} from '../../localDbQueries/items';
import {
  createRecipeIngredient,
  getRecipeIngredientItemIds,
} from '../../localDbQueries/recipes';
import IngredientSelectionListItem from './IngredientSelectionListItem';
import IngredientUnitAndQuantityForm from '../forms/IngredientUnitAndQuantityForm';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import GrandTotal from '../purchases/GrandTotal';
import useAddedIngredientsContext from '../../hooks/useAddedIngredientsContext';
import ListEmpty from '../stateIndicators/ListEmpty';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import ListLoadingFooter from '../stateIndicators/ListLoadingFooter';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const IngredientSelectionList = props => {
  const {recipeId, category, filter, backAction} = props;
  const [focusedItem, setFocusedItem] = useState(null);
  const [ingredientModalVisible, setIngredientModalVisible] = useState(false);
  const [infoDialogVisible, setInfoDialogVisible] = useState(false);
  const navigation = useNavigation();
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const {
    addedIngredients,
    addedIngredientIds,
    setAddedIngredients,
    setAddedIngredientIds,
  } = useAddedIngredientsContext();
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
    ['items', {filter, categoryId: filter?.category_id}],
    getItems,
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
  const {
    status: recipeIngredientItemIdsStatus,
    data: recipeIngredientItemIdsData,
  } = useQuery(['recipeIngredientIds', {recipeId}], getRecipeIngredientItemIds);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (data?.pages) {
      for (let page of data.pages) {
        pagesData.push(...page.result);
      }
    }

    return pagesData;
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

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
      handler: () => {
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

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const handleSubmitIngredientForm = async (values, actions) => {
    const formValues = {
      item_id: focusedItem.id,
      name: focusedItem.name,
      inventory_unit: focusedItem.uom_abbrev,
      inventory_unit_cost: focusedItem.unit_cost,
      use_measurement_per_piece: values.use_measurement_per_piece,
      in_recipe_uom_abbrev: values.in_recipe_uom_abbrev,
      in_recipe_qty: values.in_recipe_qty || 0,
    };
    console.log(formValues);

    try {
      await createIngredientMutation.mutateAsync({
        values: formValues,
        recipeId,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      navigation.goBack();
    }

    setAddedIngredients(ingredients => {
      const filteredIngredients = ingredients.filter(
        ingredient => ingredient.id !== formValues.id,
      );
      filteredIngredients.push(formValues);
      return filteredIngredients;
    });

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
      <IngredientSelectionListItem
        item={item}
        isAdded={
          recipeIngredientItemIdsData?.result?.includes(item.id) ? true : false
        }
        onPressItem={() => {
          setFocusedItem(() => item);
          showIngredientModal();
          closeOptionsBottomSheet();
        }}
        onPressItemOptions={() => {
          setFocusedItem(() => item);
          showIngredientModal();
          closeOptionsBottomSheet();
        }}
      />
    );
  };

  const renderCurrentStockQuantity = () => {
    if (focusedItem && !focusedItem.current_stock_qty) {
      return (
        <View style={styles.detailsListItemContainer}>
          <Text style={{color: colors.error}}>Out of stock</Text>
        </View>
      );
    } else if (focusedItem && focusedItem.current_stock_qty) {
      return (
        <View style={styles.detailsListItemContainer}>
          <Text>Current Stock Quantity:</Text>
          <Text
            style={{
              marginLeft: 7,
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${parseFloat(focusedItem.current_stock_qty || 0)}`}
          </Text>
          <Text
            style={{
              marginLeft: 5,
              color: colors.dark,
            }}>
            {`${formatUOMAbbrev(focusedItem.uom_abbrev)}`}
          </Text>
        </View>
      );
    }
  };

  if (status === 'loading' || recipeIngredientItemIdsStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error' || recipeIngredientItemIdsStatus === 'error') {
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
                itemId={focusedItem?.id}
                item={focusedItem}
                initialValues={{
                  in_recipe_qty: '',
                  in_recipe_uom_abbrev: focusedItem.uom_abbrev,
                }}
                onSubmit={handleSubmitIngredientForm}
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
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <ListEmpty
            actions={[
              {
                label: 'Register Item',
                handler: () => {
                  navigation.navigate(
                    routes.addItem(),
                    filter?.['items.category_id'] && {
                      category_id: filter['items.category_id'],
                    },
                  );
                },
              },
            ]}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            colors={[colors.primary, colors.accent, colors.dark]}
          />
        }
      />
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

export default IngredientSelectionList;
