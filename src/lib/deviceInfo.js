import {Platform, NativeModules} from 'react-native';
import RNDeviceInfo from 'react-native-device-info';

const isAndroid = Platform.OS === 'android';
const isIOS = Platform.OS === 'ios';

const RNDeviceId = isAndroid ? NativeModules.RNDeviceId : null;

const deviceInfo = {
  async getDeviceId() {
    if (isAndroid && RNDeviceId?.getAndroidId) {
      try {
        const id = await RNDeviceId.getAndroidId();
        return id;
      } catch (error) {
        console.error('Failed to get Android ID:', error);
        return null;
      }
    } else if (isIOS) {
      console.log('[deviceInfo] getDeviceId: run iOS get device (placeholder)');
      return null;
    } else {
      console.warn('[deviceInfo] getDeviceId: unsupported platform');
      return null;
    }
  },

  async getPhysicalDeviceId() {
    try {
      return await RNDeviceInfo.getUniqueId();
    } catch (error) {
      console.error('[deviceInfo] getPhysicalDeviceId failed:', error);
      return null;
    }
  },

  getDeviceName() {
    return RNDeviceInfo.getDeviceNameSync() || RNDeviceInfo.getModel();
  },

  getDeviceFingerprint() {
    const brand = RNDeviceInfo.getBrand();
    const model = RNDeviceInfo.getModel();
    const systemName = RNDeviceInfo.getSystemName();
    const systemVersion = RNDeviceInfo.getSystemVersion();
    const deviceType = RNDeviceInfo.getDeviceType();
    return `${brand}|${model}|${systemName}|${systemVersion}|${deviceType}`;
  },
};

export default deviceInfo;
