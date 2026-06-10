import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';

import {getLicenseStatus} from '../../localDbQueries/license';

const BannerAdComponent = props => {
  const {unitId} = props;

  const {data: licenseStatusData} = useQuery(
    ['licenseKeyStatus', {}],
    getLicenseStatus,
  );

  const licenseStatus = licenseStatusData?.result;
  const hasActiveLicense =
    licenseStatus?.hasLicenseToken && !licenseStatus?.isLicenseExpired;

  // Hide ads for users with an active (non-expired) license.
  if (hasActiveLicense) {
    return null;
  }

  return (
    <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
  );
};

export default BannerAdComponent;
