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
} from 'react-native';
import {Button, useTheme, DataTable, Modal, Portal} from 'react-native-paper';
import {useQuery} from '@tanstack/react-query';

import MonthPickerModal from '../components/modals/MonthPickerModal';
import CurrentMonthYearHeading from '../components/foodCostAnalysis/CurrentMonthYearHeading';
import CategoryTabularList from '../components/categories/CategoryTabularList';
import FiltersList from '../components/buttons/FiltersList';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {getCategories} from '../localDbQueries/categories';
import ReportsFileExport from '../components/reports/ReportsFileExport';
import {getRevenueGroups} from '../localDbQueries/revenues';

const MonthlyReportByCategory = () => {
  const {colors} = useTheme();
  const route = useRoute();
  const highlightedItemId = route?.params?.highlightedItemId;
  const navigation = useNavigation();
  const {status: revenueGroupsStatus, data: revenueGroupsData} = useQuery(
    ['revenueGroups', {limit: 100}],
    getRevenueGroups,
  );
  const [listFilters, setItemLogListFilters] = useState({
    'categories.revenue_group_id': '',
  });

  const [currentRevenueGroup, setCurrentRevenueGroup] = useState('');

  const [dateString, setDateString] = useState('');
  const [date, setDate] = useState(new Date());

  const handleDateChange = (datetimeString, date) => {
    setDateString(() => datetimeString);
    setDate(() => date);
  };

  const handleRevenueGroupFilterChange = (
    revenueGroupId,
    revenueGroupLabel,
  ) => {
    setItemLogListFilters(currentValues => {
      return {
        ...currentValues,
        'categories.revenue_group_id': revenueGroupId,
      };
    });

    setCurrentRevenueGroup(() => revenueGroupLabel);
  };

  if (revenueGroupsStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (revenueGroupsStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const revenueGroups = revenueGroupsData.result;

  if (!revenueGroups) return null;

  const revenueGroupFilterSelections = revenueGroups.map(revenueGroup => {
    return {
      label: revenueGroup.name,
      value: revenueGroup.id,
    };
  });

  revenueGroupFilterSelections.unshift({
    label: 'All',
    value: '',
  });

  return (
    <>
      <MonthPickerModal value={dateString} onChange={handleDateChange} />
      <CurrentMonthYearHeading date={date} />
      <View style={styles.container}>
        <View>
          <FiltersList
            filters={revenueGroupFilterSelections}
            value={listFilters['categories.revenue_group_id']}
            onChange={handleRevenueGroupFilterChange}
            containerStyle={{
              paddingTop: 15,
              paddingBottom: 15,
              backgroundColor: colors.surface,
            }}
          />
        </View>
        <CategoryTabularList
          filter={listFilters}
          dateFilter={dateString}
          highlightedItemId={highlightedItemId}
          currentRevenueGroup={currentRevenueGroup}
        />
        <ReportsFileExport filter={listFilters} dateFilter={dateString} />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MonthlyReportByCategory;
