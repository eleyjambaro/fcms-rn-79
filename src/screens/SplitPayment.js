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

import SplitPaymentForm from '../components/forms/SplitPaymentForm';
import useSalesCounterContext from '../hooks/useSalesCounterContext';
import {
  confirmFulfillingSalesOrders,
  confirmSaleEntries,
} from '../localDbQueries/salesCounter';
import routes from '../constants/routes';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import useDefaultPrinterContext from '../hooks/useDefaultPrinterContext';
import useCloudAuthContext from '../hooks/useCloudAuthContext';
import useCurrencySymbol from '../hooks/useCurrencySymbol';
import {printSalesInvoice} from '../utils/printHelpers';
import {
  getCashierDisplayName,
  getPaymentBreakdownFromFormValues,
} from '../utils/stringHelpers';
import {runSync} from '../services/syncService';

const SplitPayment = props => {
  const {route} = props;
  const transactionDate = route?.params?.transaction_date;
  const reviewMode = route?.params?.review_mode;
  const salesOrderGroupId = route?.params?.sales_order_group_id;
  const routeToGoBack = route?.params?.route_to_go_back;

  const navigation = useNavigation();
  const {colors} = useTheme();
  const [{saleTotals, saleItems}, actions] = useSalesCounterContext();
  const {isLoading: isLoadingDefaultPrinter, printText} =
    useDefaultPrinterContext();
  const [cloudAuthState] = useCloudAuthContext();
  const currencySymbol = useCurrencySymbol();

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

  const printReceipt = async ({
    salesInvoice,
    salesInvoiceItems,
    paymentFormValues,
  }) => {
    if (isLoadingDefaultPrinter) {
      return;
    }

    // Receipt header sourced from cloud auth context (offline-safe, from secure
    // storage): full company name, branch name, and branch address.
    const {authUser, designatedBranch, deviceCompanyInfo} = cloudAuthState;
    const company = {
      name: deviceCompanyInfo?.name ?? authUser?.company?.name ?? '',
      branch_name: designatedBranch?.name ?? '',
      branch_address: designatedBranch?.address ?? '',
    };

    // printText is self-sufficient: it ensures Bluetooth is on and the printer
    // is connected (reading the live BT state), then prints.
    await printText(
      printSalesInvoice({
        salesInvoice,
        salesInvoiceItems,
        salesInvoiceTotals: saleTotals,
        payment: getPaymentBreakdownFromFormValues(paymentFormValues),
        cashier: getCashierDisplayName(authUser?.account),
        company,
        currencySymbol,
      }),
    );
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

          await printReceipt({
            salesInvoice,
            salesInvoiceItems: items,
            paymentFormValues,
          });

          // Pop back to the previous screen (e.g. Sales Register) and merge
          // params. popTo (not navigate) removes the payment screens from the
          // stack; in React Navigation v7 navigate would PUSH a new instance
          // on top, leaving them underneath so Back returns to them.
          navigation.popTo(
            routeToGoBack || routes.counter(),
            // pass date instead of boolean in
            // order to run useEffect due to different
            // Date.now value
            {salesConfirmationSuccess: Date.now().toString()},
            {merge: true},
          );
          runSync().catch(console.warn);
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

          // Pop back to the previous screen and merge params (see note above —
          // popTo removes the payment screens, navigate would push duplicates).
          navigation.popTo(routeToGoBack, params, {merge: true});
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
        <SplitPaymentForm
          initialValues={{
            total_amount_due: saleTotals?.grandTotalAmount?.toString(),
          }}
          onSubmit={(values, actions) => {
            handleSubmit(items, values, actions);
          }}
          onCancel={() => navigation.goBack()}
        />
      </View>
    </>
  );
};

export default SplitPayment;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
  },
});
