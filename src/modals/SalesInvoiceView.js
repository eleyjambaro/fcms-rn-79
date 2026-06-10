import React from 'react';
import {useRoute} from '@react-navigation/native';
import {StyleSheet, Text, View, FlatList, RefreshControl} from 'react-native';
import {Button, useTheme, DataTable, Modal, Portal} from 'react-native-paper';
import commaNumber from 'comma-number';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import SalesInvoiceTotals from '../components/salesCounter/SalesInvoiceTotals';
import SalesInvoiceDetails from '../components/salesInvoices/SalesInvoiceDetails';
import {
  getSalesInvoice,
  getSalesInvoiceItems,
  getSalesInvoiceGrandTotal,
  getSalesInvoiceTotals,
} from '../localDbQueries/salesInvoices';
import {getCompany} from '../localDbQueries/companies';
import ListLoadingFooter from '../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import useCurrencySymbol from '../hooks/useCurrencySymbol';
import useDefaultPrinterContext from '../hooks/useDefaultPrinterContext';
import {formatUOMAbbrev} from '../utils/stringHelpers';
import SalesInvoiceItemListItem from '../components/salesInvoices/SalesInvoiceItemListItem';
import {printSalesInvoice} from '../utils/printHelpers';

const SalesInvoiceView = () => {
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const route = useRoute();
  const invoiceId = route.params?.invoice_id;

  const {status: salesInvoiceStatus, data: salesInvoiceData} = useQuery(
    ['salesInvoice', {id: invoiceId}],
    getSalesInvoice,
  );
  const {
    status: salesInvoiceGrandTotalStatus,
    data: salesInvoiceGrandTotalData,
  } = useQuery(
    ['salesInvoiceGrandTotal', {id: invoiceId}],
    getSalesInvoiceGrandTotal,
  );
  const {data: salesInvoiceTotalsData} = useQuery(
    ['salesInvoiceTotals', {id: invoiceId}],
    getSalesInvoiceTotals,
  );
  const {
    data: salesInvoiceItemsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: salesInvoiceItemsStatus,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(
    ['salesInvoiceItems', {filter: {}, invoiceId}],
    getSalesInvoiceItems,
    {
      getNextPageParam: (lastPage, pages) => {
        let pagesResult = [];

        for (let page of pages) {
          pagesResult.push(...page.result);
        }

        if (pagesResult.length < lastPage.totalCount) {
          return lastPage.page + 1;
        }
      },
      networkMode: 'always',
    },
  );

  const {status: getCompanyStatus, data: getCompanyData} = useQuery(
    ['company'],
    getCompany,
  );

  const {isLoading: isLoadingDefaultPrinter, printText} =
    useDefaultPrinterContext();

  // Early return AFTER all hooks so hook call order stays stable across renders
  // (React rules-of-hooks). The queries above are keyed on invoiceId and no-op
  // safely when it is missing; nothing below renders in that case.
  if (!invoiceId) return null;

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (salesInvoiceItemsData.pages) {
      for (let page of salesInvoiceItemsData.pages) {
        pagesData.push(...page.result);
      }
    }

    return pagesData;
  };

  const handlePressPrint = async () => {
    if (
      isLoadingDefaultPrinter ||
      salesInvoiceStatus === 'loading' ||
      salesInvoiceItemsStatus === 'loading' ||
      salesInvoiceGrandTotalStatus === 'loading' ||
      getCompanyStatus === 'loading'
    ) {
      return;
    }

    if (
      salesInvoiceStatus === 'error' ||
      salesInvoiceItemsStatus === 'error' ||
      salesInvoiceGrandTotalStatus === 'error' ||
      getCompanyStatus === 'error'
    ) {
      return;
    }

    const salesInvoice = salesInvoiceData.result;
    const grandTotal = salesInvoiceGrandTotalData || 0;
    // Mirror the on-screen breakdown on the printout. printSalesInvoice expects
    // `totalTaxableAmount`; our Taxable line is the net of taxable sales.
    const salesInvoiceTotals = {
      grandTotalAmount: salesInvoiceTotalsData?.grandTotalAmount ?? grandTotal,
      totalTaxableAmount: salesInvoiceTotalsData?.totalTaxableNetAmount ?? 0,
      totalTaxExemptAmount: salesInvoiceTotalsData?.totalTaxExemptAmount ?? 0,
      totalTaxAmount: salesInvoiceTotalsData?.totalTaxAmount ?? 0,
    };
    const company = getCompanyData?.result;

    // printText is self-sufficient: it ensures Bluetooth is on and the printer
    // is connected (reading the live BT state), then prints.
    await printText(
      printSalesInvoice({
        salesInvoice,
        salesInvoiceItems: getAllPagesData(),
        salesInvoiceTotals,
        company,
      }),
    );
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const __renderItem = ({item}) => {
    return (
      <DataTable.Row>
        <DataTable.Cell>{item.name}</DataTable.Cell>
        <DataTable.Cell numeric>{`${currencySymbol} ${commaNumber(
          item.sale_unit_selling_price,
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>{`${item.sale_qty} ${formatUOMAbbrev(
          item.uom_abbrev,
        )}`}</DataTable.Cell>
        <DataTable.Cell numeric>
          {`${currencySymbol} ${commaNumber(item.subtotal_amount)}`}
        </DataTable.Cell>
      </DataTable.Row>
    );
  };

  const renderItem = ({item}) => {
    return (
      <SalesInvoiceItemListItem item={item} displayMode={'display-sale-qty'} />
    );
  };

  if (
    salesInvoiceStatus === 'loading' ||
    salesInvoiceItemsStatus === 'loading' ||
    getCompanyStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    salesInvoiceStatus === 'error' ||
    salesInvoiceItemsStatus === 'error' ||
    getCompanyStatus === 'error'
  ) {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const salesInvoice = salesInvoiceData.result;
  const pagesData = getAllPagesData();

  return (
    <View style={styles.container}>
      <SalesInvoiceDetails
        salesInvoice={salesInvoice}
        containerStyle={{marginBottom: 5}}
        handlePressPrint={handlePressPrint}
      />

      <View style={{flex: 1, backgroundColor: colors.surface}}>
        <FlatList
          data={pagesData}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
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
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              colors={[colors.primary, colors.accent, colors.dark]}
            />
          }
        />
      </View>
      <SalesInvoiceTotals
        saleTotals={
          salesInvoiceTotalsData || {
            grandTotalAmount: salesInvoiceGrandTotalData || 0,
          }
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SalesInvoiceView;
