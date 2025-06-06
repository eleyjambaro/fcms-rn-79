import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, Pressable, View} from 'react-native';
import {Button, Searchbar, useTheme} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import routes from '../constants/routes';
import ItemList from '../components/salesCounter/ItemList';
import useSearchbarContext from '../hooks/useSearchbarContext';

const SalesCounterItems = props => {
  const {
    navigation,
    filter,
    counterMode,
    viewMode,
    listItemDisplayMode,
    showScanBarcodeButton = true,
    showActionButtons = false,
  } = props;
  const {colors} = useTheme();
  const {keyword, setKeyword} = useSearchbarContext();
  const listFilter = filter ? filter : {};

  const onChangeSearch = keyword => setKeyword(keyword);

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const handlePressScanBarcode = () => {
    navigation.navigate('ScanBarcode');
  };

  const handlePressCreateNew = () => {
    navigation.navigate('AddItem');
  };

  const renderScanBarcodeButton = () => {
    if (showScanBarcodeButton) {
      return (
        <Pressable
          onPress={handlePressScanBarcode}
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
        </Pressable>
      );
    }
  };

  return (
    <View style={{flex: 1}}>
      <View style={{flexDirection: 'row', padding: 5}}>
        <Searchbar
          placeholder="Search item"
          onChangeText={onChangeSearch}
          value={keyword}
          style={{flex: 1}}
        />
        {renderScanBarcodeButton()}
      </View>

      <View style={{flex: 1}}>
        <ItemList
          filter={{
            ...listFilter,
            '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
            // '%OR LIKE': {key: 'items.barcode', value: `'${keyword}'`},
          }}
          counterMode={counterMode}
          viewMode={viewMode}
          listItemDisplayMode={listItemDisplayMode}
          displaySellableItemIndicator
        />
      </View>

      {showActionButtons && (
        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button
            mode="contained"
            icon="chevron-right"
            contentStyle={{flexDirection: 'row-reverse'}}
            onPress={() => {
              navigation.navigate(routes.confirmSales());
            }}>
            {counterMode === 'sales-order-register'
              ? `Review Sales Order`
              : `Review Sales`}
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default SalesCounterItems;
