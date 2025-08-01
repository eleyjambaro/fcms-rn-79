import {Platform, NativeModules} from 'react-native';

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
};

export default deviceInfo;
