import axios from 'axios';
import {
  configRequestHeader,
  getAuthToken,
  storeAuthToken,
} from '../utils/cloudAuthHelpers';

import urls from '../constants/urls';
import {getDeviceImplantedUniqueId} from '../constants/deviceImplantedUniqueIdConfig';
import {getCompany} from '../localDbQueries/companies';

const API_URL = urls.cloudApiUrl;

export const loginUser = async ({values, onError}) => {
  try {
    const {data} = await axios.post(`${API_URL}/api/users/log`, values);

    if (!data?.user || !data?.token || data?.error) {
      onError && onError({errorMessage: data?.error});
      return;
    }

    await storeAuthToken(data?.token);

    return data;
  } catch (error) {
    if (error?.response?.data?.error) {
      onError && onError({errorMessage: error?.response?.data?.error});
    }

    throw error;
  }
};

export const createOrGetDesignatedBranch = async () => {
  try {
    const authToken = await getAuthToken();

    if (!authToken) {
      return {authToken, authUser: null};
    }

    // get DIUID
    const diuid = await getDeviceImplantedUniqueId();

    // get set Branch name to use as default
    const getCompanyData = await getCompany({queryKey: ['company']});
    const company = getCompanyData?.result;
    const branchName = company?.branch ? company.branch : 'Unnamed Branch';

    const values = {
      device_id: diuid,
      branch_name: branchName,
    };

    const {data} = await axios.post(`${API_URL}/api/get-branch`, values, {
      headers: await configRequestHeader(),
    });

    if (!data.branch) {
      return {};
    }

    return data;
  } catch (error) {
    console.log(error);
  }
};
