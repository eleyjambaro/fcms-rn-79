import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  TouchableOpacity,
  BackHandler,
  RefreshControl,
  ToastAndroid,
} from 'react-native';
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
} from 'react-native-paper';
import * as RNFS from 'react-native-fs';
import uuid from 'react-native-uuid';
import {sign, decode} from 'react-native-pure-jwt';
import XLSX from 'xlsx';
import moment from 'moment';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import RNExitApp from 'react-native-exit-app';
import ManageExternalStorage from 'react-native-manage-external-storage';
import csvtojson from 'csvtojson';
import convert from 'convert-units';
import {getLocalUserAccount} from '../localDbQueries/accounts';
import {BottomSheetModal, BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as DocumentPicker from '@react-native-documents/picker';
import RNFetchBlob from 'rn-fetch-blob';
import RNRestart from 'react-native-restart';

import useAuthContext from '../../hooks/useAuthContext';
import routes from '../../constants/routes';
import {
  cloudDataRecovery,
  manualDataRecovery,
} from '../../constants/dataRecovery';
import ErrorMessageModal from '../../components/modals/ErrorMessageModal';
import TestModeLimitModal from '../../components/modals/TestModeLimitModal';
import getAppConfig, {appVersion} from '../../constants/appConfig';
import appDefaults from '../../constants/appDefaults';
import CompanyIcon from '../../components/icons/CompanyIcon';
import WatermarkAppIcon from '../../components/icons/WatermarkAppIcon';
import AppIcon from '../../components/icons/AppIcon';
import DisabledFeatureModal from '../../components/modals/DisabledFeatureModal';
import LocalUserAccountProfile from '../../components/accounts/LocalUserAccountProfile';
import {insertTemplateDataToDb} from '../../localDbQueries/inventoryDataTemplate';
import InventoryDataTemplateFileExportForm from '../../components/forms/InventoryDataTemplateFileExportForm';
import InventoryDataTemplateFileImportForm from '../../components/forms/InventoryDataTemplateFileImportForm';

import axios from 'axios';
import {configRequestHeader} from '../../utils/cloudAuthHelpers';
import Upload from 'react-native-background-upload';
import urls from '../../constants/urls';
import OptionsList from '../buttons/OptionsList';
import {createOrGetDesignatedBranch} from '../../serverDbQueries/branches';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import ListLoadingFooter from '../stateIndicators/ListLoadingFooter';
import {getDbFiles, getLatestUploads} from '../../serverDbQueries/uploads';
import UploadHistoryListItem from './UploadHistoryListItem';
import ConfirmationCheckbox from '../forms/ConfirmationCheckbox';

const UploadHistoryList = props => {
  const {
    filter,
    backAction,
    viewMode,
    listItemDisplayMode,
    listStyle,
    listContentContainerStyle,
  } = props;
  const {colors} = useTheme();

  const {
    isRefetching: isRefetchingDesignatedBranch,
    status: designatedBranchStatus,
    data: desginatedBranchData,
    refetch: refetchDesignatedBranch,
  } = useQuery(['designatedBranch'], createOrGetDesignatedBranch);

  const branchId = desginatedBranchData?.branch?.id;

  const {
    isRefetching: isRefetchingDbFiles,
    status: dbFilesStatus,
    data: dbFilesData,
    refetch: refetchDbFiles,
  } = useQuery(['dbFiles'], getDbFiles);

  const filesMap = dbFilesData?.resultMap;

  const [confirmActionChecked, setConfirmActionChecked] = useState(false);
  const [isRecoverDbLoading, setIsRecoverDbLoading] = useState(false);
  const [recoverDbDialogVisible, setRecoverDbDialogVisible] = useState(false);
  const [recoverDataSuccessDialogVisible, setRecoverDataSuccessDialogVisible] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  const [focusedItem, setFocusedItem] = useState(null);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(['latestUploads', {branchId}], getLatestUploads, {
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
    enabled: branchId ? true : false,
  });

  const queryClient = useQueryClient();

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (data.pages) {
      for (let page of data.pages) {
        pagesData.push(...page.result);
      }
    }

    return pagesData;
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const itemOptions = [
    {
      label: 'Retrieve this data',
      icon: 'database-sync-outline',
      handler: () => {
        closeOptionsBottomSheet();
        setRecoverDbDialogVisible(() => true);
      },
    },
  ];

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, itemOptions.length * 110 + 30],
    [],
  );

  const findDbFileAndRetrieve = async () => {
    const branchId = desginatedBranchData?.branch?.id;

    if (!branchId) return;

    setIsRecoverDbLoading(() => true);

    try {
      /**
       * Get database file
       */
      const file = filesMap?.[focusedItem?.file_name]?.file;

      const dbFilePath = file?.path;
      const dbFileExists = await RNFS.exists(dbFilePath);

      if (!dbFileExists) {
        let errMsg = 'Database backup file not found.';
        setErrorMessage(() => errMsg);
        return;
      }

      /**
       * Create database recovery replaced files directory (from device Downloads folder)
       */
      const dataRecoveryDirectoryName = cloudDataRecovery.directoryName;

      const dataRecoveryReplacedFilesDirectoryPath = `${RNFS.DownloadDirectoryPath}/${dataRecoveryDirectoryName}/${cloudDataRecovery.replacedFilesDirectoryName}`;

      const dataRecoveryReplacedFilesDirectoryExists = await RNFS.exists(
        dataRecoveryReplacedFilesDirectoryPath,
      );

      if (!dataRecoveryReplacedFilesDirectoryExists) {
        await RNFS.mkdir(dataRecoveryReplacedFilesDirectoryPath);
      }

      /**
       * Locate databases path (where sqlite database file is located)
       *
       * /data/user/0/rocks.uxi.fcms/databases
       */
      const paths = RNFS.DocumentDirectoryPath.split('/');
      paths.pop();
      paths.push('databases');
      const databasesDirectoryPath = paths.join('/');

      /**
       * Copy db file from Downloads (database recovery files directory)
       * to databases directory
       */

      // move the existing database file to replaced files directory
      if (
        await RNFS.exists(`${databasesDirectoryPath}/${appDefaults.dbName}`)
      ) {
        await RNFS.moveFile(
          `${databasesDirectoryPath}/${appDefaults.dbName}`,
          `${dataRecoveryReplacedFilesDirectoryPath}/${
            appDefaults.dbName
          }_replaced_${Date.now()}`,
        );
      }

      // replace with backup database file
      await RNFS.copyFile(
        dbFilePath,
        `${databasesDirectoryPath}/${appDefaults.dbName}`,
      );

      setRecoverDataSuccessDialogVisible(() => true);

      console.debug('Data recovery from server success!');
    } catch (error) {
      console.debug(error);
    } finally {
      setIsRecoverDbLoading(() => false);
    }
  };

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

  const renderItem = ({item}) => {
    return (
      <UploadHistoryListItem
        item={item}
        exists={filesMap?.[item?.file_name]?.exists}
        displayMode={listItemDisplayMode}
        onPressItem={() => {
          setFocusedItem(() => item);
        }}
        onPressItemOptions={() => {
          setFocusedItem(() => item);
          openOptionsBottomSheet();
        }}
      />
    );
  };

  if (
    status === 'loading' ||
    designatedBranchStatus === 'loading' ||
    dbFilesStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    status === 'error' ||
    designatedBranchStatus === 'error' ||
    dbFilesStatus === 'error'
  ) {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  return (
    <>
      <Portal>
        <Dialog
          visible={recoverDbDialogVisible}
          onDismiss={() => {
            setRecoverDbDialogVisible(() => false);
            setConfirmActionChecked(() => false);
          }}>
          <Dialog.Title>Retrieve old data?</Dialog.Title>
          {focusedItem && (
            <Dialog.Content style={{alignItems: 'center'}}>
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
                  <Text style={{color: 'gray'}}>Upload date and time: </Text>
                  <Text style={{fontWeight: 'bold'}}>{`${moment(
                    focusedItem.uploaded_date,
                  ).format('MMM DD, YYYY - hh:mm A')}`}</Text>
                </View>
              </View>
              <View>
                <Text>{`WARNING: When you retrieve this old uploaded data, this will override your current database state. Are you sure you want to swap your current existing data with this old data?`}</Text>
              </View>
              <ConfirmationCheckbox
                status={confirmActionChecked}
                text="I understand and let's recover this old data"
                onPress={() => {
                  setConfirmActionChecked(!confirmActionChecked);
                }}
              />
            </Dialog.Content>
          )}
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              disabled={!confirmActionChecked}
              onPress={() => {
                if (!confirmActionChecked) return;

                setRecoverDbDialogVisible(() => false);
                setConfirmActionChecked(() => false);
                findDbFileAndRetrieve();
              }}>
              Proceed
            </Button>
            <Button
              onPress={() => {
                setRecoverDbDialogVisible(() => false);
                setConfirmActionChecked(() => false);
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
                'Your old uploaded data from the server has been successfully recovered.'
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

      <ErrorMessageModal
        textContent={`${errorMessage}`}
        visible={errorMessage}
        onDismiss={() => {
          setErrorMessage(() => '');
        }}
      />

      <FlatList
        contentContainerStyle={listContentContainerStyle}
        style={[{backgroundColor: colors.surface}, listStyle]}
        data={getAllPagesData()}
        keyExtractor={item => item.file_id}
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
            refreshing={
              (isRefetching || isRefetchingDbFiles) && !isFetchingNextPage
            }
            onRefresh={() => {
              refetch();
              refetchDbFiles();
            }}
            colors={[colors.primary, colors.accent, colors.dark]}
          />
        }
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

export default UploadHistoryList;

const styles = StyleSheet.create({
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});
