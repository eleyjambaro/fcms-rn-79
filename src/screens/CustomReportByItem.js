import React, {useState, useRef, useMemo, useCallback} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Dimensions,
  Pressable,
  RefreshControl,
  Modal as RNModal,
} from 'react-native';
import {Button, useTheme, DataTable, Modal, Portal} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {BottomSheetModal, BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment';
import MonthPicker from 'react-native-month-picker';

import MonthPickerModal from '../components/modals/MonthPickerModal';
import CurrentMonthYearHeading from '../components/foodCostAnalysis/CurrentMonthYearHeading';
import ItemCustomReportTabularList from '../components/items/ItemCustomReportTabularList';
import FiltersList from '../components/buttons/FiltersList';
import MoreSelectionButton from '../components/buttons/MoreSelectionButton';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {getCategories} from '../localDbQueries/categories';
import CustomReportsFileExport from '../components/reports/CustomReportsFileExport';
import FilterHelperText from '../components/foodCostAnalysis/FilterHelperText';
import CheckboxSelection from '../components/forms/CheckboxSelection';

const CustomReportByItem = () => {
  const {colors} = useTheme();
  const route = useRoute();
  const highlightedItemId = route?.params?.highlightedItemId;
  const navigation = useNavigation();
  const {status: categoriesStatus, data: categoriesData} = useQuery(
    ['categories', {}],
    getCategories,
  );
  const [listFilters, setItemLogListFilters] = useState({
    'items.category_id': '',
    'operations.id': '',
  });

  // const [dateString, setDateString] = useState('');
  // const [date, setDate] = useState(new Date());

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
    label: 'Whole Month',
    value: 'month-year',
  });

  const dateFilterOptions = [
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

  const options = dateFilterOptions;

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

    filterTextHelper = `* Inventory status from the 1st day to the last day of the month of ${moment(
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

  const handleDateChange = (datetimeString, date) => {
    setDateString(() => datetimeString);
    setDate(() => date);
  };

  const handleCategoryFilterChange = categoryId => {
    setItemLogListFilters(currentValues => {
      return {
        ...currentValues,
        'items.category_id': categoryId,
      };
    });
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
    }
  };

  const renderDateFilterOptions = () => {
    return (
      <View style={styles.bottomSheetContent}>
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
      </View>
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
                // // showDatepicker();
                toggleOpenMonthPicker(() => true);
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
      <RNModal
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
      </RNModal>
      {/* <MonthPickerModal value={dateString} onChange={handleDateChange} />
      <CurrentMonthYearHeading date={date} /> */}
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
            {/* <MoreSelectionButton
              label="Operation"
              renderValueCurrentValue={listFilters['operations.id']}
              renderValue={() =>
                renderSelectedOperationValue(
                  getOperationStatus,
                  getOperationData,
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
            /> */}
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
        <View>
          <FiltersList
            filters={categoryFilterSelections}
            value={listFilters['items.category_id']}
            onChange={handleCategoryFilterChange}
            item
            containerStyle={{
              paddingTop: 15,
              paddingBottom: 15,
              backgroundColor: colors.surface,
            }}
          />
        </View>
        <ItemCustomReportTabularList
          filter={listFilters}
          dateFilter={startDatetimeString}
          highlightedItemId={highlightedItemId}
          selectedMonthYearDateFilter={selectedMonthYearDateFilter}
          dateRangeFilter={dateRangeFilter}
          monthToDateFilter={monthToDateFilter}
        />
        {/* <CustomReportsFileExport
          filter={listFilters}
          dateFilter={startDatetimeString}
        /> */}
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

export default CustomReportByItem;
