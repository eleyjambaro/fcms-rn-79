import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Button, useTheme, Modal, Title, Portal} from 'react-native-paper';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import {ingredients} from '../../__dummyData';
import IngredientListItem from './IngredientListItem';
import IngredientUnitAndQuantityForm from '../forms/IngredientUnitAndQuantityForm';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import GrandTotal from '../purchases/GrandTotal';

const IngredientList = props => {
  const {recipeId, category, backAction} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [focusedItem, setFocusedItem] = useState(null);
  const [ingredientModalVisible, setIngredientModalVisible] = useState(false);

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
      <IngredientListItem
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

  let data = ingredients.filter(
    ingredient => ingredient.recipe_id === recipeId,
  );

  const grandTotal = data.reduce((currentTotal, ingredient) => {
    if (!ingredient.recipe_qty) return 0 + currentTotal;

    const totalCost = ingredient.inventory_unit_cost * ingredient.recipe_qty;

    return totalCost + currentTotal;
  }, 0);

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
              <View style={styles.detailsContainer}>
                <View style={styles.detailsListItem}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: 'bold',
                      color: colors.dark,
                    }}>
                    {`${focusedItem.name}`}
                  </Text>
                </View>
              </View>

              <IngredientUnitAndQuantityForm
                itemId={focusedItem?.id}
                initialValues={{
                  quantity: focusedItem.recipe_qty,
                  unit: focusedItem.recipe_unit,
                }}
                onSubmit={() => {
                  hideIngredientModal();
                }}
                onCancel={hideIngredientModal}
              />
            </>
          )}
        </Modal>
      </Portal>
      <FlatList
        style={{backgroundColor: colors.surface}}
        data={data}
        keyExtractor={item => item.name}
        renderItem={renderItem}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              padding: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text>No data to display</Text>
          </View>
        }
      />
      <GrandTotal label="Total Cost" value={grandTotal} />
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => {
            navigation.navigate(routes.selectRecipeIngredient());
          }}>
          Add Ingredient
        </Button>
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
  detailsContainer: {
    marginVertical: 10,
    marginBottom: 15,
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

export default IngredientList;
