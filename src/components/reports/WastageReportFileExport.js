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
import {BottomSheetModal, BottomSheetBackdrop} from '@gorhom/bottom-sheet';
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
} from '../../localDbQueries/reports';
import MonthlyReportHeaderRight from '../headers/MonthlyReportHeaderRight';
import WastageReportFileExportForm from '../forms/WastageReportFileExportForm';
import {
  getRevenueGroups,
  getRevenueGroupsGrandTotal,
} from '../../localDbQueries/revenues';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import getAppConfig from '../../constants/appConfig';
import DisabledFeatureModal from '../modals/DisabledFeatureModal';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import {getSpoilages, getSpoilagesTotal} from '../../localDbQueries/spoilages';

const WastageReportFileExport = props => {
  const {
    dateFilter,
    highlightedItemId,
    filter = {},
    backAction,
    selectedDateFilter,
    selectedMonthYearDateFilter,
    exactDateFilter,
  } = props;
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
    data: getSpoilagesData,
    status: getSpoilagesStatus,
    error: getSpoilagesError,
    refetch: refetchSpoilages,
  } = useQuery(
    [
      'spoilages',
      {
        selectedDateFilter,
        selectedMonthYearDateFilter,
        exactDateFilter,
        limit: 0,
        listOrder: 'ASC',
      },
    ],
    getSpoilages,
  );
  const {status: getSpoilagesTotalCostStatus, data: getSpoilagesTotalCostData} =
    useQuery(
      [
        'selectedMonthSpoilagesTotalCost',
        {
          selectedMonthYearDateFilter,
          selectedMonthYearDateFilter,
          exactDateFilter,
        },
      ],
      getSpoilagesTotal,
    );

  let fileNameDate = moment(new Date()).format('MMMM YYYY');

  if (
    selectedDateFilter?.value === 'month-year' &&
    selectedMonthYearDateFilter
  ) {
    fileNameDate = moment(
      new Date(selectedMonthYearDateFilter.split(' ')?.[0]),
    ).format('MMMM YYYY');

    fileNameDate += ' (Whole Month)';
  }

  if (selectedDateFilter?.value === 'exact-date' && exactDateFilter) {
    fileNameDate = moment(new Date(exactDateFilter.split(' ')?.[0])).format(
      'MMMM DD, YYYY',
    );
  }

  const fileName = `Wastage Report - ${fileNameDate}`;

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
      <View style={styles.bottomSheetContent}>
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
      </View>
    );
  };

  // function to handle exporting
  const exportDataToExcel = async options => {
    if (getSpoilagesStatus === 'loading') {
      return;
    }

    if (getSpoilagesStatus === 'error') {
      return;
    }

    // if (!options.sheets?.length > 0) {
    //   return;
    // }

    let workbook = XLSX.utils.book_new();

    /**
     * Items sheet
     */

    let spoilagesDataToExport = getSpoilagesData?.result;
    let spoilagesTotalCostData = getSpoilagesTotalCostData;

    const totalCost = spoilagesTotalCostData?.totalCost || 0;
    const totalCostNet = spoilagesTotalCostData?.totalCostNet || 0;
    const totalCostTax = spoilagesTotalCostData?.totalCostTax || 0;

    const spoilagesSheetTitle = [`Spoilage / Wastage Report: ${fileNameDate}`];

    let spoilagesSheetTable1 = [
      [`Report Generation Date: ${currentDate}`],
      [''],
      [
        'Date',
        'Item Name',
        'Category Name',
        'Quantity',
        'Avg. Unit Cost',
        'Total Cost (Net)',
        'Total Cost (Gross)',
      ],
    ];

    let spoilagesSheetTable1Totals = [['']];

    spoilagesSheetTable1Totals.push([
      '',
      '',
      '',
      '',
      'Grand Total',
      // Cost
      `${currencySymbol} ${commaNumber(totalCostNet.toFixed(2))}`,
      `${currencySymbol} ${commaNumber(totalCost.toFixed(2))}`,
    ]);

    let eachItemRow = [];

    let itemNameColWidth = 20;
    let itemCategoryNameColWidth = 20;

    spoilagesDataToExport.forEach(item => {
      // row with custom height
      eachItemRow.push({hpx: 20});

      if (item.item_name.length > itemNameColWidth) {
        itemNameColWidth = item.item_name.length;
      }

      if (item.item_category_name.length > itemCategoryNameColWidth) {
        itemCategoryNameColWidth = item.item_category_name.length;
      }

      spoilagesSheetTable1.push([
        `${moment(item.in_spoilage_date?.split(' ')[0]).format(
          'MMM DD, YYYY',
        )}`,
        item.item_name,
        item.item_category_name,
        `${commaNumber(
          (parseFloat(item.in_spoilage_qty) || 0).toFixed(2),
        )} ${formatUOMAbbrev(item.in_spoilage_uom_abbrev)}`,
        `${currencySymbol} ${commaNumber(
          parseFloat(item.added_stock_avg_unit_cost_net || 0).toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber(
          (item.total_cost_net || 0)?.toFixed(2),
        )}`,
        `${currencySymbol} ${commaNumber((item.total_cost || 0)?.toFixed(2))}`,
      ]);
    });

    spoilagesDataToExport = [
      spoilagesSheetTitle,
      ...spoilagesSheetTable1,
      ...spoilagesSheetTable1Totals,
    ];

    let spoilagesWorksheet = XLSX.utils.aoa_to_sheet(spoilagesDataToExport);

    const spoilagesWsCols = [
      {wch: 20}, // A
      {wch: itemNameColWidth}, // B
      {wch: itemCategoryNameColWidth}, // C
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
    spoilagesWorksheet['!cols'] = spoilagesWsCols;

    const spoilagesWsRows = [
      {hpx: 26},
      {hpx: 20},
      {hpx: 20},
      {hpx: 20},
      ...eachItemRow,
      // totals:
      {hpx: 20},
      {hpx: 20},
    ];
    spoilagesWorksheet['!rows'] = spoilagesWsRows;

    // Merge Cells
    // if (!spoilagesWorksheet['!merges']) spoilagesWorksheet['!merges'] = [];
    // spoilagesWorksheet['!merges'].push(XLSX.utils.decode_range('A1:B1'));
    // spoilagesWorksheet['!merges'].push(XLSX.utils.decode_range('A2:B2'));
    // spoilagesWorksheet['!merges'].push(XLSX.utils.decode_range('A4:A5'));
    // spoilagesWorksheet['!merges'].push(XLSX.utils.decode_range('B4:B5'));
    // spoilagesWorksheet['!merges'].push(XLSX.utils.decode_range('C4:F4'));
    // spoilagesWorksheet['!merges'].push(XLSX.utils.decode_range('G4:J4'));
    // spoilagesWorksheet['!merges'].push(XLSX.utils.decode_range('K4:M4'));

    // if (options.sheets.includes('cost-analysis')) {
    //   XLSX.utils.book_append_sheet(
    //     workbook,
    //     costAnalysisWorksheet,
    //     'Cost Analysis',
    //   );
    // }

    // if (options.sheets.includes('items')) {
    //   XLSX.utils.book_append_sheet(workbook, spoilagesWorksheet, 'Items');
    // }

    XLSX.utils.book_append_sheet(workbook, spoilagesWorksheet, 'Wastages');

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
      actions,
    });
  };

  const renderExportOptionsModalContent = () => {
    if (getSpoilagesStatus === 'loading') {
      return <DefaultLoadingScreen />;
    }

    if (getSpoilagesStatus === 'error') {
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
      <WastageReportFileExportForm
        editMode={true}
        initialValues={formInitialValues}
        selectedDateFilter={selectedDateFilter}
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

export default WastageReportFileExport;
