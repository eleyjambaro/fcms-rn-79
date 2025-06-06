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
  Paragraph,
  Dialog,
  Portal,
  Provider,
  Modal as RNPaperModal,
  Title,
} from 'react-native-paper';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import {items} from '../../__dummyData';
import ItemSizeOptionListItem from './ItemSizeOptionListItem';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import {getItems, deleteItem} from '../../localDbQueries/items';
import {
  createItemSellingSizeOption,
  deleteItemSellingSizeOption,
  getItemSellingSizeModifierOptions,
} from '../../localDbQueries/modifiers';
import ModifierOptionForm from '../forms/ModifierOptionForm';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';

const ItemSizeOptionList = props => {
  const {filter, itemId, item, listStyle, listContentContainerStyle} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();

  const [focusedItem, setFocusedItem] = useState(null);
  const [addOptionModalVisible, setAddOptionModalVisible] = useState(false);

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
    ['itemSellingSizeModifierOptions', {filter, itemId}],
    getItemSellingSizeModifierOptions,
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
  const createItemSellingSizeOptionMutation = useMutation(
    createItemSellingSizeOption,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('itemSellingSizeModifierOptions');
      },
    },
  );
  const deleteItemSellingSizeOptionMutation = useMutation(
    deleteItemSellingSizeOption,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('itemSellingSizeModifierOptions');
      },
    },
  );
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const showDeleteDialog = () => setDeleteDialogVisible(true);

  const hideDeleteDialog = () => setDeleteDialogVisible(false);

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

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const itemOptions = [
    // {
    //   label: 'Edit',
    //   icon: 'pencil-outline',
    //   handler: () => {
    //     navigation.navigate(routes.editItem(), {
    //       item_id: focusedItem.option_id,
    //     });
    //     closeOptionsBottomSheet();
    //   },
    // },
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

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, itemOptions.length * 75 + 50],
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
      await deleteItemSellingSizeOptionMutation.mutateAsync({
        id: focusedItem.option_id,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      hideDeleteDialog();
    }
  };

  const handleSubmit = async (values, actions) => {
    console.debug(values);

    try {
      await createItemSellingSizeOptionMutation.mutateAsync({
        itemId,
        values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      setAddOptionModalVisible(() => false);
      actions.resetForm();
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
      <BottomSheetView style={styles.bottomSheetContent}>
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
      </BottomSheetView>
    );
  };

  const renderItem = ({item}) => {
    return (
      <ItemSizeOptionListItem
        item={item}
        onPressItem={() => {
          setFocusedItem(() => item);
        }}
        onPressItemOptions={() => {
          setFocusedItem(() => item);
          openOptionsBottomSheet();
        }}
      />
    );
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
        <Dialog visible={deleteDialogVisible} onDismiss={hideDeleteDialog}>
          <Dialog.Title>Delete size option?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {`Are you sure you want to delete ${
                focusedItem?.option_name ? `"${focusedItem.option_name}" ` : ''
              }size option? You cannot undo this action.`}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteItem}
              color={colors.notification}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <RNPaperModal
          visible={addOptionModalVisible}
          onDismiss={() => setAddOptionModalVisible(false)}
          contentContainerStyle={{
            backgroundColor: colors.surface,
            padding: 10,
            paddingVertical: 20,
          }}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Size/Quantity Option
          </Title>

          <ModifierOptionForm
            itemId={itemId}
            initialValues={{
              in_option_qty_uom_abbrev: item.uom_abbrev,
              uom_abbrev_per_piece: item.uom_abbrev_per_piece,
              qty_per_piece: item.qty_per_piece,
            }}
            onSubmit={handleSubmit}
            onCancel={() => setAddOptionModalVisible(false)}
          />
        </RNPaperModal>
      </Portal>

      <FlatList
        contentContainerStyle={listContentContainerStyle}
        style={[{backgroundColor: colors.surface}, listStyle]}
        data={getAllPagesData()}
        keyExtractor={item => item.option_id}
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
            <Text>No data to display</Text>
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
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => {
            setAddOptionModalVisible(() => true);
          }}>
          Add Size Option
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
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default ItemSizeOptionList;
