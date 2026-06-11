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

// Per-branch license storage. Each branch can be activated with its own
// license key (a company may hold several different keys — one per branch —
// each typically max_branches = 1 / max_devices = 1). The token issued for a
// branch only lists that branch in `allowed_branch_ids`, so a single global
// slot can't hold more than one branch's entitlement. We therefore key the
// stored license key/token by branch id and fall back to the legacy single
// slot (rnStorageKeys.licenseKey / .licenseToken) for users who activated
// before this change. Writes always go to the per-branch slot.
export const branchLicenseKeyStorageKey = branchId =>
  branchId ? `${rnStorageKeys.licenseKey}_${branchId}` : rnStorageKeys.licenseKey;

export const branchLicenseTokenStorageKey = branchId =>
  branchId
    ? `${rnStorageKeys.licenseToken}_${branchId}`
    : rnStorageKeys.licenseToken;

export default rnStorageKeys;
