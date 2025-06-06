import React, {useState, useEffect} from 'react';
import {useRoute} from '@react-navigation/native';
import {StyleSheet, Text, View, FlatList, RefreshControl} from 'react-native';
import {
  Button,
  useTheme,
  DataTable,
  Modal,
  Portal,
  Dialog,
  Paragraph,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';
import SalesOrderDetails from '../components/salesOrders/SalesOrderDetails';
import {getSalesOrderGroup} from '../localDbQueries/salesOrders';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import SalesOrderItemList from '../components/salesOrders/SalesOrderItemList';
import SalesOrderFulfilledCounter from '../components/salesOrders/SalesOrderFulfilledCounter';

const SalesOrderGroupView = props => {
  const {navigation} = props;
  const route = useRoute();
  const {colors} = useTheme();
  const salesOrderGroupId = route.params?.sales_order_group_id;
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
  }, [route?.params?.salesConfirmationSuccess]);

  if (!salesOrderGroupId) return null;

  const {status: salesOrderGroupStatus, data: salesOrderGroupData} = useQuery(
    ['salesOrderGroup', {id: salesOrderGroupId}],
    getSalesOrderGroup,
  );

  if (salesOrderGroupStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (salesOrderGroupStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const salesOrderGroup = salesOrderGroupData.result;

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
                ? `Your fulfilled sales orders have been successfully recorded and added to your sales invoices.`
                : `Your sales entries have been successfully added to sales orders list.`}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setSuccessDialogVisibleAndType(() => '');
              }}>
              Okay
            </Button>
            {/* <Button
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
            </Button> */}
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <View style={styles.container}>
        <SalesOrderDetails
          salesOrderGroup={salesOrderGroup}
          containerStyle={{marginBottom: 5}}
        />
        {/* <SalesOrderFulfilledCounter /> */}
        <View
          style={{
            marginBottom: 3,
            paddingHorizontal: 15,
            paddingVertical: 10,
            backgroundColor: colors.surface,
          }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: 'bold',
            }}>
            {'Order list'}
          </Text>
        </View>

        <View style={{flex: 1}}>
          <SalesOrderItemList salesOrderGroupId={salesOrderGroupId} />
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SalesOrderGroupView;
