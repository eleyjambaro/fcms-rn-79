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
import ItemTabularList from '../components/items/ItemTabularList';
import FiltersList from '../components/buttons/FiltersList';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {getCategories} from '../localDbQueries/categories';
import ReportsFileExport from '../components/reports/ReportsFileExport';

const MonthlyReportByItem = () => {
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

  const [dateString, setDateString] = useState('');
  const [date, setDate] = useState(new Date());

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
      <MonthPickerModal value={dateString} onChange={handleDateChange} />
      <CurrentMonthYearHeading date={date} />
      <View style={styles.container}>
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
        <ItemTabularList
          filter={listFilters}
          dateFilter={dateString}
          highlightedItemId={highlightedItemId}
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

export default MonthlyReportByItem;
