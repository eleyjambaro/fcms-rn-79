import React, {useState, useRef, useMemo, useCallback} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Dimensions,
  Pressable,
  RefreshControl,
} from 'react-native';
import {
  Button,
  useTheme,
  DataTable,
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
import commaNumber from 'comma-number';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import GrandTotal from '../../components/purchases/GrandTotal';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import ListEmpty from '../../components/stateIndicators/ListEmpty';
import SpoilageListItem from './SpoilageListItem';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {
  deleteSpoilage,
  getSpoilagesTotal,
  getSpoilages,
  updateSpoilage,
} from '../../localDbQueries/spoilages';
import SpoilageItemForm from '../forms/SpoilageItemForm';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const SpoilageList = props => {
  const {
    dateFilter, // deprecated
    monthYearDateFilter, // alias of selectedMonthYearDateFilter
    selectedDateFilter,
    selectedMonthYearDateFilter,
    exactDateFilter,
    dateRangeFilter,
    monthToDateFilter,
    highlightedItemId,
    filter = {},
    currentCategory,
  } = props;
  const {colors} = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const currencySymbol = useCurrencySymbol();
  const [focusedItem, setFocusedItem] = useState(null);
  const [infoDialogVisible, setInfoDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [spoilageModalVisible, setSpoilageModalVisible] = useState(false);

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
    [
      'spoilages',
      {
        filter,
        monthYearDateFilter,
        selectedMonthYearDateFilter,
        exactDateFilter,
        dateRangeFilter,
        monthToDateFilter,
      },
    ],
    getSpoilages,
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
  const updateSpoilageMutation = useMutation(updateSpoilage, {
    onSuccess: () => {
      queryClient.invalidateQueries('spoilages');
    },
  });
  const deleteSpoilageMutation = useMutation(deleteSpoilage, {
    onSuccess: () => {
      queryClient.invalidateQueries('spoilages');
    },
  });
  const {
    status: selectedMonthSpoilagesTotalCostStatus,
    data: selectedMonthSpoilagesTotalCostData,
  } = useQuery(
    [
      'selectedMonthSpoilagesTotalCost',
      {
        monthYearDateFilter,
        selectedMonthYearDateFilter,
        exactDateFilter,
        dateRangeFilter,
        monthToDateFilter,
      },
    ],
    getSpoilagesTotal,
  );
  const {
    status: selectedMonthCategorySpoilagesTotalCostStatus,
    data: selectedMonthCategorySpoilagesTotalCostData,
  } = useQuery(
    [
      'selectedMonthCategorySpoilagesTotalCost',
      {
        monthYearDateFilter,
        selectedMonthYearDateFilter,
        exactDateFilter,
        dateRangeFilter,
        monthToDateFilter,
        filter,
      },
    ],
    getSpoilagesTotal,
  );

  const itemOptions = [
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        setSpoilageModalVisible(() => true);
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Remove',
      labelColor: colors.notification,
      icon: 'delete-outline',
      iconColor: colors.notification,
      handler: () => {
        setDeleteDialogVisible(() => true);
        closeOptionsBottomSheet();
      },
    },
  ];

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

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const handleConfirmDeleteSpoilage = async () => {
    try {
      await deleteSpoilageMutation.mutateAsync({
        id: focusedItem?.id,
      });
    } catch (error) {
      console.debug(error);
    }

    setDeleteDialogVisible(() => false);
  };

  const handleUpdateSpoilageItemFormSubmit = async (values, actions) => {
    try {
      await updateSpoilageMutation.mutateAsync({
        id: focusedItem?.id,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    }

    actions.resetForm();
    setSpoilageModalVisible(() => false);
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
          {'Spoilage options'}
        </Text>
        <OptionsList options={itemOptions} />
      </BottomSheetView>
    );
  };

  const renderItem = ({item}) => {
    return (
      <SpoilageListItem
        item={item}
        onPressItem={() => {
          setFocusedItem(() => item);
          setSpoilageModalVisible(() => true);
        }}
        onPressItemOptions={() => {
          setFocusedItem(() => item);
          openOptionsBottomSheet();
        }}
        monthYearDateFilter={monthYearDateFilter}
      />
    );
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const renderCategoryGrandTotal = () => {
    if (!currentCategory || currentCategory === 'All') return null;

    const categoryGrandTotal =
      selectedMonthCategorySpoilagesTotalCostData?.totalCostNet || 0;

    if (categoryGrandTotal) {
      return (
        <GrandTotal
          label={`${currentCategory} - Total (Net)`}
          value={categoryGrandTotal}
          labelStyle={{fontSize: 14}}
          valueStyle={{fontSize: 18}}
          containerStyle={{backgroundColor: colors.accent}}
        />
      );
    } else {
      return null;
    }
  };

  const renderGrandTotal = () => {
    if (currentCategory && currentCategory !== 'All') return null;

    const grandTotal = selectedMonthSpoilagesTotalCostData?.totalCostNet || 0;

    return <GrandTotal label="Grand Total (Net)" value={grandTotal} />;
  };

  if (status === 'loading') {
    return (
      <DefaultLoadingScreen
        containerStyle={{flex: 1, backgroundColor: colors.surface}}
      />
    );
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const items = getAllPagesData();

  return (
    <>
      <Portal>
        <Modal
          visible={spoilageModalVisible}
          onDismiss={() => setSpoilageModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 10, textAlign: 'center'}}>
            Spoilage
          </Title>
          <ScrollView showsVerticalScrollIndicator={false}>
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
                        parseFloat(focusedItem.avg_unit_cost_net || 0).toFixed(
                          2,
                        ),
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
                </View>

                <SpoilageItemForm
                  initialValues={{
                    in_spoilage_qty: focusedItem?.in_spoilage_qty || '',
                    in_spoilage_uom_abbrev:
                      focusedItem?.in_spoilage_uom_abbrev || '',
                    in_spoilage_date: focusedItem?.in_spoilage_date || '',
                    remarks: focusedItem?.remarks || '',
                  }}
                  itemId={focusedItem?.item_id}
                  submitButtonTitle="Update"
                  onSubmit={handleUpdateSpoilageItemFormSubmit}
                  onCancel={() => setSpoilageModalVisible(() => false)}
                />
              </>
            )}
          </ScrollView>
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
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(() => false)}>
          <Dialog.Title>Delete spoilage?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete spoilage? You can't undo this
              action.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={() => setDeleteDialogVisible(() => false)}>
              Cancel
            </Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteSpoilage}
              color={colors.notification}>
              Delete spoilage
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <View
        style={[
          styles.container,
          {backgroundColor: colors.surface, marginTop: 3},
        ]}>
        <FlatList
          data={items}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <ListEmpty
              actions={[
                {
                  label: 'Add spoilage',
                  handler: () => {
                    navigation.navigate(routes.selectSpoilageItem(), {
                      month_year_date_filter: monthYearDateFilter,
                      date_filter: dateFilter,
                    });

                    navigation.navigate(routes.selectSpoilageItem(), {
                      selected_date_filter_value: selectedDateFilter?.value,
                      month_year_date_filter: selectedMonthYearDateFilter,
                      exact_date_filter: exactDateFilter,
                      date_range_filter_start: dateRangeFilter?.start,
                      date_range_filter_end: dateRangeFilter?.end,
                      month_to_date_filter_start: monthToDateFilter?.start,
                      month_to_date_filter_end: monthToDateFilter?.end,
                    });
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
      </View>
      {renderCategoryGrandTotal()}
      {renderGrandTotal()}
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
  table: {
    flex: 1,
  },
  tableColumn: {},
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

export default SpoilageList;
