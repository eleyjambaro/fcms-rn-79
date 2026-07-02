import Config from 'react-native-config';

const legacyCloudApiUrl =
  Config.LEGACY_CLOUD_API_URL || 'https://fcms.uxi.rocks';

// Public URL of the FCMS Cloud web app (Next.js). The About, Privacy Policy,
// and Contact pages it serves are opened from the in-app auth screens. Set
// WEB_APP_URL in your env once the web app's production domain is known.
const webAppUrl = Config.WEB_APP_URL || 'https://fcmscloud.uxi.rocks';

export const urls = {
  cloudApiUrl: legacyCloudApiUrl,
  cloudBackupFileUploadUrl: `${legacyCloudApiUrl}/api/upload/file`,
  webAppUrl,
  aboutUrl: `${webAppUrl}/about`,
  privacyPolicyUrl: `${webAppUrl}/privacy`,
  contactUrl: `${webAppUrl}/contact`,
};

export default urls;
