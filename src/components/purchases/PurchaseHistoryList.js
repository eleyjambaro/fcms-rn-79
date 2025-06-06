import React, {useState, useRef, useMemo, useCallback} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Button, useTheme} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {BottomSheetModal, BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import PurchaseHistoryListItem from './PurchaseHistoryListItem';
import routes from '../../constants/routes';
import GrandTotal from './GrandTotal';
import MoreSelectionButton from '../buttons/MoreSelectionButton';
import CheckboxSelection from '../forms/CheckboxSelection';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import {getBatchPurchaseGroups} from '../../localDbQueries/batchPurchase';

const PurchaseHistoryList = props => {
  const {filter} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [date, setDate] = useState(new Date());
  const [dateTimePickerMode, setDateTimePivkerMode] = useState('date');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState({
    label: 'Date Range',
    value: 'date-range',
  });
  // start-date or end-date
  const [dateRangeInputType, setDateRangeInputType] = useState('start-date');
  const [dateFilter, setDateFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const durationOptions = [
    {
      label: 'All',
      value: 'all',
    },
    {
      label: 'Date Range',
      value: 'date-range',
    },
  ];
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
    ['batchPurchaseGroups', {filter: {...filter, __dateFilter: dateFilter}}],
    getBatchPurchaseGroups,
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

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, durationOptions.length * 100],
    [],
  );

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

  const showMode = currentMode => {
    setShowCalendar(true);
    setDateTimePivkerMode(currentMode);
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

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const handleDateTimePickerChange = (_event, selectedDate) => {
    const currentSelectedDate = selectedDate || date;
    setShowCalendar(Platform.OS === 'ios');
    setDate(currentSelectedDate);

    const month = ('0' + (currentSelectedDate.getMonth() + 1)).slice(-2);
    const day = ('0' + currentSelectedDate.getDate()).slice(-2);
    const year = currentSelectedDate.getFullYear();

    const dateString = `${year}-${month}-${day}`;
    const startDate = dateRangeInputType === 'start-date';

    if (selectedDuration?.value === 'date-range') {
      setDateFilter(() => ({
        isDateRange: true,
        startDate: dateString,
        endDate: dateString,
        dateFieldName: 'date_confirmed',
      }));
    }
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
      <View style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Select duration'}
        </Text>
        <CheckboxSelection
          options={durationOptions}
          value={selectedDuration.value}
          onChange={(selectedValue, selectedLabel) => {
            setSelectedDuration(() => ({
              label: selectedLabel,
              value: selectedValue,
            }));
            closeOptionsBottomSheet();
          }}
        />
      </View>
    );
  };

  const renderItem = ({item}) => {
    return (
      <PurchaseHistoryListItem
        item={item}
        onPress={() => {
          navigation.navigate('PurchaseListHistoryView', {
            purchaseList: item,
            batch_purchase_group_id: item.id,
          });
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

  const pagesData = getAllPagesData();
  const grandTotal = pagesData.reduce((currentTotal, purchaseEntry) => {
    return currentTotal + purchaseEntry.total_cost;
  }, 0);

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
      {/* <View
        style={{padding: 10, backgroundColor: colors.surface, marginBottom: 5}}>
        <View>
          <View
            style={{
              marginVertical: 5,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
            }}>
            <MoreSelectionButton
              label="Select Duration"
              value={selectedDuration.label} // display label as value
              containerStyle={{flex: 1}}
              onPress={openOptionsBottomSheet}
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
        </View>
        {selectedDuration?.value === 'date-range' && (
          <View style={{flexDirection: 'row'}}>
            <View style={{flex: 1, marginRight: 2.5}}>
              <Text
                style={{textAlign: 'center', marginVertical: 4, fontSize: 12}}>
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
                style={{textAlign: 'center', marginVertical: 4, fontSize: 12}}>
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
      </View> */}
      <FlatList
        data={pagesData}
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
              backgroundColor: colors.surface,
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
      {/* <GrandTotal value={grandTotal} /> */}
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

export default PurchaseHistoryList;
