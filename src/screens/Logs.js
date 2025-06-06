import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';
import {StyleSheet, Text, View, Modal, Pressable} from 'react-native';
import {
  Button,
  useTheme,
  Subheading,
  ActivityIndicator,
  Searchbar,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment';
import MonthPicker from 'react-native-month-picker';

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
import MonthPickerModal from '../components/modals/MonthPickerModal';
import FilterHelperText from '../components/foodCostAnalysis/FilterHelperText';
import useSearchbarContext from '../hooks/useSearchbarContext';
import appDefaults from '../constants/appDefaults';

const Logs = () => {
  const {colors} = useTheme();
  const {keyword, setKeyword} = useSearchbarContext();
  const [isOpenMonthPicker, toggleOpenMonthPicker] = useState(false);
  const date = new Date();
  const month = ('0' + date.getMonth()).slice(-2);
  const year = date.getFullYear();
  const firstDayOfTheMonth = new Date(parseInt(year), parseInt(month), 1);
  const [startDate, setStartDate] = useState(firstDayOfTheMonth);
  const [endDate, setEndDate] = useState(new Date());
  const [isEndDate, setIsEndDate] = useState(false);

  const startMonth = ('0' + (startDate.getMonth() + 1)).slice(-2);
  const startDay = ('0' + startDate.getDate()).slice(-2);
  const startYear = startDate.getFullYear();
  const startHours = ('0' + startDate.getHours()).slice(-2);
  const startMinutes = ('0' + startDate.getMinutes()).slice(-2);
  const startSeconds = ('0' + startDate.getSeconds()).slice(-2);
  const startDatetimeStringFormat = `${startYear}-${startMonth}-${startDay} ${startHours}:${startMinutes}:${startSeconds}`;
  const startDatetimeString = startDatetimeStringFormat;

  const endMonth = ('0' + (endDate.getMonth() + 1)).slice(-2);
  const endDay = ('0' + endDate.getDate()).slice(-2);
  const endYear = endDate.getFullYear();
  const endHours = ('0' + endDate.getHours()).slice(-2);
  const endMinutes = ('0' + endDate.getMinutes()).slice(-2);
  const endSeconds = ('0' + endDate.getSeconds()).slice(-2);
  const endDatetimeStringFormat = `${endYear}-${endMonth}-${endDay} ${endHours}:${endMinutes}:${endSeconds}`;
  const endDatetimeString = endDatetimeStringFormat;

  const [dateTimePickerMode, setDateTimePickerMode] = useState('date');
  const [showCalendar, setShowCalendar] = useState(false);
  const [optionsType, setOptionsType] = useState('date-filter');
  const [selectedAdjustmentType, setSelectedAdjustmentType] = useState({
    label: 'All',
    value: 'all',
  });
  const [selectedDateFilter, setSelectedDateFilter] = useState({
    label: 'None',
    value: '',
  });
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
    'operations.id': '',
    '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
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

  const dateFilterOptions = [
    {
      label: 'None',
      value: '',
    },
    {
      label: 'Whole Month',
      value: 'month-year',
    },
    {
      label: 'Date Range',
      value: 'date-range',
    },
    {
      label: 'Month to Date',
      value: 'month-to-date',
    },
    // {
    //   label: 'Year to Date',
    //   value: 'year-to-date',
    // },
  ];

  const options =
    optionsType === 'date-filter'
      ? dateFilterOptions
      : optionsType === 'adjustment-type'
      ? adjustmentTypeOptions
      : optionsType === 'adjustment-reason' && adjustmentReasonOptions;

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, options.length * 85],
    [optionsType],
  );

  let selectedMonthYearDateFilter = null;
  let dateRangeFilter = null;
  let monthToDateFilter = null;
  let filterTextHelper = '';

  if (selectedDateFilter?.value === 'month-year') {
    selectedMonthYearDateFilter = startDatetimeString;

    filterTextHelper = `* Inventory logs of the whole month of ${moment(
      startDate,
    ).format('MMMM YYYY')} only.`;
  }

  if (selectedDateFilter?.value === 'date-range') {
    dateRangeFilter = {
      start: startDatetimeString,
      end: endDatetimeString,
    };

    filterTextHelper = '';
  }

  if (selectedDateFilter?.value === 'month-to-date') {
    monthToDateFilter = {
      start: startDatetimeString,
      end: endDatetimeString,
    };

    filterTextHelper = '';
  }

  useEffect(() => {
    setKeyword('');
    return () => {
      setKeyword('');
    };
  }, []);

  const onChangeSearch = keyword => {
    setKeyword(keyword);

    setItemLogListFilters(currentValues => {
      return {
        ...currentValues,
        '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
      };
    });
  };

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

  const handlePressFilterOptions = (optionsType = 'date-filter') => {
    setOptionsType(() => optionsType);
    openOptionsBottomSheet();
  };

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const handleDateTimePickerChange = (_event, selectedDate) => {
    const currentDate = selectedDate
      ? selectedDate
      : isEndDate
      ? endDate
      : startDate;

    setShowCalendar(Platform.OS === 'ios');
    if (isEndDate) {
      setEndDate(currentDate);
    } else {
      setStartDate(currentDate);
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

  const handleMonthPickerDateChange = value => {
    setStartDate(() => new Date(value));
  };

  const handleMonthYearDateFilterChange = (datetimeString, date) => {
    // setDateString(() => datetimeString);
    setStartDate(() => date);
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
    if (optionsType === 'date-filter') {
      return renderDateFilterOptions();
    }

    if (optionsType === 'adjustment-type') {
    }

    if (optionsType === 'adjustment-reason') {
      return renderOperationOptions();
    }
  };

  const renderDateFilterOptions = () => {
    return (
      <BottomSheetView style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          Select Date Filter
        </Text>
        <CheckboxSelection
          options={options}
          label={selectedDateFilter?.label}
          value={selectedDateFilter?.value}
          onChange={(selectedOptionValue, selectedOptionLabel) => {
            setSelectedDateFilter(() => {
              return {
                label: selectedOptionLabel,
                value: selectedOptionValue,
              };
            });
            closeOptionsBottomSheet();
          }}
        />
      </BottomSheetView>
    );
  };

  const renderStartAndEndDateButtons = () => {
    if (selectedDateFilter?.value === 'date-range') {
      return (
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
              onPress={() => {
                setIsEndDate(() => false);
                showDatepicker();
              }}
              color={colors.surface}>
              {moment(startDate).format('MMM DD, YYYY')}
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
              onPress={() => {
                setIsEndDate(() => true);
                showDatepicker();
              }}
              color={colors.surface}>
              {moment(endDate).format('MMM DD, YYYY')}
            </Button>
          </View>
        </View>
      );
    }

    if (selectedDateFilter?.value === 'month-to-date') {
      return (
        <View style={{flexDirection: 'row'}}>
          <View style={{flex: 1, marginRight: 2.5}}>
            <Text
              style={{
                textAlign: 'center',
                marginVertical: 4,
                fontSize: 12,
              }}>
              Start Month
            </Text>
            <Button
              mode="contained"
              icon="calendar"
              onPress={() => {
                setIsEndDate(() => false);
                // showDatepicker();
                toggleOpenMonthPicker(true);
              }}
              color={colors.surface}>
              {moment(startDate).format('MMM YYYY')}
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
              onPress={() => {
                setIsEndDate(() => true);
                showDatepicker();
              }}
              color={colors.surface}>
              {moment(endDate).format('MMM DD, YYYY')}
            </Button>
          </View>
        </View>
      );
    }

    if (selectedDateFilter?.value === 'year-to-date') {
      return (
        <View style={{flexDirection: 'row'}}>
          <View style={{flex: 1, marginRight: 2.5}}>
            <Text
              style={{
                textAlign: 'center',
                marginVertical: 4,
                fontSize: 12,
              }}>
              Start Year
            </Text>
            <Button
              mode="contained"
              icon="calendar"
              onPress={() => {
                setIsEndDate(() => false);
                showDatepicker();
              }}
              color={colors.surface}>
              {`YEAR ${moment(startDate).format('YYYY')}`}
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
              onPress={() => {
                setIsEndDate(() => true);
                showDatepicker();
              }}
              color={colors.surface}>
              {moment(endDate).format('MMM DD, YYYY')}
            </Button>
          </View>
        </View>
      );
    }
  };

  const renderSelectMonthYearButton = () => {
    if (selectedDateFilter?.value === 'month-year') {
      return (
        <MonthPickerModal
          buttonContainerStyle={{padding: 0, marginTop: -2}}
          value={startDatetimeString}
          onChange={handleMonthYearDateFilterChange}
        />
      );
    }
  };

  const renderCalendar = () => {
    const dateValue = isEndDate ? endDate : startDate;

    if (showCalendar && selectedDateFilter?.value === 'date-range') {
      return (
        <DateTimePicker
          testID="dateTimePicker"
          value={dateValue}
          mode={dateTimePickerMode}
          is24Hour={true}
          onChange={handleDateTimePickerChange}
        />
      );
    }

    if (showCalendar && selectedDateFilter?.value === 'month-to-date') {
      return (
        <DateTimePicker
          testID="dateTimePicker"
          value={dateValue}
          mode={dateTimePickerMode}
          is24Hour={true}
          onChange={handleDateTimePickerChange}
        />
      );
    }

    if (showCalendar && selectedDateFilter?.value === 'year-to-date') {
      return (
        <DateTimePicker
          testID="dateTimePicker"
          value={dateValue}
          mode={dateTimePickerMode}
          is24Hour={true}
          onChange={handleDateTimePickerChange}
        />
      );
    }
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

    const removeStockOperations = removeStockOperationsDataResult
      ?.filter(operation => operation.list_item_order !== 0)
      .map(operation => {
        return {
          label: operation.name,
          value: operation.id,
        };
      });

    const options = [
      {label: 'All', value: ''},
      {isLabel: true, label: 'Added'},
      ...addStockOperations,
      {isLabel: true, label: 'Removed'},
      ...removeStockOperations,
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
      return <Subheading {...props}>All</Subheading>;
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
      {renderCalendar()}
      <Modal
        transparent
        animationType="fade"
        visible={isOpenMonthPicker}
        onRequestClose={() => {
          toggleOpenMonthPicker(false);
        }}>
        <View style={styles.contentContainer}>
          <View style={styles.content}>
            <MonthPicker
              selectedDate={startDate || new Date()}
              onMonthChange={handleMonthPickerDateChange}
              currentMonthTextStyle={{color: colors.accent, fontWeight: 'bold'}}
              selectedBackgroundColor={colors.accent}
              yearTextStyle={{
                fontWeight: 'bold',
                fontSize: 20,
                color: colors.dark,
              }}
            />
            <Button
              onPress={() => toggleOpenMonthPicker(false)}
              style={styles.monthPickerConfirmButton}>
              OK
            </Button>
          </View>
        </View>
      </Modal>
      <View style={styles.container}>
        <View
          style={{
            padding: 10,
            backgroundColor: colors.surface,
            // marginBottom: 5,
          }}>
          <View
            style={{
              marginTop: 5,
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
              label="Operation"
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
            <MoreSelectionButton
              label="Date Filter"
              placeholder="Select Date Filter"
              value={
                selectedDateFilter?.label !== 'None'
                  ? selectedDateFilter?.label
                  : ''
              }
              containerStyle={{marginTop: -1}}
              onPress={() => handlePressFilterOptions('date-filter')}
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
          </View>
          {renderStartAndEndDateButtons()}
          {renderSelectMonthYearButton()}
        </View>
        <FilterHelperText
          text={filterTextHelper}
          containerStyle={{borderBottomWidth: 5, borderColor: 'white'}}
        />
        <View style={{padding: 5, width: '100%'}}>
          <View style={{flexDirection: 'row'}}>
            <Searchbar
              placeholder="Search item"
              onChangeText={onChangeSearch}
              value={keyword}
              style={{flex: 1}}
            />
            {/* <Pressable
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 10,
              }}>
              <MaterialCommunityIcons
                name="barcode-scan"
                size={25}
                color={colors.dark}
                style={{marginLeft: 'auto'}}
              />
            </Pressable> */}
          </View>
        </View>
        <View>
          <FiltersList
            filters={categoryFilterSelections}
            value={itemLogListFilters['items.category_id']}
            onChange={handleCategoryFilterChange}
            containerStyle={{marginTop: 7, marginBottom: 10}}
          />
        </View>
        <ItemLogList
          filter={itemLogListFilters}
          selectedMonthYearDateFilter={selectedMonthYearDateFilter}
          dateRangeFilter={dateRangeFilter}
          monthToDateFilter={monthToDateFilter}
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
  monthPickerConfirmButton: {
    marginTop: 25,
    margin: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 70,
  },
});

export default Logs;
