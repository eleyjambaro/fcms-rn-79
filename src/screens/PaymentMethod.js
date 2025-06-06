import {StyleSheet, Text, View} from 'react-native';
import React, {useState} from 'react';
import {useTheme} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import CashPaymentForm from '../components/forms/CashPaymentForm';
import useSalesCounterContext from '../hooks/useSalesCounterContext';
import {
  addSaleEntriesToSalesOrders,
  confirmFulfillingSalesOrders,
  confirmSaleEntries,
} from '../localDbQueries/salesCounter';
import {getCompany} from '../localDbQueries/companies';
import routes from '../constants/routes';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import useDefaultPrinterContext from '../hooks/useDefaultPrinterContext';
import {printSalesInvoice} from '../utils/printHelpers';

const PaymentMethod = props => {
  const {route} = props;
  const transactionDate = route?.params?.transaction_date;
  const reviewMode = route?.params?.review_mode;
  const salesOrderGroupId = route?.params?.sales_order_group_id;
  const routeToGoBack = route?.params?.route_to_go_back;

  const navigation = useNavigation();
  const {colors} = useTheme();
  const [{saleTotals, saleItems}, actions] = useSalesCounterContext();
  const {
    isLoading: isLoadingDefaultPrinter,
    bluetoothState,
    printerState,
    initializeAndConnectToPrinter,
    printText,
    enableBluetoothDirectly,
  } = useDefaultPrinterContext();

  const {status: getCompanyStatus, data: getCompanyData} = useQuery(
    ['company'],
    getCompany,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limitReachedMessage, setLimitReachedMessage] = useState('');
  const [action, setAction] = useState(
    reviewMode === 'new-sales-order'
      ? 'add-to-sales-order'
      : reviewMode === 'fulfilling-sales-order'
      ? 'confirm-fulfilling-sales-order'
      : 'proceed-to-sales-invoice',
  );

  const queryClient = useQueryClient();
  const confirmSaleEntriesMutation = useMutation(confirmSaleEntries, {
    onSuccess: () => {
      queryClient.invalidateQueries('items');
    },
  });

  const addSaleEntriesToSalesOrdersMutation = useMutation(
    addSaleEntriesToSalesOrders,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('salesOrderGroups');
      },
    },
  );

  const confirmFulfillingSalesOrdersMutation = useMutation(
    confirmFulfillingSalesOrders,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('salesOrderGroupItems');
        queryClient.invalidateQueries('items');
      },
    },
  );

  const getListData = () => {
    let listData = [];

    if (saleItems) {
      for (let itemId in saleItems) {
        let item = saleItems[itemId];
        listData.push(item);
      }
    }

    return listData;
  };

  const printReceipt = async ({salesInvoice, salesInvoiceItems}) => {
    if (isLoadingDefaultPrinter || getCompanyStatus === 'loading') {
      return;
    }

    if (getCompanyStatus === 'error') {
      return;
    }

    const company = getCompanyData?.result;

    try {
      if (bluetoothState === 'PoweredOff') {
        enableBluetoothDirectly();
      } else if (
        bluetoothState === 'PoweredOn' &&
        printerState !== 'connected'
      ) {
        initializeAndConnectToPrinter();
      } else if (
        bluetoothState === 'PoweredOn' &&
        printerState === 'connected'
      ) {
        printText(
          printSalesInvoice({
            salesInvoice,
            salesInvoiceItems,
            salesInvoiceTotals: saleTotals,
            company,
          }),
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmSaleEntries = async (
    items,
    paymentFormValues,
    _paymentFormActions,
  ) => {
    try {
      setIsSubmitting(() => true);
      await confirmSaleEntriesMutation.mutateAsync({
        saleDate: transactionDate,
        saleItems: items,
        paymentFormValues,
        onLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: async ({salesInvoice}) => {
          actions?.resetSalesCounter();

          await printReceipt({salesInvoice, salesInvoiceItems: items});

          // Pass and merge params back to previous screen
          navigation.navigate({
            name: routeToGoBack || routes.counter(),
            // pass date instead of boolean in
            // order to run useEffect due to different
            // Date.now value
            params: {salesConfirmationSuccess: Date.now().toString()},
            merge: true,
          });
        },
      });
    } catch (error) {
      console.debug(error);
      throw error;
    } finally {
      setIsSubmitting(() => false);
    }
  };

  const handleAddSaleEntriesToSalesOrders = async items => {
    try {
      setIsSubmitting(() => true);
      await addSaleEntriesToSalesOrdersMutation.mutateAsync({
        orderDate: transactionDate,
        saleItems: items,
        onLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: () => {
          actions?.resetSalesCounter();

          // Pass and merge params back to previous screen
          navigation.navigate({
            name: routeToGoBack,
            // pass date instead of boolean in
            // order to run useEffect due to different
            // Date.now value
            params: {addSalesOrdersSuccess: Date.now().toString()},
            merge: true,
          });
        },
      });
    } catch (error) {
      console.debug(error);
      throw error;
    } finally {
      setIsSubmitting(() => false);
    }
  };

  const handleConfirmFulfillingSalesOrders = async (
    items,
    paymentFormValues,
    _paymentFormActions,
  ) => {
    try {
      setIsSubmitting(() => true);
      await confirmFulfillingSalesOrdersMutation.mutateAsync({
        saleDate: transactionDate,
        salesOrderGroupId,
        saleItems: items,
        paymentFormValues,
        onLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: () => {
          actions?.resetSalesCounter();

          const dateNowString = Date.now().toString();

          const params = {addSalesOrdersSuccess: dateNowString};

          if (action === 'proceed-to-sales-invoice') {
            params.salesConfirmationSuccess = dateNowString;
          }

          // Pass and merge params back to previous screen
          navigation.navigate({
            name: routeToGoBack,
            // pass date instead of boolean in
            // order to run useEffect due to different
            // Date.now value
            params,
            merge: true,
          });
        },
      });
    } catch (error) {
      console.debug(error);
      throw error;
    } finally {
      setIsSubmitting(() => false);
    }
  };

  const handleSubmit = (items, paymentFormValues, paymentFormActions) => {
    if (action === 'proceed-to-sales-invoice') {
      handleConfirmSaleEntries(items, paymentFormValues, paymentFormActions);
    } else if (action === 'add-to-sales-order') {
      handleAddSaleEntriesToSalesOrders(items);
    } else if (action === 'confirm-fulfilling-sales-order') {
      handleConfirmFulfillingSalesOrders(
        items,
        paymentFormValues,
        paymentFormActions,
      );
    }
  };

  const items = getListData();

  return (
    <>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <CashPaymentForm
          initialValues={{
            total_amount_due: saleTotals?.grandTotalAmount?.toString(),
            payment_amount: '',
          }}
          onSubmit={(values, actions) => {
            handleSubmit(items, values, actions);
          }}
          onCancel={() => navigation.goBack()}
          handleCardPayment={(values, actions) =>
            handleSubmit(items, values, actions)
          }
        />
      </View>
    </>
  );
};

export default PaymentMethod;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
  },
});
