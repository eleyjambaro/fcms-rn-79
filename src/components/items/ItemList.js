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
import ItemListItem from './ItemListItem';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import {getItems, deleteItem} from '../../localDbQueries/items';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';

const ItemList = props => {
  const {
    filter,
    backAction,
    viewMode,
    listItemDisplayMode,
    listStyle,
    listContentContainerStyle,
  } = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [focusedItem, setFocusedItem] = useState(null);
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
  const deleteItemMutation = useMutation(deleteItem, {
    onSuccess: () => {
      queryClient.invalidateQueries('items');
    },
  });
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
    {
      label: 'Manage Stocks',
      icon: 'text-box-check-outline',
      handler: () => {
        navigation.navigate(routes.manageStock(), {item_id: focusedItem.id});
        closeOptionsBottomSheet();
      },
    },
    /**
     * Uncomment code below to add View Puchase Entries option
     */
    // {
    //   label: 'View Purchase Entries',
    //   icon: 'basket-fill',
    //   handler: () => {
    //     navigation.navigate(routes.itemPurchaseEntries(), {
    //       item_id: focusedItem.id,
    //     });
    //     closeOptionsBottomSheet();
    //   },
    // },
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        navigation.navigate(routes.editItem(), {item_id: focusedItem.id});
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
      await deleteItemMutation.mutateAsync({
        id: focusedItem.id,
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
      <ItemListItem
        item={item}
        displayMode={listItemDisplayMode}
        onPressItem={() => {
          setFocusedItem(() => item);
          navigation.navigate(routes.itemView(), {item_id: item.id, viewMode});
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
          <Dialog.Title>Delete item?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete the item from inventory? You can't
              undo this action.
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
      <FlatList
        contentContainerStyle={listContentContainerStyle}
        style={[{backgroundColor: colors.surface}, listStyle]}
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

export default ItemList;
