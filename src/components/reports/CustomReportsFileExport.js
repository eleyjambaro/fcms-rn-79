import React, {useState, useRef, useMemo, useCallback, useEffect} from 'react';
import {Link, useNavigation, useRoute} from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Dimensions,
  Pressable,
  RefreshControl,
  PermissionsAndroid,
  ToastAndroid,
  BackHandler,
  Linking,
} from 'react-native';
import {
  Button,
  useTheme,
  DataTable,
  Modal,
  Portal,
  Title,
  Dialog,
  Paragraph,
  Subheading,
  Headline,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import {useQuery, useInfiniteQuery} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as RNFS from 'react-native-fs';
import XLSX from 'xlsx';
import moment from 'moment';
import FileViewer from 'react-native-file-viewer';
import * as DocumentPicker from '@react-native-documents/picker';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import routes from '../../constants/routes';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import OptionsList from '../buttons/OptionsList';
import {
  getCategoriesMonthlyReport,
  getCategoriesMonthlyReportTotals,
  getItemsMonthlyReport,
  getItemsMonthlyReportTotals,
} from '../../localDbQueries/reports';
import MonthlyReportHeaderRight from '../headers/MonthlyReportHeaderRight';
import ReportsFileExportForm from '../forms/ReportsFileExportForm';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const CustomReportsFileExport = props => {
  const {dateFilter, highlightedItemId, filter = {}, backAction} = props;
  const {colors} = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const currencySymbol = useCurrencySymbol();

  const [
    exportNeedPermissionDialogVisible,
    setExportNeedPermissionDialogVisible,
  ] = useState(false);
  const [exportSuccessDialogVisible, setExportSuccessDialogVisible] =
    useState(false);
  const [exportFailedDialogVisible, setExportFailedDialogVisible] =
    useState(false);
  const [exportOptionsModalVisible, setExportOptionsModalVisible] =
    useState(false);
  const [exportOptions, setExportOptions] = useState({
    exportReportsByItem: false,
    exportReportsByCategory: false,
    seperateFile: false,
  });
  const [appSuggestionsModalVisible, setAppSuggestionsModalVisible] =
    useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [isFileExportLoading, setIsFileExportLoading] = useState(false);

  const {
    data: itemsMonthlyReportData,
    status: itemsMonthlyReportStatus,
    error: itemsMonthlyReportError,
    refetch: refetchItemsMonthlyReport,
  } = useQuery(
    ['itemsMonthlyReport', {dateFilter, filter, limit: 0}],
    getItemsMonthlyReport,
  );

  const {
    data: categoriesMonthlyReportData,
    status: categoriesMonthlyReportStatus,
    error: categoriesMonthlyReportError,
    refetch: refetchCategoriesMonthlyReport,
  } = useQuery(
    ['categoriesMonthlyReport', {dateFilter, filter, limit: 0}],
    getCategoriesMonthlyReport,
  );

  const {
    data: itemsMonthlyReportGrandTotalData,
    status: itemsMonthlyReportGrandTotalStatus,
  } = useQuery(
    [
      'itemsMonthlyReportGrandTotal',
      {dateFilter, filter: {...filter, 'items.category_id': ''}},
    ],
    getItemsMonthlyReportTotals,
  );

  const {
    data: categoriesMonthlyReportTotalsData,
    status: categoriesMonthlyReportTotalsStatus,
  } = useQuery(
    ['categoriesMonthlyReportTotals', {dateFilter}],
    getCategoriesMonthlyReportTotals,
  );

  const selectedMonthAndYear = moment(
    dateFilter ? new Date(dateFilter?.split(' ')?.[0]) : new Date(),
  ).format('MMMM YYYY');
  const fileName = `Monthly Report - ${selectedMonthAndYear}`;

  useEffect(() => {
    // Use `setOptions` to update the MonthlyReportHeaderRight component
    // Now the export button includes an `onPress` handler to handle file export
    navigation.setOptions({
      headerRight: () => (
        <MonthlyReportHeaderRight onPressMenuButton={openOptionsBottomSheet} />
      ),
    });
  }, [navigation]);

  const itemOptions = [
    {
      label: 'Export Report',
      icon: 'file-export-outline',
      handler: () => {
        handlePressExport();
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Downloads',
      icon: 'download-outline',
      handler: async () => {
        handlePressDownloads();
        closeOptionsBottomSheet();
      },
    },
  ];

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        backAction && backAction();
        closeOptionsBottomSheet();
      },
    );

    return () => backHandler.remove();
  }, []);

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, itemOptions.length * 80 + 35],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

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
      <BottomSheetView style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Options'}
        </Text>
        <OptionsList options={itemOptions} />
      </BottomSheetView>
    );
  };

  // function to handle exporting
  const exportDataToExcel = async options => {
    if (
      itemsMonthlyReportStatus === 'loading' ||
      categoriesMonthlyReportStatus === 'loading' ||
      itemsMonthlyReportGrandTotalStatus === 'loading' ||
      categoriesMonthlyReportTotalsStatus === 'loading'
    ) {
      return;
    }

    if (
      itemsMonthlyReportStatus === 'error' ||
      categoriesMonthlyReportStatus === 'error' ||
      itemsMonthlyReportGrandTotalStatus === 'error' ||
      categoriesMonthlyReportTotalsStatus === 'error'
    ) {
      return;
    }

    if (!options.sheets?.length > 0) {
      return;
    }

    let workbook = XLSX.utils.book_new();

    /**
     * Items sheet
     */

    let itemsDataToExport = itemsMonthlyReportData?.result;
    let itemsGrandTotalData = itemsMonthlyReportGrandTotalData?.totals;

    const selectedMonthAllItemsTotalCost =
      itemsGrandTotalData?.selectedMonthAllItemsTotalCost || 0;
    const selectedMonthAllItemsTotalCostNet =
      itemsGrandTotalData?.selectedMonthAllItemsTotalCostNet || 0;
    const selectedMonthAllItemsTotalCostTax =
      itemsGrandTotalData?.selectedMonthAllItemsTotalCostTax || 0;

    const itemsSheetTitle = [`Monthly Report By Item: ${selectedMonthAndYear}`];

    let itemsSheetTable1 = [
      [''],
      ['Item Name', 'Stocks', '', '', '', 'Cost', '', '', '', 'Revenue'],
      [
        '',
        'Previous Month',
        'Added',
        'Removed',
        'Current Month Total',
        'Total Stock Cost (Gross)',
        'Tax Amount',
        'Total Stock Cost (Net)',
        'Avg. Unit Cost',
        'Revenue Group',
        'Revenue Amount',
        'Item Cost %',
      ],
    ];

    let itemsSheetTable1Totals = [['']];

    itemsSheetTable1Totals.push([
      // Below Item name column
      'Grand Total',
      // Stocks
      '---',
      '---',
      '---',
      '---',
      // Cost
      `${currencySymbol} ${commaNumber(
        selectedMonthAllItemsTotalCost.toFixed(2),
      )}`,
      `${currencySymbol} ${commaNumber(
        selectedMonthAllItemsTotalCostTax.toFixed(2),
      )}`,
      `${currencySymbol} ${commaNumber(
        selectedMonthAllItemsTotalCostNet.toFixed(2),
      )}`,
      '---',
      // Revenue
      '---',
      '---',
      '---',
    ]);

    let eachItemRow = [];

    itemsDataToExport.forEach(item => {
      // row with custom height
      eachItemRow.push({hpx: 20});

      const selectedMonthGrandTotalCost =
        item.selected_month_grand_total_cost || 0;
      const selectedMonthGrandTotalCostNet =
        item.selected_month_grand_total_cost_net || 0;
      const selectedMonthTotalRemovedStockCost =
        item.selected_month_total_removed_stock_cost || 0;
      const selectedMonthTotalRemovedStockCostNet =
        item.selected_month_total_removed_stock_cost_net || 0;
      const selectedMonthGrandTotalCostTax =
        item.selected_month_grand_total_cost_tax || 0;
      const selectedMonthRevenueGroupTotalAmount =
        item.selected_month_revenue_group_total_amount || 0;
      const itemCostPercentage = selectedMonthRevenueGroupTotalAmount
        ? (selectedMonthTotalRemovedStockCostNet /
            selectedMonthRevenueGroupTotalAmount) *
          100
        : 0;
      const avgUnitCost = selectedMonthGrandTotalCostNet
        ? selectedMonthGrandTotalCostNet /
          (item.selected_month_grand_total_qty || 0)
        : 0;
      const itemRevenueGroupName = item.revenue_group_name || 'None';

      itemsSheetTable1.push([
        // Item
        item.item_name,
        // Stocks
        `${item.previous_month_grand_total_qty || 0} ${formatUOMAbbrev(
          item.item_uom_abbrev,
        )}`,
        `${item.selected_month_total_added_stock_qty || 0} ${formatUOMAbbrev(
          item.item_uom_abbrev,
        )}`,
        `${item.selected_month_total_removed_stock_qty || 0} ${formatUOMAbbrev(
          item.item_uom_abbrev,
        )}`,
        `${item.selected_month_grand_total_qty || 0} ${formatUOMAbbrev(
          item.item_uom_abbrev,
        )}`,
        // Cost
        `${currencySymbol} ${commaNumber(
          selectedMonthGrandTotalCost.toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          selectedMonthGrandTotalCostTax.toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          selectedMonthGrandTotalCostNet.toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(avgUnitCost.toFixed(2))}`,
        // Revenue
        itemRevenueGroupName,
        `${currencySymbol} ${commaNumber(
          selectedMonthRevenueGroupTotalAmount.toFixed(2),
        )}`,
        `${commaNumber(itemCostPercentage.toFixed(2))}%`,
      ]);
    });

    itemsDataToExport = [
      itemsSheetTitle,
      ...itemsSheetTable1,
      ...itemsSheetTable1Totals,
    ];

    let itemsWorksheet = XLSX.utils.aoa_to_sheet(itemsDataToExport);

    const itemsWsCols = [
      {wch: 20}, // A
      {wch: 20}, // B
      {wch: 20}, // C
      {wch: 20}, // D
      {wch: 20}, // E
      {wch: 20}, // F
      {wch: 20}, // G
      {wch: 20}, // H
      {wch: 20}, // I
      {wch: 20}, // J
      {wch: 20}, // K
      {wch: 20}, // L
    ];
    itemsWorksheet['!cols'] = itemsWsCols;

    const itemsWsRows = [
      {hpx: 26},
      {hpx: 20},
      {hpx: 20},
      {hpx: 20},
      ...eachItemRow,
      // totals:
      {hpx: 20},
      {hpx: 20},
    ];
    itemsWorksheet['!rows'] = itemsWsRows;

    // Merge Cells
    if (!itemsWorksheet['!merges']) itemsWorksheet['!merges'] = [];
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A1:B1'));
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A3:A4'));
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('B3:E3'));
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('F3:I3'));
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('J3:L3'));

    /**
     * Categories sheet
     */

    let categoriesDataToExport = categoriesMonthlyReportData?.result;
    let categoriesTotalsData = categoriesMonthlyReportTotalsData?.totals;

    const selectedMonthAllCategoriesTotalCost =
      categoriesTotalsData?.selectedMonthAllCategoriesTotalCost || 0;
    const selectedMonthAllCategoriesTotalCostNet =
      categoriesTotalsData?.selectedMonthAllCategoriesTotalCostNet || 0;
    const selectedMonthAllCategoriesTotalCostTax =
      categoriesTotalsData?.selectedMonthAllCategoriesTotalCostTax || 0;
    const previousMonthAllCategoriesTotalCost =
      categoriesTotalsData?.previousMonthAllCategoriesTotalCost || 0;
    const previousMonthAllCategoriesTotalCostNet =
      categoriesTotalsData?.previousMonthAllCategoriesTotalCostNet || 0;
    const previousMonthAllCategoriesTotalCostTax =
      categoriesTotalsData?.previousMonthAllCategoriesTotalCostTax || 0;

    const categoriesSheetTitle = [
      `Monthly Report By Categories: ${selectedMonthAndYear}`,
    ];

    let categoriesSheetTable1 = [
      [''],
      ['Category Name', 'Cost', '', '', '', '', '', 'Revenue'],
      [
        '',
        'Prev. Month Total Cost (Gross)',
        'Prev. Month Tax Amount',
        'Prev. Month Total Cost (Net)',
        'This Month Total Cost (Gross)',
        'This Month Tax Amount',
        'This Month Total Cost (Net)',
        'Revenue Group',
        'Revenue Amount',
        'Category Cost %',
      ],
    ];

    let categoriesSheetTable1Totals = [['']];

    categoriesSheetTable1Totals.push([
      // Below Category name column
      'Grand Total',
      // Cost
      `${currencySymbol} ${commaNumber(
        previousMonthAllCategoriesTotalCost.toFixed(2),
      )}`,
      `${currencySymbol} ${commaNumber(
        previousMonthAllCategoriesTotalCostTax.toFixed(2),
      )}`,
      `${currencySymbol} ${commaNumber(
        previousMonthAllCategoriesTotalCostNet.toFixed(2),
      )}`,
      `${currencySymbol} ${commaNumber(
        selectedMonthAllCategoriesTotalCost.toFixed(2),
      )}`,
      `${currencySymbol} ${commaNumber(
        selectedMonthAllCategoriesTotalCostTax.toFixed(2),
      )}`,
      `${currencySymbol} ${commaNumber(
        selectedMonthAllCategoriesTotalCostNet.toFixed(2),
      )}`,
      // Revenue
      '---',
      '---',
      '---',
    ]);

    let eachCategoryRow = [];

    categoriesDataToExport.forEach(item => {
      // row with custom height
      eachCategoryRow.push({hpx: 20});

      const selectedMonthGrandTotalCost =
        item.selected_month_grand_total_cost || 0;
      const selectedMonthGrandTotalCostNet =
        item.selected_month_grand_total_cost_net || 0;
      const selectedMonthGrandTotalCostTax =
        item.selected_month_grand_total_cost_tax || 0;
      const selectedMonthTotalRemovedStockCost =
        item.selected_month_total_removed_stock_cost || 0;
      const selectedMonthTotalRemovedStockCostNet =
        item.selected_month_total_removed_stock_cost_net || 0;
      const previousMonthGrandTotalCost =
        item.previous_month_grand_total_cost || 0;
      const previousMonthGrandTotalCostNet =
        item.previous_month_grand_total_cost_net || 0;
      const previousMonthGrandTotalCostTax =
        item.previous_month_grand_total_cost_tax || 0;
      const selectedMonthRevenueGroupTotalAmount =
        item.selected_month_revenue_group_total_amount || 0;
      const categoryCostPercentage = selectedMonthRevenueGroupTotalAmount
        ? (selectedMonthTotalRemovedStockCostNet /
            selectedMonthRevenueGroupTotalAmount) *
          100
        : 0;
      const categoryRevenueGroupName = item.revenue_group_name || 'None';

      categoriesSheetTable1.push([
        // Category
        item.category_name,
        // Cost
        `${currencySymbol} ${commaNumber(
          previousMonthGrandTotalCost.toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          previousMonthGrandTotalCostTax.toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          previousMonthGrandTotalCostNet.toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          selectedMonthGrandTotalCost.toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          selectedMonthGrandTotalCostTax.toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          selectedMonthGrandTotalCostNet.toFixed(2),
        )}`,
        // Revenue
        categoryRevenueGroupName,
        `${currencySymbol} ${commaNumber(
          selectedMonthRevenueGroupTotalAmount.toFixed(2),
        )}`,
        `${commaNumber(categoryCostPercentage.toFixed(2))}%`,
      ]);
    });

    categoriesDataToExport = [
      categoriesSheetTitle,
      ...categoriesSheetTable1,
      ...categoriesSheetTable1Totals,
    ];

    let categoriesWorksheet = XLSX.utils.aoa_to_sheet(categoriesDataToExport);

    const categoriesWsCols = [
      {wch: 27}, // A
      {wch: 27}, // B
      {wch: 27}, // C
      {wch: 27}, // D
      {wch: 27}, // E
      {wch: 27}, // F
      {wch: 27}, // G
      {wch: 27}, // H
      {wch: 27}, // I
      {wch: 27}, // J
    ];
    categoriesWorksheet['!cols'] = categoriesWsCols;

    const categoriesWsRows = [
      {hpx: 26},
      {hpx: 20},
      {hpx: 20},
      {hpx: 20},
      ...eachCategoryRow,
      // totals:
      {hpx: 20},
      {hpx: 20},
    ];
    categoriesWorksheet['!rows'] = categoriesWsRows;

    // Merge Cells
    if (!categoriesWorksheet['!merges']) categoriesWorksheet['!merges'] = [];
    categoriesWorksheet['!merges'].push(XLSX.utils.decode_range('A3:A4'));
    categoriesWorksheet['!merges'].push(XLSX.utils.decode_range('B3:G3'));
    categoriesWorksheet['!merges'].push(XLSX.utils.decode_range('H3:I3'));

    if (options.sheets.includes('items')) {
      XLSX.utils.book_append_sheet(workbook, itemsWorksheet, 'Items');
    }

    if (options.sheets.includes('categories')) {
      XLSX.utils.book_append_sheet(workbook, categoriesWorksheet, 'Categories');
    }

    const wbout = XLSX.write(workbook, {type: 'binary', bookType: 'xlsx'});

    // formik loading state
    options?.actions?.setSubmitting(true);

    // component level loading state
    setIsFileExportLoading(() => true);

    try {
      const filepath = RNFS.DownloadDirectoryPath + `/${options.fileName}.xlsx`;

      const fileExists = await RNFS.exists(filepath);

      // Write generated excel to Storage
      await RNFS.writeFile(filepath, wbout, 'ascii');

      console.log('Success');
      setExportSuccessDialogVisible(() => true);
    } catch (error) {
      if (error.code === 'ENOENT') {
        try {
          // Tryp to Write generated excel to Storage as copy
          await RNFS.writeFile(
            RNFS.DownloadDirectoryPath + `/${options.fileName} (Copy).xlsx`,
            wbout,
            'ascii',
          );

          setExportSuccessDialogVisible(() => true);
        } catch (error) {
          setExportFailedDialogVisible(() => true);
        }
      } else {
        setExportFailedDialogVisible(() => true);
      }
    } finally {
      setIsFileExportLoading(() => false);
      options?.actions?.setSubmitting(false);
      setExportOptionsModalVisible(() => false);
    }
  };

  const handlePressExport = async () => {
    try {
      // Check for Permission (check if permission is already given or not)
      let isPermitedExternalStorage = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );

      if (!isPermitedExternalStorage) {
        // Ask for permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage permission needed',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          // Permission Granted (calling our exportDataToExcel function)
          // exportDataToExcel();
          setExportOptionsModalVisible(() => true);
          console.log('Permission granted');
        } else {
          // Permission denied
          console.log('Permission denied');

          setExportNeedPermissionDialogVisible(() => true);
        }
      } else {
        // Already have Permission (calling our exportDataToExcel function)
        // exportDataToExcel();
        setExportOptionsModalVisible(() => true);
      }
    } catch (e) {
      console.log('Error while checking permission');
      console.log(e);
      return;
    }
  };

  const handlePressDownloads = async () => {
    try {
      const [file] = await DocumentPicker.pick({
        allowMultiSelection: false,
        type: [DocumentPicker.types.xlsx, DocumentPicker.types.xls],
      });

      /**
       * Note: Current FileViewer issue cannot open xlsx file with correct app
       * This issue may be fixed in the future FileViewer release
       */
      // await FileViewer.open(`${RNFS.DownloadDirectoryPath}/${res.name}`, {
      //   showAppsSuggestions: true,
      // });

      // FileViewer alternative
      setSelectedFile(() => file);
      setAppSuggestionsModalVisible(() => true);
    } catch (e) {
      // error
      console.debug(e);
    }
  };

  const handleSubmitForm = async (values, actions) => {
    console.log(values);
    exportDataToExcel({
      fileName: values.fileName,
      sheets: values.sheets,
      actions,
    });
  };

  const renderExportOptionsModalContent = () => {
    if (
      itemsMonthlyReportStatus === 'loading' ||
      categoriesMonthlyReportStatus === 'loading' ||
      itemsMonthlyReportGrandTotalStatus === 'loading' ||
      categoriesMonthlyReportTotalsStatus === 'loading'
    ) {
      return <DefaultLoadingScreen />;
    }

    if (
      itemsMonthlyReportStatus === 'error' ||
      categoriesMonthlyReportStatus === 'error' ||
      itemsMonthlyReportGrandTotalStatus === 'error' ||
      categoriesMonthlyReportTotalsStatus === 'error'
    ) {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    const formInitialValues = {
      fileName,
    };

    return (
      <ReportsFileExportForm
        editMode={true}
        initialValues={formInitialValues}
        onSubmit={handleSubmitForm}
        onCancel={() => setExportOptionsModalVisible(() => false)}
      />
    );
  };

  const renderAppSuggestionsModalContent = () => {
    const excelPlayStoreId = 'com.microsoft.office.excel';
    const officePlayStoreId = 'com.microsoft.office.officehubrow';

    if (appSuggestionsModalVisible && selectedFile) {
      return (
        <>
          <Text
            style={{
              marginBottom: 20,
            }}>{`To view "${selectedFile.name}" file on your device, you can install one of the following apps from Google Play.`}</Text>
          <Subheading style={{fontWeight: 'bold'}}>
            Open or install app
          </Subheading>
          <View style={styles.appSuggestionsContainer}>
            <Pressable
              style={styles.appSuggestionsItem}
              onPress={() => {
                Linking.openURL(
                  `https://play.google.com/store/apps/details?id=${excelPlayStoreId}`,
                );
              }}>
              <MaterialCommunityIcons
                name="microsoft-excel"
                size={30}
                color={colors.dark}
                {...props}
              />
              <Subheading
                style={{
                  fontWeight: 'bold',
                  color: colors.primary,
                  marginLeft: 10,
                }}>
                Microsoft Excel: Spreadsheets
              </Subheading>
            </Pressable>

            <Pressable
              style={styles.appSuggestionsItem}
              onPress={() => {
                Linking.openURL(
                  `https://play.google.com/store/apps/details?id=${officePlayStoreId}`,
                );
              }}>
              <MaterialCommunityIcons
                name="microsoft-office"
                size={30}
                color={colors.dark}
                {...props}
              />
              <Subheading
                style={{
                  fontWeight: 'bold',
                  color: colors.primary,
                  marginLeft: 10,
                }}>
                Microsoft 365 (Office)
              </Subheading>
            </Pressable>
          </View>
        </>
      );
    }
  };

  return (
    <>
      <Portal>
        <Dialog
          visible={exportNeedPermissionDialogVisible}
          onDismiss={() => setExportNeedPermissionDialogVisible(() => false)}>
          <Dialog.Title>Storage permission needed</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{`In order to export report, go to Settings and allow "Files and Media" permission.`}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                Linking.openSettings();
                setExportNeedPermissionDialogVisible(() => false);
              }}
              color={colors.primary}>
              {'Open settings'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={exportSuccessDialogVisible}
          onDismiss={() => setExportSuccessDialogVisible(() => false)}>
          <Dialog.Title>Report has been successfully exported!</Dialog.Title>
          {/* <Dialog.Content>
            <Paragraph>{'Test'}</Paragraph>
          </Dialog.Content> */}
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                handlePressDownloads();
                setExportSuccessDialogVisible(() => false);
              }}
              color={colors.primary}>
              {'View Downloads'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={exportFailedDialogVisible}
          onDismiss={() => setExportFailedDialogVisible(() => false)}>
          <Dialog.Title>Export failed!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {
                'Something went wrong. Try to change the file name to export data.'
              }
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setExportFailedDialogVisible(() => false);
                setExportOptionsModalVisible(() => true);
              }}
              color={colors.primary}>
              {'OK'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Modal
          visible={exportOptionsModalVisible}
          onDismiss={() => setExportOptionsModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Export Report to Excel File
          </Title>
          {renderExportOptionsModalContent()}
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={appSuggestionsModalVisible}
          onDismiss={() => setAppSuggestionsModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            View File
          </Title>
          {renderAppSuggestionsModalContent()}
        </Modal>
      </Portal>
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
  appSuggestionsContainer: {
    marginTop: 5,
  },
  appSuggestionsItem: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default CustomReportsFileExport;
