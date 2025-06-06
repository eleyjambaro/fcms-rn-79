import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import SalesRegisterTicketItemList from '../components/salesCounter/SalesRegisterTicketItemList';
import SalesRegisterOptions from '../components/salesCounter/SalesRegisterOptions';

const ConfirmSales = props => {
  const {route} = props;
  const reviewMode = route?.params?.review_mode;
  const salesOrderGroupId = route?.params?.sales_order_group_id;
  const routeToGoBack = route?.params?.route_to_go_back;

  return (
    <View style={styles.container}>
      <SalesRegisterTicketItemList
        reviewMode={reviewMode}
        salesOrderGroupId={salesOrderGroupId}
        routeToGoBack={routeToGoBack}
      />
      <SalesRegisterOptions />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ConfirmSales;
