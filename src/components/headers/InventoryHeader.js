import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';
import {useQuery} from '@tanstack/react-query';

import {getTotalCategories, getTotalItems} from '../../localDbQueries/reports';

const InventoryHeader = () => {
  const {colors} = useTheme();
  const {
    data: totalItemsData,
    status: totalItemsStatus,
    error: totalItemsError,
    refetch: refetchTotalItems,
  } = useQuery(['totalItems'], getTotalItems);

  const {
    data: totalCategoriesData,
    status: totalCategoriesStatus,
    error: totalCategoriesError,
    refetch: refetchTotalCategories,
  } = useQuery(['totalCategories'], getTotalCategories);

  const renderTotalCategoriesValue = () => {
    if (totalCategoriesStatus === 'loading') return null;
    if (totalCategoriesStatus === 'error') return null;

    return (
      <>
        <Text
          style={{
            marginLeft: 7,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {`${commaNumber(parseFloat(totalCategoriesData?.result || 0))}`}
        </Text>
      </>
    );
  };

  const renderTotalItemsValue = () => {
    if (totalItemsStatus === 'loading') return null;
    if (totalItemsStatus === 'error') return null;

    return (
      <>
        <Text
          style={{
            marginLeft: 7,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {`${commaNumber(parseFloat(totalItemsData?.result || 0))}`}
        </Text>
      </>
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      <View style={[styles.detailsContainer]}>
        <View style={styles.detailsListItem}>
          <Text style={{fontWeight: 'bold'}}>Total Categories:</Text>
          {renderTotalCategoriesValue()}
        </View>
      </View>

      <View style={[styles.detailsContainer]}>
        <View style={styles.detailsListItem}>
          <Text style={{fontWeight: 'bold'}}>Total Items:</Text>
          {renderTotalItemsValue()}
        </View>
      </View>
    </View>
  );
};

export default InventoryHeader;

const styles = StyleSheet.create({
  container: {
    margin: 5,
    padding: 15,
    borderRadius: 5,
  },
  detailsContainer: {},
  detailsListItem: {
    marginLeft: 0,
    marginVertical: 3,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECECEC',
    padding: 10,
    borderRadius: 15,
  },
});
