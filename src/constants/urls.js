import Config from 'react-native-config';

const legacyCloudApiUrl =
  Config.LEGACY_CLOUD_API_URL || 'https://fcms.uxi.rocks';

export const urls = {
  cloudApiUrl: legacyCloudApiUrl,
  cloudBackupFileUploadUrl: `${legacyCloudApiUrl}/api/upload/file`,
};

export default urls;
