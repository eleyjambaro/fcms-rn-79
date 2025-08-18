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

import AddedSellingMenuItemListItem from './AddedSellingMenuItemListItem';
import SellingMenuItemUnitAndQuantityForm from '../forms/SellingMenuItemUnitAndQuantityForm';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import GrandTotal from '../purchases/GrandTotal';
import useAddedSellingMenuItemsContext from '../../hooks/useAddedSellingMenuItemsContext';
import {
  createSellingMenuItem,
  deleteSellingMenuItem,
  getSellingMenuItems,
} from '../../localDbQueries/sellingMenus';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import SellingMenuItemForm from '../forms/SellingMenuItemForm';

const AddedSellingMenuItemList = props => {
  const {sellingMenuId, backAction, showFooter = false, containerStyle} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const [focusedItem, setFocusedItem] = useState(null);
  const [infoDialogVisible, setInfoDialogVisible] = useState(false);
  const [sellingMenuItemModalVisible, setSellingMenuItemModalVisible] =
    useState(false);
  const {setAddedSellingMenuItems, setAddedSellingMenuItemIds} =
    useAddedSellingMenuItemsContext();
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
    ['sellingMenuItems', {sellingMenuId}],
    getSellingMenuItems,
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
  const createSellingMenuItemMutation = useMutation(createSellingMenuItem, {
    onSuccess: () => {
      queryClient.invalidateQueries('sellingMenuItems');
    },
  });
  const deleteSellingMenuItemMutation = useMutation(deleteSellingMenuItem, {
    onSuccess: () => {
      queryClient.invalidateQueries('sellingMenuItems');
    },
  });

  const itemOptions = [
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        // navigation.navigate(routes.editItem(), {item: focusedItem});
        showSellingMenuItemModal();
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
          await deleteSellingMenuItemMutation.mutateAsync({
            id: focusedItem?.id,
          });
        } catch (error) {
          console.debug(error);
        }

        setAddedSellingMenuItems(menuItems => {
          return menuItems.filter(menuItem => {
            return menuItem.id !== focusedItem?.id;
          });
        });

        setAddedSellingMenuItemIds(ids => {
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

  const showSellingMenuItemModal = () => setSellingMenuItemModalVisible(true);
  const hideSellingMenuItemModal = () => setSellingMenuItemModalVisible(false);

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

  const handleSellingMenuItemFormSubmit = async (values, actions) => {
    console.log(values);

    try {
      await createSellingMenuItemMutation.mutateAsync({
        values: values,
        sellingMenuId,
      });
    } catch (error) {
      console.debug(error);
    }

    setAddedSellingMenuItemIds(menuItemIds => {
      const ids = [...menuItemIds, values.item_id];

      return [...new Set(ids)];
    });

    actions.resetForm();
    hideSellingMenuItemModal();
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
          {'Menu item options'}
        </Text>
        <OptionsList options={itemOptions} />
      </BottomSheetView>
    );
  };

  const renderItem = ({item}) => {
    return (
      <AddedSellingMenuItemListItem
        item={item}
        onPressItem={() => {
          setFocusedItem(() => item);
          showSellingMenuItemModal();
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
          visible={sellingMenuItemModalVisible}
          onDismiss={hideSellingMenuItemModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 10, textAlign: 'center'}}>
            Menu Item
          </Title>
          {focusedItem && (
            <>
              <SellingMenuItemForm
                itemId={focusedItem?.item_id}
                item={focusedItem}
                initialValues={{
                  in_menu_qty: focusedItem.in_menu_qty,
                }}
                onSubmit={handleSellingMenuItemFormSubmit}
                onCancel={hideSellingMenuItemModal}
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
            <Text>No menu items added</Text>
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
            value={0}
            labelStyle={{fontSize: 14}}
            valueStyle={{fontSize: 16}}
            containerStyle={{backgroundColor: colors.neutralTint4}}
          />
          <GrandTotal label="Total Cost (Net)" value={0} />
          <View
            style={{
              backgroundColor: 'white',
              padding: 10,
            }}>
            <Button
              mode="outlined"
              icon="plus"
              onPress={() => {
                navigation.navigate(routes.selectSellingMenuItems(), {
                  selling_menu_id: sellingMenuId,
                });
              }}>
              Add Menu Item
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

export default AddedSellingMenuItemList;
