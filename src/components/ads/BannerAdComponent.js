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

  // Hide ads only on branches where the license is activated. Entitlement is
  // per-branch, so a licensed user still sees ads on an unlicensed branch.
  if (licenseStatus?.isCurrentBranchLicensed) {
    return null;
  }

  return (
    <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
  );
};

export default BannerAdComponent;
