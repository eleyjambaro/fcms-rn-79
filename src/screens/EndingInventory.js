import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';
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
import {
  Button,
  useTheme,
  DataTable,
  Modal,
  Portal,
  Searchbar,
} from 'react-native-paper';
import {useQuery} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import MonthPickerModal from '../components/modals/MonthPickerModal';
import CurrentMonthYearHeading from '../components/foodCostAnalysis/CurrentMonthYearHeading';
import ItemEndingInventoryList from '../components/items/ItemEndingInventoryList';
import FiltersList from '../components/buttons/FiltersList';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {getCategories} from '../localDbQueries/categories';
import EndingInventoryReportFileExport from '../components/reports/EndingInventoryReportFileExport';
import useSearchbarContext from '../hooks/useSearchbarContext';
import useWindowProperties from '../hooks/useWindowProperties';
import {ScrollView} from 'react-native-gesture-handler';

const EndingInventory = () => {
  const {colors} = useTheme();
  const route = useRoute();
  const highlightedItemId = route?.params?.highlightedItemId;
  const {keyword, setKeyword} = useSearchbarContext();
  const navigation = useNavigation();
  const {isLandscapeMode} = useWindowProperties();
  const {status: categoriesStatus, data: categoriesData} = useQuery(
    ['categories', {}],
    getCategories,
  );
  const [listFilters, setItemLogListFilters] = useState({
    'items.category_id': '',
    'operations.id': '',
    '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
  });

  const [dateString, setDateString] = useState('');
  const [date, setDate] = useState(new Date());

  const onChangeSearch = keyword => {
    setKeyword(keyword);

    setItemLogListFilters(currentValues => {
      return {
        ...currentValues,
        '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
      };
    });
  };

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

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
    <View style={styles.container}>
      <View style={[styles.wrapper, isLandscapeMode && {flexDirection: 'row'}]}>
        <View style={(styles.section, isLandscapeMode && {maxWidth: 384})}>
          <ScrollView>
            <MonthPickerModal value={dateString} onChange={handleDateChange} />
            <CurrentMonthYearHeading date={date} />
            <View style={{flexDirection: 'row', padding: 10}}>
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
            <FiltersList
              filters={categoryFilterSelections}
              value={listFilters['items.category_id']}
              onChange={handleCategoryFilterChange}
              item
              containerStyle={{
                paddingTop: 10,
                paddingBottom: 10,
                backgroundColor: colors.surface,
              }}
            />
          </ScrollView>
        </View>

        <View
          style={[
            isLandscapeMode
              ? styles.dividerForLandscape
              : styles.dividerForPortrait,
            {backgroundColor: colors.neutralTint5},
          ]}
        />

        <ItemEndingInventoryList
          filter={listFilters}
          dateFilter={dateString}
          monthYearDateFilter={dateString}
          highlightedItemId={highlightedItemId}
        />
      </View>

      <EndingInventoryReportFileExport
        filter={listFilters}
        dateFilter={dateString}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
  },
  section: {
    borderColor: 'red',
    borderWidth: 2,
  },
  dividerForLandscape: {
    width: 4,
  },
  dividerForPortrait: {
    height: 5,
  },
});

export default EndingInventory;
