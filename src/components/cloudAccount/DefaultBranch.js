import {
  StyleSheet,
  View,
  PermissionsAndroid,
  Linking,
  Pressable,
  Platform,
  ToastAndroid,
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
} from 'react-native-paper';
import * as RNFS from 'react-native-fs';
import uuid from 'react-native-uuid';
import moment from 'moment';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ManageExternalStorage from 'react-native-manage-external-storage';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import useAuthContext from '../../hooks/useAuthContext';
import routes from '../../constants/routes';
import {cloudDataRecovery} from '../../constants/dataRecovery';
import ErrorMessageModal from '../../components/modals/ErrorMessageModal';
import DisabledFeatureModal from '../../components/modals/DisabledFeatureModal';
import TestModeLimitModal from '../../components/modals/TestModeLimitModal';
import getAppConfig, {appVersion} from '../../constants/appConfig';
import appDefaults from '../../constants/appDefaults';
import CompanyIcon from '../../components/icons/CompanyIcon';
import WatermarkAppIcon from '../../components/icons/WatermarkAppIcon';
import AppIcon from '../../components/icons/AppIcon';

import {configRequestHeader} from '../../utils/cloudAuthHelpers';
import Upload from 'react-native-background-upload';
import urls from '../../constants/urls';
import {createOrGetDesignatedBranch} from '../../serverDbQueries/branches';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import BranchDataStatus from './BranchDataStatus';

const API_URL = urls.apiUrl;

export const uploadFile = async (fileKey = '', otherOptions, hooks) => {
  const {
    onFileWillUpload,
    onFileDidUpload,
    onFileUploadProgress,
    onFileUploadError,
    onFileUploadCancelled,
  } = hooks;

  let customHeaders = otherOptions?.customHeaders
    ? otherOptions.customHeaders
    : {};

  let reqParamaters = otherOptions?.parameters ? otherOptions.parameters : {};

  const options = {
    url: '',
    method: 'POST',
    type: 'multipart',
    field: 'file',
    maxRetries: 2, // set retry count (Android only). Default 2
    headers: {
      'content-type': 'application/octet-stream', // Customize content-type
      ...customHeaders,
    },
    parameters: {
      ...reqParamaters,
    },
    // Below are options only supported on Android
    notification: {
      enabled: false,
    },
    useUtf8Charset: true,
    ...otherOptions,
    path: Platform.select({
      ios: () => 'file://' + otherOptions.path,
      android: () => otherOptions.path.replace('file://', ''),
    })(),
  };

  try {
    const uploadId = await Upload.startUpload(options);
    onFileWillUpload && onFileWillUpload(uploadId, fileKey);

    Upload.addListener('progress', uploadId, data => {
      onFileUploadProgress && onFileUploadProgress(data, uploadId, fileKey);
    });

    Upload.addListener('error', uploadId, data => {
      console.warn(data);
      onFileUploadError && onFileUploadError(data, uploadId, fileKey);
    });

    Upload.addListener('cancelled', uploadId, data => {
      onFileUploadCancelled && onFileUploadCancelled(data, uploadId, fileKey);
    });

    Upload.addListener('completed', uploadId, async data => {
      /** data includes responseCode: number and responseBody: Object **/
      onFileDidUpload && onFileDidUpload(data, uploadId, fileKey);
    });
  } catch (error) {
    throw error;
  }
};

const DefaultBranch = () => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const {
    isRefetching: isRefetchingDesignatedBranch,
    status: designatedBranchStatus,
    data: desginatedBranchData,
    refetch: refetchDesignatedBranch,
  } = useQuery(['designatedBranch'], createOrGetDesignatedBranch);

  const [disabledFeatureModalVisible, setDisabledFeatureModalVisible] =
    useState(false);

  /**
   * Staging Data state
   */
  const [stagingDbSuccessDialogVisible, setStagingDbSuccessDialogVisible] =
    useState(false);
  const [stagingDbFailedDialogVisible, setStagingDbFailedDialogVisible] =
    useState(false);
  const [isStagingDbLoading, setIsStagingDbLoading] = useState(false);
  const [stagingDataInfo, setStagingDataInfo] = useState(null);

  /**
   * Uploading Data state
   */
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dbUploadingFailedDialogVisible, setDbUploadingFailedDialogVisible] =
    useState(false);

  const [needPermissionDialogVisible, setNeedPermissionDialogVisible] =
    useState(false);
  const [
    needStorageManagementPermissionDialogVisible,
    setNeedStorageManagementPermissionDialogVisible,
  ] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const progressEventSub = Upload.addListener('progress', null, data => {
      setIsUploading(() => true);
      setUploadProgress(() => data?.progress);
    });

    const completedEventSub = Upload.addListener('completed', null, _data => {
      setIsUploading(() => false);
    });

    const cancelledEventSub = Upload.addListener('cancelled', null, _data => {
      setIsUploading(() => false);
    });

    const errorEventSub = Upload.addListener('error', null, _data => {
      setIsUploading(() => false);
    });

    return () => {
      progressEventSub.remove();
      completedEventSub.remove();
      cancelledEventSub.remove();
      errorEventSub.remove();
    };
  }, []);

  const sdkVersion = Platform.Version;

  const saveStagingDataToDownloads = async () => {
    setIsStagingDbLoading(() => true);

    try {
      /**
       * Create database recovery directory (to the device Downloads folder)
       */
      const dataRecoveryDirectoryName = cloudDataRecovery.directoryName;

      const dataRecoveryStagingDirectoryPath = `${RNFS.DownloadDirectoryPath}/${dataRecoveryDirectoryName}/${cloudDataRecovery.stagingDirectoryName}`;

      const dataRecoveryStagingDirectoryExists = await RNFS.exists(
        dataRecoveryStagingDirectoryPath,
      );

      /**
       * Clear staging directory first
       */
      if (dataRecoveryStagingDirectoryExists) {
        const files = await RNFS.readDir(dataRecoveryStagingDirectoryPath);

        for (let file of files) {
          if (file?.isFile) {
            RNFS.unlink(file.path);
          }
        }
      }

      if (!dataRecoveryStagingDirectoryExists) {
        await RNFS.mkdir(dataRecoveryStagingDirectoryPath);
      }

      /**
       * Generate database recovery config file token
       */
      const stagingDbId = uuid.v4(); // backup db unique id on the file name
      const stagingDate = Date.now();
      const info = {
        stagingDate,
        // TODO: add more essential details here about the account
      };
      const data = {
        id: stagingDbId,
        info,
      };

      /**
       * Create database recovery config file (dbr_cfg.json)
       */
      const configFileName = cloudDataRecovery.configFileName;
      const configFileData = {
        ...data,
      };

      const configFileDataJson = JSON.stringify(configFileData);

      // move the existing config file to the app files directory
      if (
        await RNFS.exists(
          `${dataRecoveryStagingDirectoryPath}/${configFileName}`,
        )
      ) {
        await RNFS.moveFile(
          `${dataRecoveryStagingDirectoryPath}/${configFileName}`,
          `${
            RNFS.ExternalDirectoryPath
          }/${configFileName}_replaced_${Date.now()}`,
        );
      }

      await RNFS.writeFile(
        `${dataRecoveryStagingDirectoryPath}/${configFileName}`,
        configFileDataJson,
        'utf8',
      );

      const stagingDbName = `${cloudDataRecovery.stagingDbPrefix}${stagingDbId}`;

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
       * Copy sqlite database file from databases directory to data recovery directory
       */
      const dbFilePath = `${databasesDirectoryPath}/${appDefaults.dbName}`;

      const dbFileExists = await RNFS.exists(dbFilePath);

      if (dbFileExists) {
        await RNFS.copyFile(
          dbFilePath,
          `${dataRecoveryStagingDirectoryPath}/${stagingDbName}`,
        );
      }

      setStagingDataInfo(() => info);
      setStagingDbSuccessDialogVisible(() => true);
    } catch (error) {
      console.debug(error);

      if (error.code === 'ENOENT') {
        setNeedStorageManagementPermissionDialogVisible(() => true);
      } else {
        setStagingDbFailedDialogVisible(() => true);
      }
    } finally {
      setIsStagingDbLoading(() => false);
    }
  };

  const findStagingDataAndUploadToServer = async () => {
    const branchId = desginatedBranchData?.branch?.id;

    if (!branchId) return;

    setIsUploading(() => true);

    try {
      /**
       * Locate database recovery staging directory (from device Downloads folder)
       */
      const dataRecoveryDirectoryName = cloudDataRecovery.directoryName;

      const dataRecoveryStagingDirectoryPath = `${RNFS.DownloadDirectoryPath}/${dataRecoveryDirectoryName}/${cloudDataRecovery.stagingDirectoryName}`;

      const dataRecoveryStagingDirectoryExists = await RNFS.exists(
        dataRecoveryStagingDirectoryPath,
      );

      if (!dataRecoveryStagingDirectoryExists) {
        let errMsg = 'Database recovery staging directory not found.';
        setErrorMessage(() => errMsg);
        return;
      }

      /**
       * Get database recovery config file
       */
      const configFileName = cloudDataRecovery.configFileName;
      const configFileJson = await RNFS.readFile(
        `${dataRecoveryStagingDirectoryPath}/${configFileName}`,
        'utf8',
      );

      if (!configFileJson) {
        let errMsg = 'Database staging config file not found.';
        setErrorMessage(() => errMsg);
        return;
      }

      const configFileData = JSON.parse(configFileJson);
      const stagingDbId = configFileData?.id;
      const stagingDbName = `${cloudDataRecovery.stagingDbPrefix}${stagingDbId}`;

      /**
       * Upload staging db file from Downloads (staging directory)
       */
      const stagingDbFilePath = `${dataRecoveryStagingDirectoryPath}/${stagingDbName}`;

      const stagingDbFileExists = await RNFS.exists(stagingDbFilePath);

      if (!stagingDbFileExists) {
        let errMsg = 'Database staging file not found.';
        setErrorMessage(() => errMsg);
        return;
      }

      await uploadFile(
        'file',
        {
          url: urls.cloudBackupFileUploadUrl,
          path: stagingDbFilePath,
          customHeaders: await configRequestHeader(),
          parameters: {
            branch_id: `${branchId}`,
          },
        },
        {
          onFileWillUpload: () => {
            setIsUploading(() => true);
          },
          onFileUploadCancelled: () => {
            setIsUploading(() => false);
          },
          onFileUploadError: () => {
            setIsUploading(() => false);
          },
          onFileDidUpload: async () => {
            // queryClient.invalidateQueries('latestUploads');

            console.debug('UPLOAD COMPELETED!');

            ToastAndroid.showWithGravityAndOffset(
              'Upload completed!',
              ToastAndroid.SHORT,
              ToastAndroid.BOTTOM,
              0,
              200,
            );

            // move the recovered database file from staging to files directory to make the download optional only
            await RNFS.moveFile(
              stagingDbFilePath,
              `${RNFS.DownloadDirectoryPath}/${dataRecoveryDirectoryName}/${cloudDataRecovery.filesDirectoryName}/${stagingDbName}`,
            );

            setIsUploading(() => false);
          },
          onFileUploadProgress: (data, uploadId, fileKey) => {
            setIsUploading(() => true);
            setUploadProgress(() => data?.progress);
          },
        },
      );
    } catch (error) {
      console.debug(error);

      if (error.code === 'ENOENT') {
        setNeedStorageManagementPermissionDialogVisible(() => true);
      } else {
        setDbUploadingFailedDialogVisible(() => true);
      }
    } finally {
      setIsUploading(() => false);
    }
  };

  const handlePressUploadData = async () => {
    try {
      const {enableBackupDataLocally} = await getAppConfig();

      if (!enableBackupDataLocally) {
        setDisabledFeatureModalVisible(() => true);
        return;
      }

      // for android 11 or higher
      if (sdkVersion >= 30) {
        // No need a run-time permission
        saveStagingDataToDownloads();
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
            saveStagingDataToDownloads();
          } else {
            // Permission denied
            console.log('Write External Storage Permission denied');
            setNeedPermissionDialogVisible(() => true);
          }
        } else {
          // Already have Permission
          saveStagingDataToDownloads();
        }
      }
    } catch (e) {
      console.log('Error while checking permission');
      console.log(e);
      return;
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

  if (designatedBranchStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (designatedBranchStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const branch = desginatedBranchData?.branch;

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

      {/* Staging Data Locally modals and Dialogs */}
      <Portal>
        <Dialog
          visible={stagingDbSuccessDialogVisible}
          onDismiss={() => setStagingDbSuccessDialogVisible(() => false)}>
          <Dialog.Title>Latest data is ready to upload</Dialog.Title>
          {stagingDataInfo && (
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
                  <Text style={{color: 'gray'}}>Data file date and time: </Text>
                  <Text style={{fontWeight: 'bold'}}>{`${moment(
                    stagingDataInfo.stagingDate,
                  ).format('MMM DD, YYYY - hh:mm A')}`}</Text>
                </View>
              </View>
              <View>
                <Text>
                  {
                    'Your current updated data file is now ready to upload. Just tap "Proceed" to send data to server.'
                  }
                </Text>
              </View>
            </Dialog.Content>
          )}
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setStagingDbSuccessDialogVisible(() => false);
                findStagingDataAndUploadToServer();
              }}>
              Proceed
            </Button>
            <Button
              onPress={() => {
                setStagingDbSuccessDialogVisible(() => false);
              }}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={stagingDbFailedDialogVisible}
          onDismiss={() => setStagingDbFailedDialogVisible(() => false)}>
          <Dialog.Title>Failed while preparing data to upload!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{'Something went wrong.'}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setStagingDbFailedDialogVisible(() => false);
              }}>
              Okay
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

      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <View style={{}}>
          <Title>Branch Cloud Storage</Title>
        </View>

        <View style={{marginTop: 20, marginBottom: 10, alignItems: 'center'}}>
          <Avatar.Icon
            size={100}
            icon="storefront-outline"
            color={colors.dark}
            style={{backgroundColor: colors.neutralTint5}}
          />

          {/* <View>
            <Text>{branch?.name}</Text>
          </View> */}
        </View>

        <BranchDataStatus
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />
        <View style={{marginTop: 20}}>
          <Button
            icon={'cloud-upload-outline'}
            mode="contained"
            disabled={isStagingDbLoading || isUploading}
            loading={isStagingDbLoading || isUploading}
            onPress={() => {
              handlePressUploadData();
            }}>
            Upload Latest Data
          </Button>
        </View>
      </View>
    </>
  );
};

export default DefaultBranch;

const styles = StyleSheet.create({
  container: {
    margin: 5,
    padding: 15,
    borderRadius: 5,
  },
});
