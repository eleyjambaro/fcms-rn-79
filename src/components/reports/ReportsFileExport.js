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
  Platform,
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
import DocumentPicker from '@react-native-documents/picker';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import ManageExternalStorage from 'react-native-manage-external-storage';

import routes from '../../constants/routes';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import OptionsList from '../buttons/OptionsList';
import {
  getCategoriesMonthlyReport,
  getCategoriesMonthlyReportTotals,
  getItemsMonthlyReport,
  getItemsMonthlyReportTotals,
  getRevenueGroupsMonthlyReportTotals,
  getTotalCategories,
  getTotalItems,
} from '../../localDbQueries/reports';
import MonthlyReportHeaderRight from '../headers/MonthlyReportHeaderRight';
import ReportsFileExportForm from '../forms/ReportsFileExportForm';
import {
  getRevenueGroups,
  getRevenueGroupsGrandTotal,
} from '../../localDbQueries/revenues';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import getAppConfig from '../../constants/appConfig';
import DisabledFeatureModal from '../modals/DisabledFeatureModal';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import {
  createInventoryOperationsReportWorksheet,
  createPurchasesReportWorksheet,
  createStockTFOutReportWorksheet,
} from './ReportsFileExportWorksheets';
import {
  getInventoryLogs,
  getInventoryLogsTotals,
} from '../../localDbQueries/inventoryLogs';

const ReportsFileExport = props => {
  const {dateFilter, highlightedItemId, filter = {}, backAction} = props;
  const {colors} = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const currencySymbol = useCurrencySymbol();

  const androidVersion = Platform.constants['Release'];
  const sdkVersion = Platform.Version;

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

  const [
    needStorageManagementPermissionDialogVisible,
    setNeedStorageManagementPermissionDialogVisible,
  ] = useState(false);

  const [disabledFeatureModalVisible, setDisabledFeatureModalVisible] =
    useState(false);

  const {
    data: itemsMonthlyReportData,
    status: itemsMonthlyReportStatus,
    error: itemsMonthlyReportError,
    refetch: refetchItemsMonthlyReport,
  } = useQuery(
    ['itemsMonthlyReport', {dateFilter, limit: 0}],
    getItemsMonthlyReport,
  );

  const {
    data: categoriesMonthlyReportData,
    status: categoriesMonthlyReportStatus,
    error: categoriesMonthlyReportError,
    refetch: refetchCategoriesMonthlyReport,
  } = useQuery(
    ['categoriesMonthlyReport', {dateFilter, limit: 0}],
    getCategoriesMonthlyReport,
  );

  const {
    data: revenueGroupsData,
    status: revenueGroupsStatus,
    error: revenueGroupsError,
    refetch: refetchRevenueGroups,
  } = useQuery(['revenueGroups', {dateFilter, limit: 0}], getRevenueGroups);

  const {
    data: itemsMonthlyReportGrandTotalData,
    status: itemsMonthlyReportGrandTotalStatus,
  } = useQuery(
    ['itemsMonthlyReportGrandTotal', {dateFilter}],
    getItemsMonthlyReportTotals,
  );

  const {
    data: categoriesMonthlyReportTotalsData,
    status: categoriesMonthlyReportTotalsStatus,
  } = useQuery(
    ['categoriesMonthlyReportTotals', {dateFilter}],
    getCategoriesMonthlyReportTotals,
  );

  const {
    data: revenueGroupsGrandTotalData,
    status: revenueGroupsGrandTotalStatus,
    error: revenueGroupsGrandTotalError,
    refetch: refetchRevenueGroupsGrandTotal,
  } = useQuery(
    ['revenueGroupsGrandTotal', {dateFilter, filter, limit: 0}],
    getRevenueGroupsGrandTotal,
  );

  const {
    data: revenueGroupsMonthlyReportTotalsData,
    status: revenueGroupsMonthlyReportTotalsStatus,
    error: revenueGroupsMonthlyReportTotalsError,
    refetch: refetchRevenueGroupsMonthlyReportTotals,
  } = useQuery(
    ['revenueGroupsMonthlyReportTotals', {dateFilter, filter, limit: 0}],
    getRevenueGroupsMonthlyReportTotals,
  );

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

  /**
   * Inventory Logs (Purchases) state
   */
  const {
    data: inventoryLogsData,
    status: inventoryLogsStatus,
    error: inventoryLogsError,
    refetch: refetchInventoryLogs,
  } = useQuery(
    [
      'inventoryLogs',
      {
        filter: {'operations.id': 2, 'inventory_logs.voided': 0},
        limit: 0,
        // monthYearDateFilter: dateFilter,
        selectedMonthYearDateFilter: dateFilter,
        // dateRangeFilter,
        // monthToDateFilter,
      },
    ],
    getInventoryLogs,
  );

  const {
    data: inventoryLogsTotalsData,
    status: inventoryLogsTotalsStatus,
    error: inventoryLogsTotalsError,
    refetch: refetchInventoryLogsTotals,
  } = useQuery(
    [
      'inventoryLogsTotals',
      {
        filter: {'operations.id': 2},
        limit: 0,
        // monthYearDateFilter: dateFilter,
        selectedMonthYearDateFilter: dateFilter,
        // dateRangeFilter,
        // monthToDateFilter,
      },
    ],
    getInventoryLogsTotals,
  );

  /**
   * Inventory Logs (Stock Transfer In) state
   */
  const {
    data: inventoryLogsStockTFInData,
    status: inventoryLogsStockTFInStatus,
    error: inventoryLogsStockTFInError,
    refetch: refetchInventoryLogsStockTFIn,
  } = useQuery(
    [
      'inventoryLogsStockTFIn',
      {
        filter: {'operations.id': 4, 'inventory_logs.voided': 0},
        limit: 0,
        // monthYearDateFilter: dateFilter,
        selectedMonthYearDateFilter: dateFilter,
        // dateRangeFilter,
        // monthToDateFilter,
      },
    ],
    getInventoryLogs,
  );

  const {
    data: inventoryLogsStockTFInTotalsData,
    status: inventoryLogsStockTFInTotalsStatus,
    error: inventoryLogsStockTFInTotalsError,
    refetch: refetchInventoryLogsStockTFInTotals,
  } = useQuery(
    [
      'inventoryLogsStockTFInTotals',
      {
        filter: {'operations.id': 4},
        limit: 0,
        // monthYearDateFilter: dateFilter,
        selectedMonthYearDateFilter: dateFilter,
        // dateRangeFilter,
        // monthToDateFilter,
      },
    ],
    getInventoryLogsTotals,
  );

  /**
   * Inventory Logs (Stock Transfer Out) state
   */
  const {
    data: inventoryLogsStockTFOutData,
    status: inventoryLogsStockTFOutStatus,
    error: inventoryLogsStockTFOutError,
    refetch: refetchInventoryLogsStockTFOut,
  } = useQuery(
    [
      'inventoryLogsStockTFOut',
      {
        filter: {'operations.id': 10, 'inventory_logs.voided': 0},
        limit: 0,
        // monthYearDateFilter: dateFilter,
        selectedMonthYearDateFilter: dateFilter,
        // dateRangeFilter,
        // monthToDateFilter,
      },
    ],
    getInventoryLogs,
  );

  const {
    data: inventoryLogsStockTFOutTotalsData,
    status: inventoryLogsStockTFOutTotalsStatus,
    error: inventoryLogsStockTFOutTotalsError,
    refetch: refetchInventoryLogsStockTFOutTotals,
  } = useQuery(
    [
      'inventoryLogsStockTFOutTotals',
      {
        filter: {'operations.id': 10},
        limit: 0,
        // monthYearDateFilter: dateFilter,
        selectedMonthYearDateFilter: dateFilter,
        // dateRangeFilter,
        // monthToDateFilter,
      },
    ],
    getInventoryLogsTotals,
  );

  const selectedMonthAndYear = moment(
    dateFilter ? new Date(dateFilter?.split(' ')?.[0]) : new Date(),
  ).format('MMMM YYYY');
  const fileName = `Monthly Report - ${selectedMonthAndYear}`;
  const currentDate = moment(new Date()).format('MMMM DD, YYYY, hh:mma');

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
      categoriesMonthlyReportTotalsStatus === 'loading' ||
      revenueGroupsStatus === 'loading' ||
      revenueGroupsMonthlyReportTotalsStatus === 'loading' ||
      revenueGroupsGrandTotalStatus === 'loading' ||
      totalItemsStatus === 'loading' ||
      totalCategoriesStatus === 'loading' ||
      inventoryLogsStatus === 'loading' ||
      inventoryLogsTotalsStatus === 'loading'
    ) {
      return;
    }

    if (
      itemsMonthlyReportStatus === 'error' ||
      categoriesMonthlyReportStatus === 'error' ||
      itemsMonthlyReportGrandTotalStatus === 'error' ||
      categoriesMonthlyReportTotalsStatus === 'error' ||
      revenueGroupsStatus === 'error' ||
      revenueGroupsMonthlyReportTotalsStatus === 'error' ||
      revenueGroupsGrandTotalStatus === 'error' ||
      totalItemsStatus === 'error' ||
      totalCategoriesStatus === 'error' ||
      inventoryLogsStatus === 'error' ||
      inventoryLogsTotalsStatus === 'error'
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
      [`Report Generation Date: ${currentDate}`],
      [''],
      [
        'Category Name',
        'Item Name',
        'UOM',
        'Stocks',
        '',
        '',
        '',
        'Cost',
        '',
        '',
        '',
        'Revenue',
      ],
      [
        '',
        '',
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
        'Revenue Group Amount',
        'Item Cost %',
      ],
    ];

    let itemsSheetTable1Totals = [['']];

    itemsSheetTable1Totals.push([
      '',
      // Below Item name column
      'Grand Total',
      '---',
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

    itemsSheetTable1Totals.push(['']);
    itemsSheetTable1Totals.push([
      '',
      `Total Items: ${totalItemsData?.result || 0}`,
    ]);
    itemsSheetTable1Totals.push([
      '',
      `Total Categories: ${totalCategoriesData?.result || 0}`,
    ]);

    let eachItemRow = [];

    let itemNameColWidth = 20;
    let itemCategoryNameColWidth = 20;

    itemsDataToExport.forEach(item => {
      // row with custom height
      eachItemRow.push({hpx: 20});

      if (item.item_name.length > itemNameColWidth) {
        itemNameColWidth = item.item_name.length;
      }

      if (item.item_category_name.length > itemCategoryNameColWidth) {
        itemCategoryNameColWidth = item.item_category_name.length;
      }

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
      const itemRevenueGroupName = item.revenue_group_name || '(None)';

      itemsSheetTable1.push([
        item.item_category_name,
        // Item
        item.item_name,
        `${formatUOMAbbrev(item.item_uom_abbrev)}`,
        // Stocks
        `${commaNumber(
          (parseFloat(item.previous_month_grand_total_qty) || 0).toFixed(2),
        )}`,
        `${commaNumber(
          (parseFloat(item.selected_month_total_added_stock_qty) || 0).toFixed(
            2,
          ),
        )}`,
        `${commaNumber(
          (
            parseFloat(item.selected_month_total_removed_stock_qty) || 0
          ).toFixed(2),
        )}`,
        `${commaNumber(
          (parseFloat(item.selected_month_grand_total_qty) || 0).toFixed(2),
        )}`,
        // Cost
        `${commaNumber(selectedMonthGrandTotalCost.toFixed(2))}`,
        `${commaNumber(selectedMonthGrandTotalCostTax.toFixed(2))}`,
        `${commaNumber(selectedMonthGrandTotalCostNet.toFixed(2))}`,
        `${commaNumber((parseFloat(item.avg_unit_cost_net) || 0).toFixed(2))}`,
        // Revenue
        itemRevenueGroupName,
        `${commaNumber(selectedMonthRevenueGroupTotalAmount.toFixed(2))}`,
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
      {wch: itemCategoryNameColWidth}, // A
      {wch: itemNameColWidth}, // B
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
      {wch: 20}, // M
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
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A2:B2'));
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('A4:A5'));
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('B4:B5'));
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('C4:C5'));
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('D4:G4'));
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('H4:K4'));
    itemsWorksheet['!merges'].push(XLSX.utils.decode_range('L4:N4'));

    /**
     * Cost Analysis sheet
     */
    /**
     * Cost Analysis sheet: Revenues table
     */
    let revenueGroupsDataToExport = revenueGroupsData?.result;
    let revenueGroupsGrandTotal = revenueGroupsGrandTotalData || 0;
    let revenueGroupsTotals = revenueGroupsMonthlyReportTotalsData?.totals;

    let revenueGroupsTable = [
      [''],
      [''],
      ['REVENUES'],
      [''],
      ['Revenue Group', 'Total Revenue', 'Percentage'],
      [''],
    ];

    let revenueGroupsTableTotals = [['']];

    revenueGroupsTableTotals.push([
      `Grand Total`,
      `${currencySymbol} ${commaNumber(revenueGroupsGrandTotal.toFixed(2))}`,
      `${(revenueGroupsGrandTotal
        ? (revenueGroupsGrandTotal / revenueGroupsGrandTotal) * 100
        : 0
      ).toFixed(2)}%`,
    ]);

    let eachRevenueGroupRow = [];

    revenueGroupsDataToExport.forEach(item => {
      // row with custom height
      eachRevenueGroupRow.push({hpx: 20});

      const totalRevenue = item.amount || 0;
      const percentage = item.percentage || 0;

      revenueGroupsTable.push([
        item.name,
        `${commaNumber(totalRevenue.toFixed(2))}`,
        `${commaNumber(percentage.toFixed(2))}%`,
      ]);
    });

    revenueGroupsDataToExport = [
      ...revenueGroupsTable,
      ...revenueGroupsTableTotals,
    ];

    /**
     * Cost Analysis sheet: Categories table
     */

    let categoriesDataToExport = categoriesMonthlyReportData?.result;
    let categoriesTotalsData = categoriesMonthlyReportTotalsData?.totals;

    const selectedMonthAllCategoriesTotalCost =
      categoriesTotalsData?.selectedMonthAllCategoriesTotalCost || 0;
    const selectedMonthAllCategoriesTotalCostNet =
      categoriesTotalsData?.selectedMonthAllCategoriesTotalCostNet || 0;
    const selectedMonthAllCategoriesTotalCostTax =
      categoriesTotalsData?.selectedMonthAllCategoriesTotalCostTax || 0;
    const selectedMonthAllCategoriesCostPercentage =
      categoriesTotalsData?.selectedMonthAllCategoriesCostPercentage || 0;
    const selectedMonthAllCategoriesNetCostPercentage =
      categoriesTotalsData?.selectedMonthAllCategoriesNetCostPercentage || 0;
    const selectedMonthAllCategoriesPurchaseCostPercentage =
      categoriesTotalsData?.selectedMonthAllCategoriesPurchaseCostPercentage ||
      0;
    const selectedMonthAllCategoriesPurchaseNetCostPercentage =
      categoriesTotalsData?.selectedMonthAllCategoriesPurchaseNetCostPercentage ||
      0;

    const previousMonthAllCategoriesTotalCost =
      categoriesTotalsData?.previousMonthAllCategoriesTotalCost || 0;
    const previousMonthAllCategoriesTotalCostNet =
      categoriesTotalsData?.previousMonthAllCategoriesTotalCostNet || 0;
    const previousMonthAllCategoriesTotalCostTax =
      categoriesTotalsData?.previousMonthAllCategoriesTotalCostTax || 0;

    const wholeMonthAllCategoriesTotalAddedStockCost =
      categoriesTotalsData?.wholeMonthAllCategoriesTotalAddedStockCost || 0;
    const wholeMonthAllCategoriesTotalAddedStockCostNet =
      categoriesTotalsData?.wholeMonthAllCategoriesTotalAddedStockCostNet || 0;
    const wholeMonthAllCategoriesTotalAddedStockCostTax =
      categoriesTotalsData?.wholeMonthAllCategoriesTotalAddedStockCostTax || 0;

    const wholeMonthAllCategoriesTotalRemovedStockCost =
      categoriesTotalsData?.wholeMonthAllCategoriesTotalRemovedStockCost || 0;
    const wholeMonthAllCategoriesTotalRemovedStockCostNet =
      categoriesTotalsData?.wholeMonthAllCategoriesTotalRemovedStockCostNet ||
      0;
    const wholeMonthAllCategoriesTotalRemovedStockCostTax =
      categoriesTotalsData?.wholeMonthAllCategoriesTotalRemovedStockCostTax ||
      0;

    const wholeMonthAllCategoriesTotalAddedStockCostPercentage =
      categoriesTotalsData.wholeMonthAllCategoriesTotalAddedStockCostPercentage ||
      0;
    const wholeMonthAllCategoriesTotalAddedStockCostNetPercentage =
      categoriesTotalsData.wholeMonthAllCategoriesTotalAddedStockCostNetPercentage ||
      0;
    const wholeMonthAllCategoriesTotalRemovedStockCostPercentage =
      categoriesTotalsData.wholeMonthAllCategoriesTotalRemovedStockCostPercentage ||
      0;
    const wholeMonthAllCategoriesTotalRemovedStockCostNetPercentage =
      categoriesTotalsData.wholeMonthAllCategoriesTotalRemovedStockCostNetPercentage ||
      0;

    const wholeMonthAllCategoriesOperationId2TotalCost =
      categoriesTotalsData?.wholeMonthAllCategoriesOperationId2TotalCost || 0;
    const wholeMonthAllCategoriesOperationId2TotalCostNet =
      categoriesTotalsData?.wholeMonthAllCategoriesOperationId2TotalCostNet ||
      0;
    const wholeMonthAllCategoriesOperationId2TotalCostTax =
      categoriesTotalsData?.wholeMonthAllCategoriesOperationId2TotalCostTax ||
      0;

    const costAnalysisSheetTitle = [`Cost Analysis: ${selectedMonthAndYear}`];

    let categoriesTable = [
      [''],
      [''],
      [''],
      ['CATEGORIES'],
      [''],
      [
        'Category Name',
        'Revenue Group',
        'Beginning Inventory',
        'Purchases',
        'Ending Inventory',
        'Cost of Sales',
        'Category Cost %',
        'Purchase %',
      ],
    ];

    let categoriesTableTotals = [['']];

    categoriesTableTotals.push([
      // Below Category name column
      '',
      `Grand Total`,
      `${currencySymbol} ${commaNumber(
        previousMonthAllCategoriesTotalCostNet.toFixed(2),
      )}`,
      `${currencySymbol} ${commaNumber(
        wholeMonthAllCategoriesTotalAddedStockCostNet.toFixed(2),
      )}`,
      `${currencySymbol} ${commaNumber(
        selectedMonthAllCategoriesTotalCostNet.toFixed(2),
      )}`,
      `${currencySymbol} ${commaNumber(
        wholeMonthAllCategoriesTotalRemovedStockCostNet.toFixed(2),
      )}`,
      `${commaNumber(
        wholeMonthAllCategoriesTotalRemovedStockCostNetPercentage.toFixed(2),
      )}%`,
      `${commaNumber(
        wholeMonthAllCategoriesTotalAddedStockCostNetPercentage.toFixed(2),
      )}%`,
      ,
    ]);

    let categoriesByRevenueGroups = {};

    categoriesDataToExport.forEach(item => {
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

      const wholeMonthPurchasesTotalCost =
        item.whole_month_operation_id_2_total_cost || 0;
      const wholeMonthPurchasesTotalCostNet =
        item.whole_month_operation_id_2_total_cost_net || 0;
      const wholeMonthPurchasesTotalCostTax =
        item.whole_month_operation_id_2_total_cost_tax || 0;

      const wholeMonthTotalAddedStockCost =
        item.whole_month_total_added_stock_cost || 0;
      const wholeMonthTotalAddedStockCostNet =
        item.whole_month_total_added_stock_cost_net || 0;
      const wholeMonthTotalAddedStockCostTax =
        item.whole_month_total_added_stock_cost_tax || 0;

      const wholeMonthTotalRemovedStockCost =
        item.whole_month_total_removed_stock_cost || 0;
      const wholeMonthTotalRemovedStockCostNet =
        item.whole_month_total_removed_stock_cost_net || 0;
      const wholeMonthTotalRemovedStockCostTax =
        item.whole_month_total_removed_stock_cost_tax || 0;

      const categoryCostPercentage = selectedMonthRevenueGroupTotalAmount
        ? (wholeMonthTotalRemovedStockCostNet /
            selectedMonthRevenueGroupTotalAmount) *
          100
        : 0;

      const netPurchasePercentage = selectedMonthRevenueGroupTotalAmount
        ? (wholeMonthTotalAddedStockCostNet /
            selectedMonthRevenueGroupTotalAmount) *
          100
        : 0;

      const categoryRevenueGroupName = item.revenue_group_name || '(None)';

      if (categoryRevenueGroupName in categoriesByRevenueGroups) {
        categoriesByRevenueGroups[`${categoryRevenueGroupName}`].push([
          // Category
          item.category_name,
          categoryRevenueGroupName,
          `${commaNumber(previousMonthGrandTotalCostNet.toFixed(2))}`,
          `${commaNumber(wholeMonthTotalAddedStockCostNet.toFixed(2))}`,
          `${commaNumber(selectedMonthGrandTotalCostNet.toFixed(2))}`,
          `${commaNumber(wholeMonthTotalRemovedStockCostNet.toFixed(2))}`,
          `${commaNumber(categoryCostPercentage.toFixed(2))}%`,
          `${commaNumber(netPurchasePercentage.toFixed(2))}%`,
        ]);
      } else {
        categoriesByRevenueGroups[`${categoryRevenueGroupName}`] = [];
        categoriesByRevenueGroups[`${categoryRevenueGroupName}`].push([
          // Category
          item.category_name,
          categoryRevenueGroupName,
          `${commaNumber(previousMonthGrandTotalCostNet.toFixed(2))}`,
          `${commaNumber(wholeMonthTotalAddedStockCostNet.toFixed(2))}`,
          `${commaNumber(selectedMonthGrandTotalCostNet.toFixed(2))}`,
          `${commaNumber(wholeMonthTotalRemovedStockCostNet.toFixed(2))}`,
          `${commaNumber(categoryCostPercentage.toFixed(2))}%`,
          `${commaNumber(netPurchasePercentage.toFixed(2))}%`,
        ]);
      }
    });

    for (let key in categoriesByRevenueGroups) {
      let keyOrNullKey = key === '(None)' ? null : key;

      categoriesTable.push(['']);
      categoriesTable.push(...categoriesByRevenueGroups[key]);
      categoriesTable.push(['']);
      // revenue group categories total
      categoriesTable.push([
        '',
        `Total`,
        `${currencySymbol} ${commaNumber(
          (
            revenueGroupsTotals?.revenueGroups?.[keyOrNullKey]
              ?.previous_month_revenue_group_categories_total_cost_net || 0
          ).toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          (
            revenueGroupsTotals?.revenueGroups?.[keyOrNullKey]
              ?.whole_month_revenue_group_categories_total_added_stock_cost_net ||
            0
          ).toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          (
            revenueGroupsTotals?.revenueGroups?.[keyOrNullKey]
              ?.selected_month_revenue_group_categories_total_cost_net || 0
          ).toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          (
            revenueGroupsTotals?.revenueGroups?.[keyOrNullKey]
              ?.whole_month_revenue_group_categories_total_removed_stock_cost_net ||
            0
          ).toFixed(2),
        )}`,
        `${commaNumber(
          (
            revenueGroupsTotals?.revenueGroups?.[keyOrNullKey]
              ?.whole_month_revenue_group_categories_total_removed_stock_cost_net_percentage ||
            0
          ).toFixed(2),
        )}%`,
        `${commaNumber(
          (
            revenueGroupsTotals?.revenueGroups?.[keyOrNullKey]
              ?.whole_month_revenue_group_categories_total_added_stock_cost_net_percentage ||
            0
          ).toFixed(2),
        )}%`,
      ]);
      categoriesTable.push(['']);
    }

    let eachCategoryTableRow = [];

    for (let i = 0; i < eachCategoryTableRow.length; i++) {
      // row with custom height
      eachCategoryTableRow.push({hpx: 20});
    }

    categoriesDataToExport = [...categoriesTable, ...categoriesTableTotals];

    const dataToExport = [
      costAnalysisSheetTitle,
      [`Report Generation Date: ${currentDate}`],
      ...revenueGroupsDataToExport,
      ...categoriesDataToExport,
    ];

    let costAnalysisWorksheet = XLSX.utils.aoa_to_sheet(dataToExport);

    const costAnalysisWsCols = [
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
    costAnalysisWorksheet['!cols'] = costAnalysisWsCols;

    const costAnalysisWsRows = [
      {hpx: 40},
      {hpx: 20},
      ...eachRevenueGroupRow,
      {hpx: 20},
      ...eachCategoryTableRow,
      // totals:
      {hpx: 20},
      {hpx: 20},
    ];
    costAnalysisWorksheet['!rows'] = costAnalysisWsRows;

    // Merge Cells
    if (!costAnalysisWorksheet['!merges'])
      costAnalysisWorksheet['!merges'] = [];
    costAnalysisWorksheet['!merges'].push(XLSX.utils.decode_range('A1:H1'));

    const inventoryOperationsByItemWorksheet =
      createInventoryOperationsReportWorksheet({
        selectedMonthAndYear,
        currencySymbol,
        itemsMonthlyReportData,
        itemsMonthlyReportGrandTotalData,
        totalItemsData,
        totalCategoriesData,
      });

    const purchasesByItemWorksheet = createPurchasesReportWorksheet({
      selectedMonthAndYear,
      currencySymbol,
      inventoryLogsData,
      itemsMonthlyReportGrandTotalData,
      inventoryLogsTotalsData,
      totalItemsData,
      totalCategoriesData,
    });

    const stockTFInByItemWorksheet = createPurchasesReportWorksheet({
      selectedMonthAndYear,
      currencySymbol,
      inventoryLogsData: inventoryLogsStockTFInData,
      itemsMonthlyReportGrandTotalData,
      inventoryLogsTotalsData: inventoryLogsStockTFInTotalsData,
      totalItemsData,
      totalCategoriesData,
      dateLabel: 'Transfer In Date',
      quantityLabel: 'Transfer Quantity',
      sheetTitle: 'Stock Transfer In (By Item)',
    });

    const stockTFOutByItemWorksheet = createStockTFOutReportWorksheet({
      selectedMonthAndYear,
      currencySymbol,
      inventoryLogsData: inventoryLogsStockTFOutData,
      itemsMonthlyReportGrandTotalData,
      inventoryLogsTotalsData: inventoryLogsStockTFOutTotalsData,
      totalItemsData,
      totalCategoriesData,
    });

    if (options.sheets.includes('cost-analysis')) {
      XLSX.utils.book_append_sheet(
        workbook,
        costAnalysisWorksheet,
        'Cost Analysis',
      );
    }

    if (options.sheets.includes('items')) {
      XLSX.utils.book_append_sheet(workbook, itemsWorksheet, 'Items');
    }

    if (options.sheets.includes('inventory-operations-by-item')) {
      XLSX.utils.book_append_sheet(
        workbook,
        inventoryOperationsByItemWorksheet,
        'Inventory Operations (by Item)',
      );
    }

    if (options.sheets.includes('purchases-by-item')) {
      XLSX.utils.book_append_sheet(
        workbook,
        purchasesByItemWorksheet,
        'Purchases (by Item)',
      );
    }

    if (options.sheets.includes('stock-tf-in-by-item')) {
      XLSX.utils.book_append_sheet(
        workbook,
        stockTFInByItemWorksheet,
        'Stock Transfer In (by Item)',
      );
    }

    if (options.sheets.includes('stock-tf-out-by-item')) {
      XLSX.utils.book_append_sheet(
        workbook,
        stockTFOutByItemWorksheet,
        'Stock Transfer Out (by Item)',
      );
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

  const openManageExternalStorageSettings = async () => {
    await ManageExternalStorage.checkAndGrantPermission(
      err => {
        console.debug(err);
      },
      isGranted => {
        if (isGranted) {
          console.log('All files management permission granted');
        }
      },
    );
  };

  const handlePressExport = async () => {
    try {
      const {enableExportReports} = await getAppConfig();

      if (!enableExportReports) {
        setDisabledFeatureModalVisible(() => true);
        return;
      }

      // for android 11 or higher
      if (sdkVersion >= 30) {
        await ManageExternalStorage.checkPermission(
          err => {
            if (err) {
              console.debug(err);
            }
          },
          isGranted => {
            if (!isGranted) {
              setNeedStorageManagementPermissionDialogVisible(() => true);
            } else {
              // Already have Permission
              setExportOptionsModalVisible(() => true);
            }
          },
        );
      } else {
        // Check if write permission is already given or not
        let isWriteExternalStoragePermitted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );

        if (!isWriteExternalStoragePermitted) {
          // Then prompt user and ask for permission
          const requestResult = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Storage permission needed',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );

          if (requestResult === PermissionsAndroid.RESULTS.GRANTED) {
            // Permission granted
            console.log('Write External Storage Permission granted.');
            setExportOptionsModalVisible(() => true);
          } else {
            // Permission denied
            console.log('Write External Storage Permission denied');
            setExportNeedPermissionDialogVisible(() => true);
          }
        } else {
          // Already have Permission
          setExportOptionsModalVisible(() => true);
        }
      }
    } catch (e) {
      console.log('Error while checking permission');
      console.log(e);
      return;
    }
  };

  const handlePressDownloads = async () => {
    try {
      const [res] = await DocumentPicker.pick({
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
      setSelectedFile(() => res?.[0]);
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
      categoriesMonthlyReportTotalsStatus === 'loading' ||
      totalItemsStatus === 'loading' ||
      totalCategoriesStatus === 'loading'
    ) {
      return <DefaultLoadingScreen />;
    }

    if (
      itemsMonthlyReportStatus === 'error' ||
      categoriesMonthlyReportStatus === 'error' ||
      itemsMonthlyReportGrandTotalStatus === 'error' ||
      categoriesMonthlyReportTotalsStatus === 'error' ||
      totalItemsStatus === 'error' ||
      totalCategoriesStatus === 'error'
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

  const renderNeedStoragePermissionDialogContentAndActions = () => {
    // for android 11 or higher
    if (sdkVersion >= 30) {
      return (
        <>
          <Dialog.Content>
            <Text style={{marginBottom: 15}}>
              In order to enable data backup and recovery, your permission for
              management of all files is needed.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                openManageExternalStorageSettings();
              }}>
              Enable in Settings
            </Button>
            <Button
              onPress={() => {
                setNeedStorageManagementPermissionDialogVisible(() => false);
              }}>
              Cancel
            </Button>
          </Dialog.Actions>
        </>
      );
    }

    return (
      <>
        <Dialog.Content>
          <Text style={{marginBottom: 15}}>
            In order to enable data backup and recovery, your permission for
            management of all files is needed.
          </Text>
          <Text>
            Go to your device's{' '}
            <Text
              onPress={() => Linking.openSettings()}
              style={{color: colors.primary, fontWeight: 'bold'}}>
              Settings
            </Text>
            {', then look for '}
            <Text style={{color: colors.dark, fontWeight: 'bold'}}>
              "Permissions"
            </Text>
            {' (in some devices, you can find "Permissions" under '}
            <Text style={{color: colors.dark, fontWeight: 'bold'}}>
              Privacy
            </Text>
            {' section of settings page), then go to '}
            <Text style={{color: colors.dark, fontWeight: 'bold'}}>
              Files and media
            </Text>
            {' listed under Allowed permission, and '}
            <Text style={{color: colors.dark, fontWeight: 'bold'}}>
              Allow management of all files
            </Text>
            {' for this app.'}
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={{justifyContent: 'space-around'}}>
          <Button
            onPress={() => {
              Linking.openSettings();
            }}>
            Open Settings
          </Button>
          <Button
            onPress={() => {
              setNeedStorageManagementPermissionDialogVisible(() => false);
            }}>
            Done
          </Button>
        </Dialog.Actions>
      </>
    );
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
          visible={needStorageManagementPermissionDialogVisible}
          onDismiss={() =>
            setNeedStorageManagementPermissionDialogVisible(() => false)
          }>
          <Dialog.Title>
            Files and Media Management Permission Needed
          </Dialog.Title>
          {renderNeedStoragePermissionDialogContentAndActions()}
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

      <DisabledFeatureModal
        visible={disabledFeatureModalVisible}
        onDismiss={() => {
          setDisabledFeatureModalVisible(() => false);
        }}
      />

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

export default ReportsFileExport;
