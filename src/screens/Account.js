import {
  StyleSheet,
  View,
  PermissionsAndroid,
  Linking,
  Pressable,
  Platform,
} from 'react-native';
import React, {useState, useEffect} from 'react';
import {
  Drawer,
  useTheme,
  Portal,
  Dialog,
  Paragraph,
  Button,
  Text,
  Modal,
  Title,
  HelperText,
  Subheading,
  Avatar,
  Card,
} from 'react-native-paper';
import * as RNFS from 'react-native-fs';
import uuid from 'react-native-uuid';
import {sign, decode} from 'react-native-pure-jwt';
import XLSX from 'xlsx';
import moment from 'moment';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import RNExitApp from 'react-native-exit-app';
import RNRestart from 'react-native-restart';
import ManageExternalStorage from 'react-native-manage-external-storage';
import convert from 'convert-units';
import {getLocalUserAccount} from '../localDbQueries/accounts';
import {
  formatSelectedBackupFile,
  restoreSelectedBackupDataFromThisDevice,
  saveBackupDataToThisDevice,
  selectBackupDataFromThisDevice,
} from '../lib/deviceData';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import * as DocumentPicker from '@react-native-documents/picker';
import RNFetchBlob from 'rn-fetch-blob';

import useCurrentUser from '../hooks/useCurrentUser';
import useRoleAccess from '../hooks/useRoleAccess';
import routes from '../constants/routes';
import {manualDataRecovery} from '../constants/dataRecovery';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import getAppConfig, {appVersion} from '../constants/appConfig';
import appDefaults from '../constants/appDefaults';
import CompanyIcon from '../components/icons/CompanyIcon';
import WatermarkAppIcon from '../components/icons/WatermarkAppIcon';
import AppIcon from '../components/icons/AppIcon';
import {ScrollView} from 'react-native-gesture-handler';
import DisabledFeatureModal from '../components/modals/DisabledFeatureModal';
import LocalUserAccountProfile from '../components/accounts/LocalUserAccountProfile';
import {insertTemplateDataToDb} from '../localDbQueries/inventoryDataTemplate';
import {getAllItemsForExport} from '../localDbQueries/items';
import InventoryDataTemplateFileExportForm from '../components/forms/InventoryDataTemplateFileExportForm';
import InventoryDataTemplateFileImportForm from '../components/forms/InventoryDataTemplateFileImportForm';
import {adUnitIds} from '../constants/adUnitIds';
import {
  IDT_COLUMNS,
  IDT_EXPORT_EXCLUDED_FIELDS,
  normalizeHeader,
} from '../constants/inventoryDataTemplate';
import BannerAdComponent from '../components/ads/BannerAdComponent';
import ConfirmationCheckbox from '../components/forms/ConfirmationCheckbox';
import ManageListButton from '../components/buttons/ManageListButton';

const Account = props => {
  const {navigation} = props;
  const [active, setActive] = React.useState('');
  const {colors} = useTheme();
  const [{authUser}, {signOut}] = useCurrentUser();
  const {status: getLocalUserAccountStatus, data: getLocalUserAccountData} =
    useQuery(['localUserAccount', {id: authUser?.id}], getLocalUserAccount, {
      enabled: authUser?.id ? true : false,
    });
  const queryClient = useQueryClient();
  const insertTemplateDataToDbMutation = useMutation(insertTemplateDataToDb, {
    onSuccess: () => {
      queryClient.invalidateQueries('templateData');
    },
  });

  const teamMemberRoleName = authUser?.role_name;

  const {can, canAccessModule} = useRoleAccess();
  const androidVersion = Platform.constants['Release'];
  const sdkVersion = Platform.Version;

  /**
   * Backup Data state
   */
  const [backupDialogVisible, setBackupDialogVisible] = useState(false);
  const [backupDbSuccessDialogVisible, setBackupDbSuccessDialogVisible] =
    useState(false);
  const [backupDbFailedDialogVisible, setBackupDbFailedDialogVisible] =
    useState(false);

  const [isBackupDbLoading, setIsBackupDbLoading] = useState(false);

  /**
   * Recover Data state
   */
  const [recoverDataDialogVisible, setRecoverDataDialogVisible] =
    useState(false);
  const [recoverDataSuccessDialogVisible, setRecoverDataSuccessDialogVisible] =
    useState(false);
  const [recoverDataFailedDialogVisible, setRecoverDataFailedDialogVisible] =
    useState(false);
  const [recoverDataWarningsModalVisible, setRecoverDataWarningsModalVisible] =
    useState();
  const [foundBackupDataInfo, setFoundBackupDataInfo] = useState(null);
  const [foundBackupDataInfoModalVisible, setFoundBackupDataInfoModalVisible] =
    useState(false);
  const [backupDataOverrideConfirmed, setBackupDataOverrideConfirmed] =
    useState(false);
  const [disabledFeatureModalVisible, setDisabledFeatureModalVisible] =
    useState(false);

  /**
   * Import / Export Inventory Data Template state
   */
  const [selectedInventoryDataFilePath, setSelectedInventoryDataFilePath] =
    useState('');
  const [
    downloadEmptyInvDataTemplateDialogVisible,
    setDownloadEmptyInvDataTemplateDialogVisible,
  ] = useState(false);
  const [
    importInvDataTemplateDialogVisible,
    setImportInvDataTemplateDialogVisible,
  ] = useState(false);
  const [
    exportInvDataTemplateDialogVisible,
    setExportInvDataTemplateDialogVisible,
  ] = useState(false);
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
  const [
    exportPopulatedOptionsModalVisible,
    setExportPopulatedOptionsModalVisible,
  ] = useState(false);
  const [appSuggestionsModalVisible, setAppSuggestionsModalVisible] =
    useState(false);
  const [importSuccessDialogVisible, setImportSuccessDialogVisible] =
    useState(false);
  const [importFailedDialogVisible, setImportFailedDialogVisible] =
    useState(false);
  const [importOptionsModalVisible, setImportOptionsModalVisible] =
    useState(false);

  const [selectedFile, setSelectedFile] = useState(null);

  const [isFileExportLoading, setIsFileExportLoading] = useState(false);

  const [isRecoverDbLoading, setIsRecoverDbLoading] = useState(false);

  const [needPermissionDialogVisible, setNeedPermissionDialogVisible] =
    useState(false);
  const [
    needStorageManagementPermissionDialogVisible,
    setNeedStorageManagementPermissionDialogVisible,
  ] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [limitReachedMessage, setLimitReachedMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (selectedInventoryDataFilePath) {
      setImportOptionsModalVisible(() => true);
    } else {
      setImportOptionsModalVisible(() => false);
    }
  }, [selectedInventoryDataFilePath]);

  const saveBackupDataToDownloads = async () => {
    setIsBackupDbLoading(() => true);

    try {
      /**
       * Create database recovery directory (to the device Downloads folder)
       */
      await saveBackupDataToThisDevice();

      setBackupDbSuccessDialogVisible(() => true);
    } catch (error) {
      console.debug(error);

      if (error.code === 'ENOENT') {
        setNeedStorageManagementPermissionDialogVisible(() => true);
      } else {
        setBackupDbFailedDialogVisible(() => true);
      }
    } finally {
      setIsBackupDbLoading(() => false);
      setBackupDialogVisible(() => false);
    }
  };

  // deprecated in favor of selectBackupDataFromThisDeviceToRecover
  const findBackupDataFromDownloads = async () => {
    setIsRecoverDbLoading(() => true);

    try {
      /**
       * Locate database recovery directory (from device Downloads foler)
       */
      const dataRecoveryDirectoryName = manualDataRecovery.directoryName;

      const dataRecoveryDirectoryPath = `${RNFS.DownloadDirectoryPath}/${dataRecoveryDirectoryName}`;

      const dataRecoveryDirectoryExists = await RNFS.exists(
        dataRecoveryDirectoryPath,
      );

      if (!dataRecoveryDirectoryExists) {
        let errMsg = 'Database recovery directory not found.';
        setErrorMessage(() => errMsg);
        return;
      }

      /**
       * Get database recovery config file
       */
      const configFileName = manualDataRecovery.configFileName;
      const configFileJson = await RNFS.readFile(
        `${dataRecoveryDirectoryPath}/${configFileName}`,
        'utf8',
      );

      if (!configFileJson) {
        let errMsg = 'Database backup config file not found.';
        setErrorMessage(() => errMsg);
        return;
      }

      const configFileData = JSON.parse(configFileJson);

      // verify if config file was generated from user's device by verifying the token
      const {payload} = await decode(
        configFileData?.cfg_t, // the token
        manualDataRecovery.configTokenKey, // the secret
        {
          skipValidation: true, // to skip signature and exp verification
        },
      );

      const backupDbId = payload?.id;
      const backupDbName = `${manualDataRecovery.backupDbPrefix}${backupDbId}`;

      setFoundBackupDataInfo(() => payload?.info);

      /**
       * Locate databases path (where sqlite database file is located)
       *
       * /data/user/0/rocks.uxi.fcmscloud/databases
       */
      const paths = RNFS.DocumentDirectoryPath.split('/');
      paths.pop();
      paths.push('databases');
      const databasesDirectoryPath = paths.join('/');

      /**
       * Copy sqlite database file (downloaded backup)
       * from Downloads (database recovery directory)
       * to databases directory
       */
      const dbBackupFilePath = `${dataRecoveryDirectoryPath}/${backupDbName}`;

      const dbBackupFileExists = await RNFS.exists(dbBackupFilePath);

      if (!dbBackupFileExists) {
        let errMsg = 'Database backup file not found.';
        setErrorMessage(() => errMsg);
        return;
      }

      // show to user the recovery file data
      setFoundBackupDataInfoModalVisible(() => true);
    } catch (error) {
      console.debug(error);

      if (error.code === 'ENOENT') {
        setNeedStorageManagementPermissionDialogVisible(() => true);
      } else {
        setRecoverDataFailedDialogVisible(() => true);
      }
    } finally {
      setIsRecoverDbLoading(() => false);
      setRecoverDataDialogVisible(() => false);
    }
  };

  const selectBackupDataFromThisDeviceToRecover = async () => {
    setIsRecoverDbLoading(() => true);

    try {
      const file = await selectBackupDataFromThisDevice();
      const backupFile = await formatSelectedBackupFile(file);

      setFoundBackupDataInfo(() => backupFile);

      // show to user the recovery file data
      setFoundBackupDataInfoModalVisible(() => true);
    } catch (error) {
      console.debug(error);

      if (error.code === 'ENOENT') {
        setNeedStorageManagementPermissionDialogVisible(() => true);
      } else {
        setRecoverDataFailedDialogVisible(() => true);
      }
    } finally {
      setIsRecoverDbLoading(() => false);
      setRecoverDataDialogVisible(() => false);
    }
  };

  const recoverBackupDataFromDownloads = async () => {
    setIsRecoverDbLoading(() => true);

    try {
      /**
       * Locate databases path (where sqlite database file is located)
       *
       * /data/user/0/rocks.uxi.fcmscloud/databases
       */
      const paths = RNFS.DocumentDirectoryPath.split('/');
      paths.pop();
      paths.push('databases');
      const databasesDirectoryPath = paths.join('/');

      /**
       * Determine selected file source. Prefer content URI so it works after reinstall
       * when SAF returns only a content:// URI without a stable filesystem path.
       */
      const selectedFileUri = foundBackupDataInfo?.uri || null;
      const selectedFilePath = foundBackupDataInfo?.path || null;

      if (!selectedFileUri && !selectedFilePath) {
        let errMsg = 'Database backup file not found.';
        setErrorMessage(() => errMsg);
        return;
      }

      // move the existing database file to apps's files directory
      if (
        await RNFS.exists(`${databasesDirectoryPath}/${appDefaults.dbName}`)
      ) {
        await RNFS.moveFile(
          `${databasesDirectoryPath}/${appDefaults.dbName}`,
          `${RNFS.DownloadDirectoryPath}/${
            appDefaults.dbName
          }_replaced_${Date.now()}`,
        );
      }

      // replace with backup database file
      const destinationPath = `${databasesDirectoryPath}/${appDefaults.dbName}`;
      if (selectedFileUri) {
        await restoreSelectedBackupDataFromThisDevice({
          fileUri: selectedFileUri,
          destinationPath,
        });
      } else if (selectedFilePath) {
        await RNFS.copyFile(selectedFilePath, destinationPath);
      }

      // move the recovered backup database file to the app's files directory to keep a copy
      // await RNFS.moveFile(
      //   dbBackupFilePath,
      //   `${RNFS.DownloadDirectoryPath}/${
      //     appDefaults.dbName
      //   }_recovered_${Date.now()}`,
      // );

      setRecoverDataSuccessDialogVisible(() => true);
      setFoundBackupDataInfoModalVisible(() => false);
    } catch (error) {
      console.debug(error);

      if (error.code === 'ENOENT') {
        setNeedStorageManagementPermissionDialogVisible(() => true);
      } else {
        setRecoverDataFailedDialogVisible(() => true);
      }
    } finally {
      setIsRecoverDbLoading(() => false);
      setRecoverDataDialogVisible(() => false);
    }
  };

  const downloadEmptyInventoryDataTemplate = async values => {
    /* generate workbook and worksheets */
    const workbook = XLSX.utils.book_new();

    /**
     * Items worksheet
     */
    const itemsTable = [
      IDT_COLUMNS.map(c => c.header),
      ['1'],
      ['2'],
      ['3'],
      ['4'],
      ['5'],
    ];
    const itemsWorksheet = XLSX.utils.aoa_to_sheet(itemsTable);
    itemsWorksheet['!cols'] = IDT_COLUMNS.map(c => ({wch: c.width}));

    /**
     * Valid UOM's List sheet
     */
    const unitsSheetTitle = [`List of valid UOM's`];
    const unitsSheetTable1 = [[''], ['UOM Abbrev', 'UOM Name'], ['']];

    const validUnitsList = convert().list();
    let eachUnitRow = [];
    let unitNameColWidth = 20;

    validUnitsList.forEach(unit => {
      // row with custom height
      eachUnitRow.push({hpx: 20});

      if (unit.singular?.length > unitNameColWidth) {
        unitNameColWidth = unit.singular.length;
      }

      let unitAbbrev = (unit.abbr === 'ea' ? 'pc' : unit.abbr).toUpperCase();
      let unitName = unit.singular === 'Each' ? 'Piece' : unit.singular;

      unitsSheetTable1.push([unitAbbrev, unitName]);
    });

    const validUnitsDataToExport = [unitsSheetTitle, ...unitsSheetTable1];

    let unitsWorksheet = XLSX.utils.aoa_to_sheet(validUnitsDataToExport);

    const unitsWsCols = [
      {wch: 15}, // A
      {wch: unitNameColWidth}, // B
    ];
    unitsWorksheet['!cols'] = unitsWsCols;

    const unitsWsRows = [
      {hpx: 26},
      {hpx: 20},
      {hpx: 20},
      {hpx: 20},
      ...eachUnitRow,
    ];
    unitsWorksheet['!rows'] = unitsWsRows;

    /* append worksheets */
    XLSX.utils.book_append_sheet(
      workbook,
      itemsWorksheet,
      `${appDefaults.appDisplayName}_Items`,
    );

    if (values?.sheets?.includes('units')) {
      XLSX.utils.book_append_sheet(workbook, unitsWorksheet, `Valid UOM's`);
    }

    const wbout = XLSX.write(workbook, {type: 'binary', bookType: 'xlsx'});

    try {
      const filepath = RNFS.DownloadDirectoryPath + `/${values.fileName}.xlsx`;

      const fileExists = await RNFS.exists(filepath);

      // Write generated excel to Storage
      await RNFS.writeFile(filepath, wbout, 'ascii');

      setExportOptionsModalVisible(() => false);
      setExportSuccessDialogVisible(() => true);
    } catch (error) {
      console.debug(error);
      setExportOptionsModalVisible(() => false);
      setExportFailedDialogVisible(() => true);
    }
  };

  const exportInventoryAsIdt = async values => {
    try {
      const items = await getAllItemsForExport();
      // Always export every column so the file matches the empty IDT format.
      // Columns the user didn't select are written with a blank value.
      const selectedFields = new Set(values.columns);

      const headerRow = IDT_COLUMNS.map(c => c.header);

      const dataRows = items.map((item, idx) =>
        IDT_COLUMNS.map(c => {
          if (!selectedFields.has(c.field)) {
            return '';
          }
          switch (c.field) {
            case 'count':
              return String(idx + 1);
            case 'category_name':
              return item.category_name ?? '';
            case 'item_name':
              return item.name ?? '';
            case 'uom_abbrev':
              return (item.uom_abbrev === 'ea'
                ? 'pc'
                : item.uom_abbrev ?? ''
              ).toUpperCase();
            case 'initial_stock_qty':
              return item.current_stock_qty ?? 0;
            case 'unit_cost':
              return item.avg_unit_cost ?? 0;
            case 'total_cost':
              return item.current_stock_cost ?? 0;
            case 'uom_abbrev_per_piece':
              return (item.uom_abbrev_per_piece === 'ea'
                ? 'pc'
                : item.uom_abbrev_per_piece ?? ''
              ).toUpperCase();
            case 'qty_per_piece':
              return item.qty_per_piece ?? '';
            case 'tax_name':
              return item.tax_name ?? '';
            case 'tax_rate_percentage':
              return item.tax_rate_percentage ?? '';
            case 'vendor_name':
              return item.vendor_name ?? '';
            case 'packaging_type':
              return item.packaging_type ?? '';
            case 'barcode':
              return item.barcode ?? '';
            default:
              return '';
          }
        }),
      );

      const workbook = XLSX.utils.book_new();
      const itemsWorksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      itemsWorksheet['!cols'] = IDT_COLUMNS.map(c => ({wch: c.width}));
      XLSX.utils.book_append_sheet(
        workbook,
        itemsWorksheet,
        `${appDefaults.appDisplayName}_Items`,
      );

      const wbout = XLSX.write(workbook, {type: 'binary', bookType: 'xlsx'});
      const filepath = RNFS.DownloadDirectoryPath + `/${values.fileName}.xlsx`;
      await RNFS.writeFile(filepath, wbout, 'ascii');

      setExportPopulatedOptionsModalVisible(() => false);
      setExportSuccessDialogVisible(() => true);
    } catch (error) {
      console.debug(error);
      setExportPopulatedOptionsModalVisible(() => false);
      setExportFailedDialogVisible(() => true);
    }
  };

  const prepareInventoryDataTemplateItemList = async (
    items,
    beginningInventoryDate,
  ) => {
    try {
      await insertTemplateDataToDbMutation.mutateAsync({
        values: items,
        beginningInventoryDate,
        onInsertLimitReached: ({message}) => {
          setImportOptionsModalVisible(() => false);
          setLimitReachedMessage(() => message);
        },
        onSuccess: ({successMessage}) => {
          setImportOptionsModalVisible(() => false);

          if (successMessage) {
            setSuccessMessage(() => successMessage);
          }

          setImportSuccessDialogVisible(() => true);
        },
        onError: ({errorMessage}) => {
          setImportOptionsModalVisible(() => false);
          setErrorMessage(() => {
            return errorMessage;
          });
        },
      });
    } catch (error) {
      setImportOptionsModalVisible(() => false);
      setSuccessMessage(() => '');
      console.debug(error);
    } finally {
    }
  };

  const importInventoryDataTemplate = async (
    values,
    actions,
    beginningInventoryDate,
  ) => {
    try {
      const data = await RNFS.readFile(values.file_path, 'ascii');

      const workbook = XLSX.read(data, {type: 'binary'});
      const itemsWorksheet = workbook.Sheets[values.sheet];

      if (!itemsWorksheet) {
        setErrorMessage(
          () => `Something went wrong with your selected worksheet.`,
        );
        throw Error(`Something went wrong with your selected worksheet.`);
      }

      const rows = XLSX.utils.sheet_to_json(itemsWorksheet, {
        header: 1,
        raw: false,
        defval: '',
      });

      const headerRow = rows[0] || [];
      const normalizedHeaderRow = headerRow.map(normalizeHeader);

      const fieldToIndex = {};
      for (const column of IDT_COLUMNS) {
        const accepted = [
          normalizeHeader(column.header),
          ...(column.acceptedNormalized || []),
        ];
        const index = normalizedHeaderRow.findIndex(h => accepted.includes(h));
        if (index !== -1) {
          fieldToIndex[column.field] = index;
        }
      }

      const missingRequiredHeaders = IDT_COLUMNS.filter(
        c => c.required && !(c.field in fieldToIndex),
      ).map(c => c.header);

      if (missingRequiredHeaders.length) {
        const message =
          `Cannot import. The following required column${
            missingRequiredHeaders.length > 1 ? 's were' : ' was'
          } not found in the selected sheet: ` +
          missingRequiredHeaders.join(', ') +
          `. Please download the latest empty Inventory Data Template and re-enter your items, or fix the header row.`;
        setErrorMessage(() => message);
        throw Error(message);
      }

      const itemsArray = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const obj = {};
        for (const column of IDT_COLUMNS) {
          const idx = fieldToIndex[column.field];
          obj[column.field] = idx === undefined ? '' : String(row[idx] ?? '');
        }
        if (obj.item_name) {
          itemsArray.push(obj);
        }
      }

      prepareInventoryDataTemplateItemList(itemsArray, beginningInventoryDate);
    } catch (error) {
      console.debug(error);
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

  const handlePressBackupDataLocally = async () => {
    try {
      const {enableBackupDataLocally} = await getAppConfig();

      if (!enableBackupDataLocally) {
        setDisabledFeatureModalVisible(() => true);
        return;
      }

      // for android 11 or higher
      if (sdkVersion >= 30) {
        // no run-time permission is required
        setBackupDialogVisible(() => true);
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
            setBackupDialogVisible(() => true);
          } else {
            // Permission denied
            console.log('Write External Storage Permission denied');
            setNeedPermissionDialogVisible(() => true);
          }
        } else {
          // Already have Permission
          setBackupDialogVisible(() => true);
        }
      }
    } catch (e) {
      console.log('Error while checking permission');
      console.log(e);
      return;
    }
  };

  const handlePressRecoverData = async () => {
    try {
      const {enableRecoverDataLocally} = await getAppConfig();

      if (!enableRecoverDataLocally) {
        setDisabledFeatureModalVisible(() => true);
        return;
      }

      // for android 11 or higher
      if (sdkVersion >= 30) {
        // No need a run-time permission
        setRecoverDataDialogVisible(() => true);
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
            setRecoverDataDialogVisible(() => true);
          } else {
            // Permission denied
            console.log('Write External Storage Permission denied');
            setNeedPermissionDialogVisible(() => true);
          }
        } else {
          // Already have Permission
          setRecoverDataDialogVisible(() => true);
        }
      }
    } catch (e) {
      console.log('Error while checking permission');
      console.log(e);
      return;
    }
  };

  const handlePressDownloadEmptyInvDataTemplate = async () => {
    try {
      const {enableImportInventoryDataTemplate} = await getAppConfig();

      if (!enableImportInventoryDataTemplate) {
        setDisabledFeatureModalVisible(() => true);
        return;
      }

      // for android 11 or higher
      if (sdkVersion >= 30) {
        // No need a run-time permission
        setDownloadEmptyInvDataTemplateDialogVisible(() => true);
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
            setDownloadEmptyInvDataTemplateDialogVisible(() => true);
          } else {
            // Permission denied
            console.log('Write External Storage Permission denied');
            setNeedPermissionDialogVisible(() => true);
          }
        } else {
          // Already have Permission
          setDownloadEmptyInvDataTemplateDialogVisible(() => true);
        }
      }
    } catch (e) {
      console.log('Error while checking permission');
      console.log(e);
      return;
    }
  };

  const handlePressImportInvDataTemplate = async () => {
    try {
      const {enableImportInventoryDataTemplate} = await getAppConfig();

      if (!enableImportInventoryDataTemplate) {
        setDisabledFeatureModalVisible(() => true);
        return;
      }

      // for android 11 or higher
      if (sdkVersion >= 30) {
        // No need a run-time permission
        setImportInvDataTemplateDialogVisible(() => true);
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
            setImportInvDataTemplateDialogVisible(() => true);
          } else {
            // Permission denied
            console.log('Write External Storage Permission denied');
            setNeedPermissionDialogVisible(() => true);
          }
        } else {
          // Already have Permission
          setImportInvDataTemplateDialogVisible(() => true);
        }
      }
    } catch (e) {
      console.log('Error while checking permission');
      console.log(e);
      return;
    }
  };

  const handlePressExportInvDataTemplate = async () => {
    try {
      const {enableExportInventoryDataTemplate} = await getAppConfig();

      if (!enableExportInventoryDataTemplate) {
        setDisabledFeatureModalVisible(() => true);
        return;
      }

      // for android 11 or higher
      if (sdkVersion >= 30) {
        // no need a run-time permission
        setExportInvDataTemplateDialogVisible(() => true);
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
            setExportInvDataTemplateDialogVisible(() => true);
          } else {
            // Permission denied
            console.log('Write External Storage Permission denied');
            setNeedPermissionDialogVisible(() => true);
          }
        } else {
          // Already have Permission
          setExportInvDataTemplateDialogVisible(() => true);
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

  const renderUserAccountProfile = () => {
    if (getLocalUserAccountStatus === 'loading') {
      return null;
    }

    if (getLocalUserAccountStatus === 'error') {
      return null;
    }

    const account = getLocalUserAccountData?.result;

    return <LocalUserAccountProfile account={account} />;
  };

  const renderCompanyDataSection = () => {
    if (!canAccessModule('items')) return null;

    return (
      <Drawer.Section title="Company Data">
        <Drawer.Item
          icon="format-list-bulleted"
          label="Master Item List"
          onPress={() => {
            navigation.navigate(routes.masterItemList());
          }}
        />
      </Drawer.Section>
    );
  };

  const renderDataSyncAndBackupSection = () => {
    // it will soon be deprecated
    return null;

    const Component = (
      <Drawer.Section title="Data Sync & Backup">
        {/* <Drawer.Item
          icon="cloud-upload-outline"
          label={`Send Data to Server (${appDefaults.appDisplayName} Cloud)`}
          onPress={async () => {
            try {
              const {enableRecoverDataLocally} = await getAppConfig();

              if (!enableRecoverDataLocally) {
                setDisabledFeatureModalVisible(() => true);
                return;
              }

              navigation.navigate(routes.cloudMainTab());
            } catch (error) {
              console.log('Error while checking if feature is enabled');
              console.log(e);
              return;
            }
          }}
        /> */}
        {/* <Drawer.Item
              icon="cloud-download-outline"
              label="Get Data from Server"
              onPress={() => {}}
            /> */}
        <Drawer.Item
          icon="database-export-outline"
          label="Backup Data to this Device"
          onPress={handlePressBackupDataLocally}
        />
        <Drawer.Item
          icon="database-import-outline"
          label="Recover Data from this Device"
          onPress={handlePressRecoverData}
        />
      </Drawer.Section>
    );

    if (!canAccessModule('dataSyncAndBackup')) return null;

    return Component;
  };

  const renderInventoryDataTemplateSection = () => {
    if (!canAccessModule('inventoryDataTemplate')) return null;

    const canImport = can('inventoryDataTemplate.import');
    const canExport = can('inventoryDataTemplate.export');

    return (
      <Drawer.Section title="Inventory Data Template (IDT)">
        {canExport ? (
          <Drawer.Item
            icon="file-download-outline"
            label="Download Empty Inventory Data Template"
            onPress={handlePressDownloadEmptyInvDataTemplate}
          />
        ) : null}
        {canImport ? (
          <Drawer.Item
            icon="file-import-outline"
            label="Import Inventory Data Template"
            onPress={handlePressImportInvDataTemplate}
          />
        ) : null}
        {canExport ? (
          <Drawer.Item
            icon="file-export-outline"
            label="Export Inventory as IDT"
            onPress={handlePressExportInvDataTemplate}
          />
        ) : null}
      </Drawer.Section>
    );
  };

  const renderUsersSection = () => {
    if (authUser.is_root_account) {
      return (
        <Drawer.Section title="Security & Privacy">
          <Drawer.Item
            icon="account-supervisor-outline"
            label="Manage Team Members"
            onPress={() => {
              navigation.navigate(routes.localUserAccounts());
            }}
          />
          <Drawer.Item
            icon="shield-account-outline"
            label="Manage Roles"
            onPress={() => {
              navigation.navigate(routes.cloudRoles());
            }}
          />
          <Drawer.Item
            icon="source-branch"
            label="Manage Branches"
            onPress={() => {
              navigation.navigate(routes.manageBranches());
            }}
          />
          <Drawer.Item
            icon="delete-forever-outline"
            label="Delete Account"
            onPress={() => {
              navigation.navigate(routes.deleteMyAccount());
            }}
          />
        </Drawer.Section>
      );
    }

    if (!canAccessModule('userManagement')) return null;

    // "View team members & roles" lets a member open either list (read-only);
    // the create/edit controls inside those screens are gated separately by
    // userManagement.manageMembers / userManagement.manageRoles.
    const canSeeMembers =
      can('userManagement.viewMembers') || can('userManagement.manageMembers');
    const canSeeRoles =
      can('userManagement.viewMembers') || can('userManagement.manageRoles');

    return (
      <Drawer.Section title="Security & Privacy">
        {canSeeMembers ? (
          <Drawer.Item
            icon="account-supervisor-outline"
            label="Manage Team Members"
            onPress={() => {
              navigation.navigate(routes.localUserAccounts());
            }}
          />
        ) : null}
        {canSeeRoles ? (
          <Drawer.Item
            icon="shield-account-outline"
            label="Manage Roles"
            onPress={() => {
              navigation.navigate(routes.cloudRoles());
            }}
          />
        ) : null}
      </Drawer.Section>
    );
  };

  const renderEditCompanyProfileButton = () => {
    // Root always passes; non-root members need the explicit granular permission.
    if (!can('account.updateCompanyProfile')) return null;

    return (
      <ManageListButton
        label="Edit Company Profile"
        icon="pencil-outline"
        onPress={() => {
          navigation.navigate(routes.updateCompany());
        }}
      />
    );
  };

  const renderTeamMemberCard = () => {
    if (authUser?.is_root_account) return null;

    const fullName = `${authUser?.first_name || ''} ${
      authUser?.last_name || ''
    }`.trim();
    const initials = fullName
      .split(' ')
      .map(s => (s ? s[0].toUpperCase() : ''))
      .slice(0, 2)
      .join('');
    const roleName = teamMemberRoleName || '';

    return (
      <View style={{marginHorizontal: 15, marginBottom: 20}}>
        <Card>
          <Card.Content style={{flexDirection: 'row', alignItems: 'center'}}>
            <Avatar.Text
              size={50}
              color={colors.surface}
              label={initials || '?'}
              style={{marginRight: 15, backgroundColor: colors.neutralTint3}}
              labelStyle={{fontWeight: 'bold'}}
            />
            <View style={{flex: 1}}>
              <Text
                style={{fontSize: 18, fontWeight: 'bold', color: colors.dark}}
                numberOfLines={1}>
                {fullName}
              </Text>
              <Text
                style={{fontSize: 14, color: colors.neutralTint2}}
                numberOfLines={1}>
                {authUser?.email}
              </Text>
              {roleName ? (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: colors.neutralTint2,
                  }}
                  numberOfLines={1}>
                  {roleName}
                </Text>
              ) : null}
            </View>
          </Card.Content>
        </Card>
      </View>
    );
  };

  const renderExportOptionsModalContent = () => {
    const fileName = `${appDefaults.appDisplayName} Inventory Data Template`;

    const formInitialValues = {
      fileName,
    };

    return (
      <InventoryDataTemplateFileExportForm
        editMode={true}
        initialValues={formInitialValues}
        onSubmit={downloadEmptyInventoryDataTemplate}
        onCancel={() => setExportOptionsModalVisible(() => false)}
      />
    );
  };

  const renderExportPopulatedOptionsModalContent = () => {
    const dateStamp = moment().format('YYYY-MM-DD');
    const fileName = `${appDefaults.appDisplayName} Inventory ${dateStamp}`;
    // Pre-select every exportable column so a full inventory snapshot exports
    // with values by default. PER_LOG_FIELDS are not exportable here (they are
    // per-purchase-log fields, not part of a current-inventory snapshot) and
    // the form excludes them. Users can deselect any column to blank it.
    const exportableFields = IDT_COLUMNS.filter(
      c => !IDT_EXPORT_EXCLUDED_FIELDS.includes(c.field),
    ).map(c => c.field);

    const formInitialValues = {
      fileName,
      columns: exportableFields,
    };

    return (
      <InventoryDataTemplateFileExportForm
        mode="populated"
        initialValues={formInitialValues}
        submitButtonTitle="Download"
        onSubmit={exportInventoryAsIdt}
        onCancel={() => setExportPopulatedOptionsModalVisible(() => false)}
      />
    );
  };

  const renderImportOptionsModalContent = () => {
    const formInitialValues = {
      file_path: '',
    };

    return (
      <InventoryDataTemplateFileImportForm
        initialValues={formInitialValues}
        onSubmit={importInventoryDataTemplate}
        onCancel={() => setImportOptionsModalVisible(() => false)}
      />
    );
  };

  const renderSuccessMessage = () => {
    if (!successMessage) return null;

    // Split on "Found N item(s)" and "Inserted N new item(s)" so we can
    // emphasize the imported count in the dialog. Split includes the capture
    // group, so matched segments land on odd indices.
    const boldRegex = /(Found \d+ items?|Inserted \d+ new items?)/g;
    const parts = successMessage.split(boldRegex);

    return (
      <Paragraph style={{marginTop: 10}}>
        {parts.map((part, idx) =>
          idx % 2 === 1 ? (
            <Text key={idx} style={{fontWeight: 'bold'}}>
              {part}
            </Text>
          ) : (
            part
          ),
        )}
      </Paragraph>
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
          visible={needPermissionDialogVisible}
          onDismiss={() => setNeedPermissionDialogVisible(() => false)}>
          <Dialog.Title>Storage Permission Needed</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{`To enable this feature, you can go to Settings and allow "Files and Media" permission for this app.`}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                Linking.openSettings();
                setNeedPermissionDialogVisible(() => false);
              }}
              color={colors.primary}>
              {'Open settings'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Backup Data Locally modals and Dialogs */}
      <Portal>
        <Dialog
          visible={backupDialogVisible}
          onDismiss={() => setBackupDialogVisible(() => false)}>
          <Dialog.Title>Backup Data Locally</Dialog.Title>
          <Dialog.Content>
            <Text>
              You're about to save the backup of your database to this device.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                saveBackupDataToDownloads();
              }}>
              Proceed
            </Button>
            <Button
              onPress={() => {
                setBackupDialogVisible(() => false);
              }}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={backupDbSuccessDialogVisible}
          onDismiss={() => setBackupDbSuccessDialogVisible(() => false)}>
          <Dialog.Title>Data Backup Success!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {
                'You have backed up your data successfully. You can now recover your data from this                                                 device if needed.'
              }
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setBackupDbSuccessDialogVisible(() => false);
              }}>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={backupDbFailedDialogVisible}
          onDismiss={() => setBackupDbFailedDialogVisible(() => false)}>
          <Dialog.Title>Data backup failed!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{'Something went wrong.'}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setBackupDbFailedDialogVisible(() => false);
              }}>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Recover Data modals & dialogs */}
      <Portal>
        <Dialog
          visible={recoverDataDialogVisible}
          onDismiss={() => setRecoverDataDialogVisible(() => false)}>
          <Dialog.Title>Recover Data from this Device</Dialog.Title>
          <Dialog.Content>
            {/* Backup File Location Guide */}
            <View
              style={{
                backgroundColor: '#f5f5f5',
                borderRadius: 8,
                padding: 15,
                marginBottom: 15,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 10,
                }}>
                <MaterialCommunityIcons
                  name="folder-open-outline"
                  size={24}
                  color={colors.primary}
                />
                <Text
                  style={{
                    marginLeft: 8,
                    fontWeight: 'bold',
                    fontSize: 16,
                    color: colors.dark,
                  }}>
                  Where to find your backup files:
                </Text>
              </View>

              <View style={{marginBottom: 12}}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    marginBottom: 8,
                  }}>
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 12,
                      width: 24,
                      height: 24,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 10,
                      marginTop: 2,
                    }}>
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}>
                      1
                    </Text>
                  </View>
                  <Text style={{flex: 1, lineHeight: 20}}>
                    Tap <Text style={{fontWeight: 'bold'}}>Browse Files</Text>{' '}
                    button below
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    marginBottom: 8,
                  }}>
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 12,
                      width: 24,
                      height: 24,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 10,
                      marginTop: 2,
                    }}>
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}>
                      2
                    </Text>
                  </View>
                  <Text style={{flex: 1, lineHeight: 20}}>
                    Navigate to{' '}
                    <Text style={{fontWeight: 'bold', color: colors.primary}}>
                      Downloads
                    </Text>{' '}
                    folder
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    marginBottom: 8,
                  }}>
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 12,
                      width: 24,
                      height: 24,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 10,
                      marginTop: 2,
                    }}>
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}>
                      3
                    </Text>
                  </View>
                  <Text style={{flex: 1, lineHeight: 20}}>
                    Look for the{' '}
                    <Text style={{fontWeight: 'bold', color: colors.primary}}>
                      FCMS_Data
                    </Text>{' '}
                    folder
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                  }}>
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 12,
                      width: 24,
                      height: 24,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 10,
                      marginTop: 2,
                    }}>
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}>
                      4
                    </Text>
                  </View>
                  <Text style={{flex: 1, lineHeight: 20}}>
                    Your backup files end with{' '}
                    <Text style={{fontWeight: 'bold', color: colors.primary}}>
                      .db
                    </Text>{' '}
                    extension
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: '#e3f2fd',
                  borderRadius: 6,
                  padding: 10,
                  borderLeftWidth: 4,
                  borderLeftColor: colors.primary,
                }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 5,
                  }}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      marginLeft: 5,
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: colors.primary,
                    }}>
                    Tip:
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#666',
                    lineHeight: 16,
                  }}>
                  When you tap "Browse Files", you'll be prompted to select the
                  backup file. The file picker will automatically filter to show
                  only .db files for easier selection.
                </Text>
              </View>
            </View>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setRecoverDataDialogVisible(() => false);
                // findBackupDataFromDownloads();
                selectBackupDataFromThisDeviceToRecover();
              }}>
              Browse Files
            </Button>
            <Button
              onPress={() => {
                setRecoverDataDialogVisible(() => false);
              }}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={recoverDataWarningsModalVisible}
          onDismiss={() => setRecoverDataWarningsModalVisible(() => false)}>
          <Dialog.Title>Data Recovery Warning</Dialog.Title>
          <Dialog.Content>
            <Text>
              You're about to recover the backup of your database from this
              device.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                findBackupDataFromDownloads();
              }}>
              Recover Data
            </Button>
            <Button onPress={() => {}}>Cancel</Button>
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
          visible={foundBackupDataInfoModalVisible}
          onDismiss={() => setFoundBackupDataInfoModalVisible(() => false)}>
          <Dialog.Title>Selected Backup Data</Dialog.Title>
          {foundBackupDataInfo && (
            <Dialog.Content>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 20,
                }}>
                <MaterialCommunityIcons
                  name="database-outline"
                  size={40}
                  color={colors.dark}
                />
                <View style={{marginLeft: 7}}>
                  <Text style={{color: 'gray'}}>Backup date and time: </Text>
                  <Text style={{fontWeight: 'bold'}}>{`${moment(
                    foundBackupDataInfo.backupDate,
                  ).format('MMMM DD, YYYY, hh:mm A')}`}</Text>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: '#fff3e0',
                  borderRadius: 6,
                  padding: 10,
                  borderLeftWidth: 4,
                  borderLeftColor: '#ff9800',
                }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 5,
                  }}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={16}
                    color="#ff9800"
                  />
                  <Text
                    style={{
                      marginLeft: 5,
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: '#ff9800',
                    }}>
                    Important:
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#666',
                    lineHeight: 16,
                  }}>
                  Please double check the backup date and time of your data
                  before tapping "Restore".
                </Text>
              </View>
              <View>
                <ConfirmationCheckbox
                  status={backupDataOverrideConfirmed}
                  onPress={status => setBackupDataOverrideConfirmed(!status)}
                  text="I understand that restoring backup data will override my current data"
                  containerStyle={{paddingLeft: 0}}
                />
              </View>
            </Dialog.Content>
          )}
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              disabled={!backupDataOverrideConfirmed}
              textColor={colors.notification}
              icon="alert-circle-check-outline"
              onPress={() => {
                recoverBackupDataFromDownloads();
              }}>
              Restore
            </Button>
            <Button
              onPress={() => {
                setFoundBackupDataInfoModalVisible(() => false);
                setBackupDataOverrideConfirmed(false);
              }}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={recoverDataSuccessDialogVisible}
          onDismiss={() => {
            setRecoverDataSuccessDialogVisible(() => false);
            RNRestart.restart();
          }}>
          <Dialog.Title>Data Recovery Success!</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{marginBottom: 15}}>
              {
                'Your backed up data in this device has been successfully recovered.'
              }
            </Paragraph>
            <Paragraph>
              {
                'App will restart automatically to reinitialize your recovered data.'
              }
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setRecoverDataSuccessDialogVisible(() => false);
                RNRestart.restart();
              }}>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={recoverDataFailedDialogVisible}
          onDismiss={() => setRecoverDataFailedDialogVisible(() => false)}>
          <Dialog.Title>Data Recovery Failed!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{'Something went wrong.'}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setRecoverDataFailedDialogVisible(() => false);
              }}>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Download Inventory Data Template modals & dialogs */}
      <Portal>
        <Dialog
          visible={downloadEmptyInvDataTemplateDialogVisible}
          onDismiss={() =>
            setDownloadEmptyInvDataTemplateDialogVisible(() => false)
          }>
          <Dialog.Title>
            Download Sample Empty Inventory Data Template
          </Dialog.Title>
          <Dialog.Content>
            <Text>
              You're about to download a sample empty Inventory Data Template
              file that you can populate with your own list of inventory data.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setExportOptionsModalVisible(() => true);
                setDownloadEmptyInvDataTemplateDialogVisible(() => false);
              }}>
              Next
            </Button>
            <Button
              onPress={() => {
                setDownloadEmptyInvDataTemplateDialogVisible(() => false);
              }}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Import Inventory Data Template modals & dialogs */}
      <Portal>
        <Dialog
          visible={importInvDataTemplateDialogVisible}
          onDismiss={() => setImportInvDataTemplateDialogVisible(() => false)}>
          <Dialog.Title>Import Populated Inventory Data Template</Dialog.Title>
          <Dialog.Content>
            <Text>
              You're about to import your populated Inventory Data Template
              file.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={async () => {
                setImportOptionsModalVisible(() => true);
                setImportInvDataTemplateDialogVisible(() => false);
              }}>
              Next
            </Button>
            <Button
              onPress={() => {
                setImportInvDataTemplateDialogVisible(() => false);
              }}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Modal
          visible={importOptionsModalVisible}
          onDismiss={() => setImportOptionsModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Import Inventory Data Template
          </Title>
          {renderImportOptionsModalContent()}
        </Modal>
      </Portal>
      <Portal>
        <Dialog
          visible={importSuccessDialogVisible}
          onDismiss={() => setImportSuccessDialogVisible(() => false)}>
          <Dialog.Title>Import Completed!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {
                'Your Inventory Data Template file has been successfully scanned and imported.'
              }
            </Paragraph>
            {renderSuccessMessage()}
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                navigation.navigate(routes.items());
                setSuccessMessage(() => '');
                setImportSuccessDialogVisible(() => false);
              }}
              color={colors.primary}>
              {'Go to Inventory'}
            </Button>
            <Button
              onPress={() => {
                setSuccessMessage(() => '');
                setImportSuccessDialogVisible(() => false);
              }}
              color={colors.primary}>
              {'Okay'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={importFailedDialogVisible}
          onDismiss={() => setImportFailedDialogVisible(() => false)}>
          <Dialog.Title>Import failed!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{'Something went wrong.'}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setImportFailedDialogVisible(() => false);
              }}
              color={colors.primary}>
              {'Close'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Export Inventory Data Template modals & dialogs */}
      <Portal>
        <Dialog
          visible={exportInvDataTemplateDialogVisible}
          onDismiss={() => setExportInvDataTemplateDialogVisible(() => false)}>
          <Dialog.Title>Export Inventory as IDT</Dialog.Title>
          <Dialog.Content>
            <Text>
              You're about to export your inventory as an Inventory Data
              Template file that can be re-imported to recreate your items.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setExportPopulatedOptionsModalVisible(() => true);
                setExportInvDataTemplateDialogVisible(() => false);
              }}>
              Next
            </Button>
            <Button
              onPress={() => {
                setExportInvDataTemplateDialogVisible(() => false);
              }}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={exportNeedPermissionDialogVisible}
          onDismiss={() => setExportNeedPermissionDialogVisible(() => false)}>
          <Dialog.Title>Storage permission needed</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{`In order to export file, go to Settings and allow "Files and Media" permission.`}</Paragraph>
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
          <Dialog.Title>File has been successfully downloaded!</Dialog.Title>
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
          <Dialog.Title>Download failed!</Dialog.Title>
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
            Download the Excel File
          </Title>
          {renderExportOptionsModalContent()}
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={exportPopulatedOptionsModalVisible}
          onDismiss={() =>
            setExportPopulatedOptionsModalVisible(() => false)
          }
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Export Inventory as IDT
          </Title>
          {renderExportPopulatedOptionsModalContent()}
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

      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />

      <ErrorMessageModal
        textContent={`${errorMessage}`}
        visible={errorMessage}
        onDismiss={() => {
          setErrorMessage(() => '');
        }}
      />

      <DisabledFeatureModal
        visible={disabledFeatureModalVisible}
        onDismiss={() => {
          setDisabledFeatureModalVisible(() => false);
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{backgroundColor: colors.surface}}>
        <View style={[styles.container, {backgroundColor: colors.surface}]}>
          <View style={{marginBottom: 15, alignItems: 'center'}}>
            <CompanyIcon
              size={150}
              containerStyle={{marginTop: 40, marginBottom: 0}}
            />
            {renderEditCompanyProfileButton()}
          </View>

          {authUser?.is_root_account ? (
            <View style={{alignItems: 'center', marginBottom: 40}}>
              <View
                style={{
                  backgroundColor: colors.accent,
                  padding: 5,
                  paddingHorizontal: 15,
                  borderRadius: 15,
                }}>
                <Text style={{color: colors.surface, fontWeight: 'bold'}}>
                  Root account
                </Text>
              </View>
            </View>
          ) : null}

          {renderUserAccountProfile()}
          {renderTeamMemberCard()}

          {renderCompanyDataSection()}
          {renderDataSyncAndBackupSection()}
          {renderInventoryDataTemplateSection()}
          {renderUsersSection()}

          <Drawer.Section title="More Options">
            {canAccessModule('settings') ? (
              <Drawer.Item
                icon="cog-outline"
                label="Settings"
                onPress={() => {
                  navigation.navigate(routes.settings());
                }}
              />
            ) : null}
            <Drawer.Item
              icon="logout"
              label="Logout"
              onPress={() => {
                signOut();
              }}
            />
          </Drawer.Section>
          <View style={{marginTop: 50, marginBottom: 50, alignItems: 'center'}}>
            <AppIcon
              variant="horizontal"
              styleVariant="shaded"
              size={25}
              textContainerStyle={{marginLeft: 6}}
            />
            <HelperText
              style={{color: colors.neutralTint3, fontSize: 11}}>{`Version ${
              appVersion || ''
            }`}</HelperText>
          </View>
        </View>
      </ScrollView>
      <View>
        <BannerAdComponent unitId={adUnitIds.accountScreenBanner} />
      </View>
    </>
  );
};

export default Account;

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
