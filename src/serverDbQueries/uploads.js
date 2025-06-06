import axios from 'axios';
import * as RNFS from 'react-native-fs';

import {configRequestHeader} from '../utils/cloudAuthHelpers';
import urls from '../constants/urls';
import {cloudDataRecovery} from '../constants/dataRecovery';

const API_URL = urls.cloudApiUrl;

export const getLatestUploads = async ({queryKey, pageParam = 1}) => {
  const [_key, {branchId}] = queryKey;

  try {
    const {data} = await axios.get(
      `${API_URL}/api/latest-uploaded?branch_id=${branchId}`,
      {
        headers: await configRequestHeader(),
      },
    );

    const list = data?.data;

    if (!list) throw Error('Invalid data response.');

    return {
      page: pageParam,
      result: list,
    };
  } catch (error) {
    console.debug(error);
  }
};

export const getDbFiles = async ({queryKey}) => {
  const [_key] = queryKey;

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

    const files = await RNFS.readDir(dataRecoveryFilesDirectoryPath);

    const filesMap = {};

    for (let file of files) {
      filesMap[file.name] = {exists: true, file};
    }

    return {
      result: files,
      resultMap: filesMap,
    };
  } catch (error) {
    console.debug(error);
  }
};
