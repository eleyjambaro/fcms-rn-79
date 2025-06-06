import React, {useState, useRef, useMemo, useCallback} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  Button,
  useTheme,
  Subheading,
  ActivityIndicator,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {useQuery} from '@tanstack/react-query';

import {
  addStockReasons,
  removeStockReasons,
} from '../constants/stockAdjustmentReasons';
import ItemLogList from '../components/items/ItemLogList';
import FiltersList from '../components/buttons/FiltersList';
import MoreSelectionButton from '../components/buttons/MoreSelectionButton';
import CheckboxSelection from '../components/forms/CheckboxSelection';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {
  getCategories,
  deleteCategory,
  updateCategory,
} from '../localDbQueries/categories';
import {
  getInventoryOperations,
  getInventoryOperation,
} from '../localDbQueries/operations';
import ItemStocksHeading from '../components/items/ItemStocksHeading';
import {getItem} from '../localDbQueries/items';
import appDefaults from '../constants/appDefaults';

const ItemAddedStocks = props => {
  const {route} = props;
  const itemId = route.params?.item_id;
  const selectedMonthYearDateFilter = route.params?.month_year_date_filter;

  const {colors} = useTheme();
  const [date, setDate] = useState(new Date());
  const [dateTimePickerMode, setDateTimePickerMode] = useState('date');
  const [showCalendar, setShowCalendar] = useState(false);
  const [optionsType, setOptionsType] = useState('duration');
  const [selectedAdjustmentType, setSelectedAdjustmentType] = useState({
    label: 'All',
    value: 'all',
  });
  const [selectedDuration, setSelectedDuration] = useState('');
  const {status: getItemStatus, data: getItemData} = useQuery(
    ['item', {id: itemId}],
    getItem,
  );
  const {status: categoriesStatus, data: categoriesData} = useQuery(
    ['categories', {}],
    getCategories,
  );
  const {status: addStockOperationsStatus, data: addStockOperationsData} =
    useQuery(
      ['addStockOperations', {filter: {type: 'add_stock'}}],
      getInventoryOperations,
    );
  const {status: removeStockOperationsStatus, data: removeStockOperationsData} =
    useQuery(
      ['removeStockOperations', {filter: {type: 'remove_stock'}}],
      getInventoryOperations,
    );
  const [operationId, setOperationId] = useState('');
  const {status: getOperationStatus, data: getOperationData} = useQuery(
    ['operation', {id: operationId}],
    getInventoryOperation,
    {enabled: operationId && operationId ? true : false},
  );
  const [itemLogListFilters, setItemLogListFilters] = useState({
    'items.category_id': '',
    'items.id': itemId,
    'operations.id': '',
    'operations.type': `'add_stock'`,
  });

  const adjustmentTypeOptions = [
    {
      label: 'All',
      value: 'all',
    },
    {
      label: 'Added',
      value: 'added',
    },
    {
      label: 'Removed',
      value: 'removed',
    },
  ];

  const adjustmentReasonOptions = [
    {isLabel: true, label: 'Added'},
    ...addStockReasons,
    {isLabel: true, label: 'Removed'},
    ...removeStockReasons,
  ];

  const durationOptions = [
    {
      label: 'All',
      value: '',
    },
    {
      label: 'Date Range',
      value: 'date-range',
    },
    {
      label: 'This Month',
      value: 'this-month',
    },
  ];

  const options =
    optionsType === 'duration'
      ? durationOptions
      : optionsType === 'adjustment-type'
      ? adjustmentTypeOptions
      : optionsType === 'adjustment-reason' && adjustmentReasonOptions;

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, options.length * 85],
    [optionsType],
  );

  const showMode = currentMode => {
    setShowCalendar(true);
    setDateTimePickerMode(currentMode);
  };

  const showDatepicker = () => {
    showMode('date');
  };

  const showTimepicker = () => {
    showMode('time');
  };

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handlePressFilterOptions = (optionsType = 'duration') => {
    setOptionsType(() => optionsType);
    openOptionsBottomSheet();
  };

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const handleDateTimePickerChange = (_event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowCalendar(Platform.OS === 'ios');
    setDate(currentDate);

    if (selectedDate) {
      const monthOfBirth = ('0' + (selectedDate.getMonth() + 1)).slice(-2);
      const dayOfBirth = ('0' + selectedDate.getDate()).slice(-2);
      const yearOfBirth = selectedDate.getFullYear();
    }
  };

  const handleCategoryFilterChange = categoryId => {
    setItemLogListFilters(currentValues => {
      return {
        ...currentValues,
        'items.category_id': categoryId,
      };
    });
  };

  const handleOperationFilterChange = operationId => {
    setItemLogListFilters(currentValues => {
      return {
        ...currentValues,
        'operations.id': operationId,
      };
    });

    closeOptionsBottomSheet();
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
    if (optionsType === 'duration') {
      return renderDurationOptions();
    }

    if (optionsType === 'adjustment-type') {
    }

    if (optionsType === 'adjustment-reason') {
      return renderOperationOptions();
    }
  };

  const renderDurationOptions = () => {
    return (
      <BottomSheetView style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          Select Duration
        </Text>
        <CheckboxSelection
          options={durationOptions}
          value={selectedDuration}
          onChange={selectedOption => {
            setSelectedDuration(() => selectedOption);
            closeOptionsBottomSheet();
          }}
        />
      </BottomSheetView>
    );
  };

  const renderOperationOptions = () => {
    if (
      addStockOperationsStatus === 'loading' ||
      removeStockOperationsStatus === 'loading'
    ) {
      return <DefaultLoadingScreen />;
    }

    if (
      addStockOperationsStatus === 'error' ||
      removeStockOperationsStatus === 'error'
    ) {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    const addStockOperationsDataResult = addStockOperationsData?.result;
    const removeStockOperationsDataResult = removeStockOperationsData?.result;

    if (!addStockOperationsDataResult || !removeStockOperationsDataResult) {
      return null;
    }

    const addStockOperations = addStockOperationsDataResult?.map(operation => {
      return {
        label:
          operation.id === 1
            ? `Pre-${appDefaults.appDisplayName} Stock`
            : operation.name,
        value: operation.id,
      };
    });

    const removeStockOperations = removeStockOperationsDataResult?.map(
      operation => {
        return {
          label: operation.name,
          value: operation.id,
        };
      },
    );

    const options = [
      {label: 'All', value: ''},
      {isLabel: true, label: 'Added'},
      ...addStockOperations,
    ];

    return (
      <BottomSheetView style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          Select Inventory Operation
        </Text>
        <CheckboxSelection
          options={options}
          optionValueKey="value"
          value={itemLogListFilters['operations.id']}
          onChange={handleOperationFilterChange}
        />
      </BottomSheetView>
    );
  };

  const renderSelectedOperationValue = (status, data, props) => {
    if (!operationId) {
      return (
        <Subheading style={{color: colors.primary, marginRight: 5}}>
          All
        </Subheading>
      );
    }

    if (status === 'loading') {
      return (
        <ActivityIndicator
          animating={true}
          color={colors.primary}
          style={{marginRight: 5}}
          size="small"
        />
      );
    }

    if (status === 'error') {
      return <Subheading style={props.style}>Something went wrong</Subheading>;
    }

    if (!data || !data.result) {
      return <Subheading {...props}>All</Subheading>;
    }

    return (
      <Subheading {...props}>
        {props?.trimTextLength(data.result?.name)}
      </Subheading>
    );
  };

  const renderItemAddedStocksHeading = () => {
    if (getItemStatus === 'loading') return null;
    if (getItemStatus === 'error') return null;

    return (
      <ItemStocksHeading
        item={getItemData.result}
        date={selectedMonthYearDateFilter}
      />
    );
  };

  if (categoriesStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (categoriesStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const categories = categoriesData.result;

  if (!categories) return null;

  const categoryFilterSelections = categories.map(category => {
    return {
      label: category.name,
      value: category.id,
    };
  });

  categoryFilterSelections.unshift({
    label: 'All',
    value: '',
  });

  return (
    <>
      {showCalendar && (
        <DateTimePicker
          testID="dateTimePicker"
          value={date}
          mode={dateTimePickerMode}
          is24Hour={true}
          onChange={handleDateTimePickerChange}
        />
      )}
      {renderItemAddedStocksHeading()}
      <View style={styles.container}>
        <View
          style={{
            padding: 10,
            backgroundColor: colors.surface,
            // marginBottom: 5,
          }}>
          <View
            style={{
              marginVertical: 5,
              // flexDirection: 'row',
              // alignItems: 'center',
              backgroundColor: colors.surface,
            }}>
            {/* <MoreSelectionButton
              label="Log Type"
              value={selectedAdjustmentType.label}
              onPress={() => handlePressFilterOptions('adjustment-type')}
              renderIcon={({iconSize, iconColor}) => {
                return (
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={iconSize}
                    color={iconColor}
                  />
                );
              }}
            /> */}
            <MoreSelectionButton
              label="Select Operation"
              renderValueCurrentValue={itemLogListFilters['operations.id']}
              renderValue={(_value, renderingValueProps) =>
                renderSelectedOperationValue(
                  getOperationStatus,
                  getOperationData,
                  renderingValueProps,
                )
              }
              onChangeValue={currentValue => {
                setOperationId(() => currentValue);
              }}
              containerStyle={{marginTop: -1}}
              onPress={() => handlePressFilterOptions('adjustment-reason')}
              renderIcon={({iconSize, iconColor}) => {
                return (
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={iconSize}
                    color={iconColor}
                  />
                );
              }}
            />
            {/* <MoreSelectionButton
              label="Select Duration"
              value={selectedDuration.label}
              containerStyle={{marginTop: -1}}
              onPress={() => handlePressFilterOptions('duration')}
              renderIcon={({iconSize, iconColor}) => {
                return (
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={iconSize}
                    color={iconColor}
                  />
                );
              }}
            /> */}
          </View>
          {selectedDuration === 'date-range' && (
            <View style={{flexDirection: 'row'}}>
              <View style={{flex: 1, marginRight: 2.5}}>
                <Text
                  style={{
                    textAlign: 'center',
                    marginVertical: 4,
                    fontSize: 12,
                  }}>
                  Start Date
                </Text>
                <Button
                  mode="contained"
                  icon="calendar"
                  onPress={showDatepicker}
                  color={colors.surface}>
                  May 01, 2022
                </Button>
              </View>
              <View style={{flex: 1, marginLeft: 2.5}}>
                <Text
                  style={{
                    textAlign: 'center',
                    marginVertical: 4,
                    fontSize: 12,
                  }}>
                  End Date
                </Text>
                <Button
                  mode="contained"
                  icon="calendar"
                  onPress={showDatepicker}
                  color={colors.surface}>
                  May 29, 2022
                </Button>
              </View>
            </View>
          )}
        </View>
        {/* <View>
          <FiltersList
            filters={categoryFilterSelections}
            value={itemLogListFilters['items.category_id']}
            onChange={handleCategoryFilterChange}
            containerStyle={{marginTop: 10, marginBottom: 10}}
          />
        </View> */}
        <ItemLogList
          filter={itemLogListFilters}
          selectedMonthYearDateFilter={selectedMonthYearDateFilter}
        />
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
    borderColor: 'red',
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
  bottomSheetContentHeader: {
    marginTop: 5,
    marginBottom: 15,
  },
  bottomSheetHeading: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  bottomSheetSubheading: {
    textAlign: 'center',
    color: '#fff',
  },
  bottomSheetPressableText: {
    paddingVertical: 8,
    marginVertical: 5,
  },
  bottomSheetText: {
    fontSize: 16,
  },
  bottomSheetItemsDivider: {
    height: 1,
    width: '100%',
    backgroundColor: '#fff',
  },
  bottomSheetButton: {
    marginVertical: 10,
  },
});

export default ItemAddedStocks;
