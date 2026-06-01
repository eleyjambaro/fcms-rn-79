export const rnStorageKeys = {
  authToken: 'authToken',
  licenseToken: 'licenseToken',
  licenseKey: 'licenseKey',
  cloudAuthToken: 'cloudAuthToken',
  cloudDefaultEmail: 'cloudDefaultEmail',
  // FCMS Cloud API v2
  cloudV2AuthToken: 'cloudV2AuthToken',
  cloudV2AuthUser: 'cloudV2AuthUser',
  cloudV2DeviceId: 'cloudV2DeviceId',
  cloudV2DeviceToken: 'cloudV2DeviceToken',
  cloudV2DeviceCompanyId: 'cloudV2DeviceCompanyId',
  cloudV2DesignatedBranch: 'cloudV2DesignatedBranch',
  cloudV2DeviceCompanyInfo: 'cloudV2DeviceCompanyInfo',
  // 'root' | 'sub' — account type of the last successful sign-in. Drives which
  // sign-in screen (Company Owner vs Team Member) the auth stack defaults to.
  cloudV2LastSignInAccountType: 'cloudV2LastSignInAccountType',
};

export default rnStorageKeys;
