import DeviceInfo from 'react-native-device-info';
import {appDefaults} from './appDefaults';

export const localAccountConfig = {
  localAccountConfigPath: `${appDefaults.externalStorageAppDirectoryPath}/.device`,
  configFileName: 'local_account.json',
  configTokenKey: DeviceInfo.getUniqueIdSync(),
  localUserAccountsFileName: 'local_user_accounts.json',
};

export default localAccountConfig;
