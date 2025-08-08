import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable, ToastAndroid} from 'react-native';
import {useTheme} from 'react-native-paper';
import commaNumber from 'comma-number';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {download} from '@kesha-antonov/react-native-background-downloader';
import * as RNFS from 'react-native-fs';
import moment from 'moment';

import {
  getItemAvgUnitCost,
  getItemCurrentStockQuantity,
} from '../../localDbQueries/inventoryLogs';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import {cloudDataRecovery} from '../../constants/dataRecovery';

const downloadFile = async ({url, fileId, fileName}, onSuccess) => {
  try {
    /**
     * Create database recovery directory (to the device Downloads folder)
     */
    const dataRecoveryDirectoryName = cloudDataRecovery.directoryName;

    const dataRecoveryFilesDirectoryPath = `${RNFS.DownloadDirectoryPath}/${dataRecoveryDirectoryName}/${cloudDataRecovery.filesDirectoryName}`;

    const dataRecoveryFilesDirectoryExists = await RNFS.exists(
      dataRecoveryFilesDirectoryPath,
    );

    if (!dataRecoveryFilesDirectoryExists) {
      await RNFS.mkdir(dataRecoveryFilesDirectoryPath);
    }

    let task = download({
      id: `${fileId}`,
      url,
      destination: `${dataRecoveryFilesDirectoryPath}/${fileName}`,
    })
      .begin(({expectedBytes, headers}) => {
        console.log(`Going to download ${expectedBytes} bytes!`);
      })
      .progress(({bytesDownloaded, bytesTotal}) => {
        console.log(`Downloaded: ${(bytesDownloaded / bytesTotal) * 100}%`);
      })
      .done(({bytesDownloaded, bytesTotal}) => {
        console.log('Download is done!', {bytesDownloaded, bytesTotal});

        ToastAndroid.showWithGravityAndOffset(
          'Download completed!',
          ToastAndroid.SHORT,
          ToastAndroid.BOTTOM,
          0,
          200,
        );

        onSuccess && onSuccess();
      })
      .error(({error, errorCode}) => {
        console.log('Download canceled due to error: ', {error, errorCode});
      });
  } catch (error) {
    console.debug(error);
  }
};

const UploadHistoryListItem = props => {
  const {item, exists, onPressItem, onPressItemOptions} = props;
  const {colors} = useTheme();
  const queryClient = useQueryClient();

  const handleFileDownload = () => {
    downloadFile(
      {
        url: item.download_url,
        fileId: item.file_id,
        fileName: item.file_name,
      },
      () => {
        queryClient.invalidateQueries('dbFiles');
      },
    );
  };

  const renderOptionsOrDownloadButton = () => {
    if (!exists) {
      return (
        <Pressable
          style={styles.optionButtonContainer}
          onPress={handleFileDownload}>
          <MaterialIcons name="file-download" size={20} color={colors.dark} />
        </Pressable>
      );
    }

    return (
      <Pressable
        style={styles.optionButtonContainer}
        onPress={onPressItemOptions}>
        <MaterialIcons name="more-horiz" size={20} color={colors.dark} />
      </Pressable>
    );
  };

  if (!item) return null;

  return (
    <Pressable
      style={[
        styles.container,
        {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
      ]}
      onPress={onPressItem}>
      <View style={styles.wrapper}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <MaterialCommunityIcons
            name="database-outline"
            size={45}
            color={colors.dark}
          />
          <View style={{marginLeft: 15}}>
            <Text style={{color: 'gray'}}>Upload date and time: </Text>
            <Text
              style={{
                fontWeight: 'bold',
                marginVertical: 2,
                color: colors.dark,
              }}>{`${moment(item?.uploaded_date).format(
              'MMM DD, YYYY - hh:mm A',
            )}`}</Text>
            <Text
              style={{
                fontSize: 10,
                color: colors.dark,
                marginTop: 2,
                marginRight: 10,
                flex: 1,
              }}
              numberOfLines={1}>
              {'Ref ID: ' + item.file_name?.split('fcms_data_')?.[1]}
            </Text>
          </View>
        </View>
      </View>

      {renderOptionsOrDownloadButton()}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    width: '100%',
    elevation: 100,
  },
  wrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  optionButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 15,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  qtyContainer: {
    flexDirection: 'row',
    marginLeft: 'auto',
    flex: 1,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  costFrame: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 4,
    marginRight: 5,
    paddingHorizontal: 10,
    height: 38,
    alignItems: 'center',
  },
  costText: {
    fontSize: 14,
    color: 'black',
  },
  col: {
    flex: 1,
  },
  colHeader: {
    flex: 1,
  },
  colHeading: {
    marginBottom: 3,
    textAlign: 'center',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});

export default UploadHistoryListItem;
