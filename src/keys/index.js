import DeviceInfo from 'react-native-device-info';

export const keys = {
  authTokenKey: `${DeviceInfo.getUniqueIdSync()}`,
};

export default keys;
