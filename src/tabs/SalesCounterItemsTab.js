import React, {useEffect, useState} from 'react';
import {Dialog, Paragraph, Button, Portal, useTheme} from 'react-native-paper';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';

import SalesCounterItems from '../screens/SalesCounterItems';
import routes from '../constants/routes';
import SalesRegisterHeader from '../components/headers/SalesRegisterHeader';

const TopTab = createMaterialTopTabNavigator();

const SalesCounterItemsTab = props => {
  const {navigation, route, counterMode, viewMode, listItemDisplayMode} = props;
  const {colors} = useTheme();

  const [successDialogVisibleAndType, setSuccessDialogVisibleAndType] =
    useState('');

  useEffect(() => {
    if (route?.params?.salesConfirmationSuccess) {
      setSuccessDialogVisibleAndType(() => 'sales-confirmation-success');
      navigation.setParams({
        salesConfirmationSuccess: null,
        addSalesOrdersSuccess: null,
      });
    }

    if (route?.params?.addSalesOrdersSuccess) {
      setSuccessDialogVisibleAndType(() => 'add-sales-orders-success');
      navigation.setParams({
        salesConfirmationSuccess: null,
        addSalesOrdersSuccess: null,
      });
    }
  }, [
    route?.params?.salesConfirmationSuccess,
    route?.params?.addSalesOrdersSuccess,
  ]);

  return (
    <>
      <Portal>
        <Dialog
          visible={successDialogVisibleAndType}
          onDismiss={() => setSuccessDialogVisibleAndType(() => '')}>
          <Dialog.Title>Done!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {successDialogVisibleAndType === 'sales-confirmation-success'
                ? `Your sales have been successfully added to your sales invoices.`
                : `Your sales entries have been successfully added to sales orders list.`}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                if (
                  successDialogVisibleAndType === 'sales-confirmation-success'
                ) {
                  navigation.navigate(routes.salesInvoices());
                } else {
                  navigation.navigate(routes.salesOrderGroups());
                }
                setSuccessDialogVisibleAndType(() => '');
              }}
              color={colors.accent}>
              {successDialogVisibleAndType === 'sales-confirmation-success'
                ? `View Sales Invoices`
                : `View Sales Orders`}
            </Button>
            <Button
              onPress={() => {
                setSuccessDialogVisibleAndType(() => '');
              }}>
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <SalesRegisterHeader />

      <TopTab.Navigator
        screenOptions={() => ({
          tabBarScrollEnabled: true,
          tabBarStyle: {
            elevation: 0,
            borderBottomWidth: 2,
            borderColor: colors.neutralTint5,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.dark,
          tabBarPressColor: colors.primary,
          tabBarIndicatorStyle: {
            backgroundColor: colors.primary,
            height: 3,
          },
          tabBarLabelStyle: {
            textTransform: 'none',
            fontWeight: '500',
            fontSize: 14,
          },
        })}>
        <TopTab.Screen
          name="SalesCounterItems"
          options={{tabBarLabel: 'All Items'}}>
          {props => (
            <SalesCounterItems
              {...props}
              counterMode={counterMode}
              viewMode={viewMode}
              listItemDisplayMode={listItemDisplayMode}
            />
          )}
        </TopTab.Screen>
        <TopTab.Screen
          name="SalesCounterFinishedProducts"
          options={{tabBarLabel: 'Finished Products'}}>
          {props => (
            <SalesCounterItems
              {...props}
              filter={{'items.is_finished_product': 1}}
              counterMode={counterMode}
              viewMode={viewMode}
              listItemDisplayMode={listItemDisplayMode}
              showScanBarcodeButton={false}
            />
          )}
        </TopTab.Screen>
      </TopTab.Navigator>
    </>
  );
};

export default SalesCounterItemsTab;
