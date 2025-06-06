import React, {useState, useRef, useMemo, useCallback} from 'react';
import {StyleSheet, Text, View, ScrollView, FlatList} from 'react-native';
import {
  Title,
  DataTable,
  Modal,
  Portal,
  Button,
  useTheme,
  Subheading,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {BottomSheetModal, BottomSheetBackdrop} from '@gorhom/bottom-sheet';

import GrandTotal from '../components/purchases/GrandTotal';
import MoreSelectionButton from '../components/buttons/MoreSelectionButton';
import CheckboxSelection from '../components/forms/CheckboxSelection';
import useCurrencySymbol from '../hooks/useCurrencySymbol';

const FoodMenuMix = () => {
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const [date, setDate] = useState(new Date());
  const [dateTimePickerMode, setDateTimePivkerMode] = useState('date');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState({
    label: 'This Month',
    value: 'this-month',
  });
  const durationOptions = [
    {
      label: 'All',
      value: 'all',
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

  const costAndSalesData = [
    {
      name: 'Total Food',
      cost: 0.0,
      sales: 0.0,
    },
    {
      name: 'Total Beverage',
      cost: 0.0,
      sales: 0.0,
    },
    {
      name: 'Grand Total',
      cost: 0.0,
      sales: 0.0,
    },
  ];

  const compsAndSpoilageData = [
    {
      name: 'Total Comps',
      amount: 737164.8,
      costPercentage: 11.68,
    },
    {
      name: 'Total Spoilage & Wastage',
      amount: 0,
      costPercentage: 0,
    },
    {
      name: 'Total',
      amount: 737164.8,
      costPercentage: 11.68,
    },
  ];

  const idealFoodCost = 1715405.43;
  const idealFoodCostPercentage = 27.9;
  const actualFoodCost = 1829619.86;
  const actualFoodCostPercentage = 28.9;
  const difference = actualFoodCost - idealFoodCost;

  const foodCostData = [
    {
      name: 'Ideal Food Cost',
      amount: idealFoodCost,
      costPercentage: idealFoodCostPercentage,
    },
    {
      name: 'Actual Food Cost',
      amount: actualFoodCost,
      costPercentage: actualFoodCostPercentage,
    },
    {
      name: 'Difference',
      amount: difference,
      costPercentage: 0,
    },
  ];

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, durationOptions.length * 85],
    [],
  );

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
    const currentDate = selectedDate || date;
    setShowCalendar(Platform.OS === 'ios');
    setDate(currentDate);

    if (selectedDate) {
      const monthOfBirth = ('0' + (selectedDate.getMonth() + 1)).slice(-2);
      const dayOfBirth = ('0' + selectedDate.getDate()).slice(-2);
      const yearOfBirth = selectedDate.getFullYear();
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
          defaultSelectedOption={selectedDuration}
          onChange={selectedOption => {
            setSelectedDuration(() => selectedOption);
            closeOptionsBottomSheet();
          }}
        />
      </View>
    );
  };

  const renderCostAndSalesItem = ({item}) => {
    const grandTotalRowStyle = {
      backgroundColor: colors.neutralTint4,
    };
    const grandTotalFontStyle = {
      fontWeight: 'bold',
    };

    return (
      <DataTable.Row style={item.name === 'Grand Total' && grandTotalRowStyle}>
        <DataTable.Cell>
          <Text style={item.name === 'Grand Total' && grandTotalFontStyle}>
            {item.name}
          </Text>
        </DataTable.Cell>
        <DataTable.Cell numeric>
          <Text
            style={
              item.name === 'Grand Total' && grandTotalFontStyle
            }>{`${currencySymbol} ${commaNumber(item.cost)}`}</Text>
        </DataTable.Cell>
        <DataTable.Cell numeric>
          <Text
            style={
              item.name === 'Grand Total' && grandTotalFontStyle
            }>{`${currencySymbol} ${commaNumber(item.sales)}`}</Text>
        </DataTable.Cell>
      </DataTable.Row>
    );
  };

  const renderItem = ({item}) => {
    const idealFoodCostFontStyle = {
      fontWeight: 'bold',
      color: colors.accent,
    };
    const differenceRowStyle = {
      backgroundColor: 'rgba(247, 47, 53, 0.3)',
    };
    const differenceFontStyle = {
      fontWeight: 'bold',
    };

    return (
      <DataTable.Row style={item.name === 'Difference' && differenceRowStyle}>
        <DataTable.Cell>
          <Text
            style={
              item.name === 'Difference' || item.name === 'Total'
                ? differenceFontStyle
                : item.name === 'Ideal Food Cost'
                ? idealFoodCostFontStyle
                : {}
            }>
            {item.name}
          </Text>
        </DataTable.Cell>
        <DataTable.Cell numeric>
          <Text
            style={
              item.name === 'Difference' || item.name === 'Total'
                ? differenceFontStyle
                : item.name === 'Ideal Food Cost'
                ? {fontWeight: 'bold'}
                : {}
            }>{`${currencySymbol} ${commaNumber(
            item.amount.toFixed(2),
          )}`}</Text>
        </DataTable.Cell>
        <DataTable.Cell numeric>
          <Text
            style={
              item.name === 'Difference' ||
              (item.name === 'Total' && differenceFontStyle)
            }>{`${commaNumber(item.costPercentage)}%`}</Text>
        </DataTable.Cell>
      </DataTable.Row>
    );
  };

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
      <View
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
              value={selectedDuration.label}
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
      </View>
      <ScrollView style={styles.container}>
        <View style={styles.sectionContainer}>
          <Title>Food Cost Analysis Report</Title>
          <Subheading>Food & Beverage Sales (PMIX)</Subheading>
        </View>

        <DataTable
          style={{marginBottom: 5, backgroundColor: colors.surface}}
          collapsable={true}>
          <DataTable.Header>
            <DataTable.Title></DataTable.Title>
            <DataTable.Title numeric>COST</DataTable.Title>
            <DataTable.Title numeric>SALES</DataTable.Title>
          </DataTable.Header>
          <FlatList
            data={costAndSalesData}
            keyExtractor={item => item.name}
            renderItem={renderCostAndSalesItem}
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  padding: 20,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <Text>No data to display</Text>
              </View>
            }
          />
        </DataTable>

        <DataTable
          style={{marginBottom: 5, backgroundColor: colors.surface}}
          collapsable={true}>
          <DataTable.Header>
            <DataTable.Title></DataTable.Title>
            <DataTable.Title numeric>Amount</DataTable.Title>
            <DataTable.Title numeric>Cost Percentage</DataTable.Title>
          </DataTable.Header>
          <FlatList
            data={compsAndSpoilageData}
            keyExtractor={item => item.name}
            renderItem={renderItem}
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  padding: 20,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <Text>No data to display</Text>
              </View>
            }
          />
        </DataTable>

        <DataTable
          style={{flex: 1, backgroundColor: colors.surface}}
          collapsable={true}>
          <DataTable.Header>
            <DataTable.Title></DataTable.Title>
            <DataTable.Title numeric>Amount</DataTable.Title>
            <DataTable.Title numeric>Cost Percentage</DataTable.Title>
          </DataTable.Header>
          <FlatList
            data={foodCostData}
            keyExtractor={item => item.name}
            renderItem={renderItem}
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  padding: 20,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <Text>No data to display</Text>
              </View>
            }
          />
        </DataTable>
      </ScrollView>
      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button mode="contained" onPress={() => {}}>
          View Food Menu
        </Button>
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
  sectionContainer: {
    backgroundColor: 'white',
    paddingVertical: 15,
    paddingHorizontal: 10,
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

export default FoodMenuMix;
