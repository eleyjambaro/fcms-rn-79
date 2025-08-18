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

import {getItems, deleteItem} from '../../localDbQueries/items';
import {
  createSellingMenuItem,
  getSellingMenuItemIds,
} from '../../localDbQueries/sellingMenus';
import SellingMenuItemSelectionListItem from './SellingMenuItemSelectionListItem';
import SellingMenuItemUnitAndQuantityForm from '../forms/SellingMenuItemUnitAndQuantityForm';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import useAddedSellingMenuItemsContext from '../../hooks/useAddedSellingMenuItemsContext';
import ListEmpty from '../stateIndicators/ListEmpty';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import ListLoadingFooter from '../stateIndicators/ListLoadingFooter';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import SellingMenuItemForm from '../forms/SellingMenuItemForm';

const SellingMenuItemSelectionList = props => {
  const {sellingMenuId, category, filter, backAction} = props;
  const [focusedItem, setFocusedItem] = useState(null);
  const [sellingMenuItemModalVisible, setSellingMenuItemModalVisible] =
    useState(false);
  const [infoDialogVisible, setInfoDialogVisible] = useState(false);
  const navigation = useNavigation();
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
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
  const createSellingMenuItemMutation = useMutation(createSellingMenuItem, {
    onSuccess: () => {
      queryClient.invalidateQueries('sellingMenuItems');
    },
  });
  const {status: sellingMenuItemIdsStatus, data: sellingMenuItemIdsData} =
    useQuery(['sellingMenuItemIds', {sellingMenuId}], getSellingMenuItemIds);

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
        showSellingMenuItemModal();
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

  const showSellingMenuItemModal = () => setSellingMenuItemModalVisible(true);
  const hideSellingMenuItemModal = () => setSellingMenuItemModalVisible(false);

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const handleSubmitSellingMenuItemForm = async (values, actions) => {
    console.log(values);

    try {
      await createSellingMenuItemMutation.mutateAsync({
        values,
        sellingMenuId,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      navigation.goBack();
    }

    setAddedSellingMenuItems(menuItems => {
      const filteredMenuItems = menuItems.filter(
        menuItem => menuItem.id !== values.id,
      );
      filteredMenuItems.push(values);
      return filteredMenuItems;
    });

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
      <SellingMenuItemSelectionListItem
        item={item}
        isAdded={
          sellingMenuItemIdsData?.result?.includes(item.id) ? true : false
        }
        onPressItem={() => {
          setFocusedItem(() => item);
          showSellingMenuItemModal();
          closeOptionsBottomSheet();
        }}
        onPressItemOptions={() => {
          setFocusedItem(() => item);
          showSellingMenuItemModal();
          closeOptionsBottomSheet();
        }}
      />
    );
  };

  if (status === 'loading' || sellingMenuItemIdsStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error' || sellingMenuItemIdsStatus === 'error') {
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
            Add Menu Item
          </Title>
          {focusedItem && (
            <>
              <SellingMenuItemForm
                itemId={focusedItem?.id}
                item={focusedItem}
                onSubmit={handleSubmitSellingMenuItemForm}
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

export default SellingMenuItemSelectionList;
