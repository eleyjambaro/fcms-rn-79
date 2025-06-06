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

import MonthPickerModal from '../components/modals/MonthPickerModal';
import CurrentMonthYearHeading from '../components/foodCostAnalysis/CurrentMonthYearHeading';
import RevenueTabularList from '../components/revenues/RevenueTabularList';

const Revenues = () => {
  const {colors} = useTheme();
  const route = useRoute();
  const highlightedItemId = route?.params?.highlightedItemId;
  const navigation = useNavigation();

  const [dateString, setDateString] = useState('');
  const [date, setDate] = useState(new Date());

  const handleDateChange = (datetimeString, date) => {
    setDateString(() => datetimeString);
    setDate(() => date);
  };

  return (
    <>
      <MonthPickerModal value={dateString} onChange={handleDateChange} />
      <CurrentMonthYearHeading date={date} />
      <View style={styles.container}>
        <RevenueTabularList
          dateFilter={dateString}
          highlightedItemId={highlightedItemId}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default Revenues;
