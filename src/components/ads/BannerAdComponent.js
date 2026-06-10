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

  // Hide ads only where the license is fully active — i.e. both the current
  // device and the current branch are licensed. Entitlement is per-device and
  // per-branch, so ads still show on an unlicensed device or branch.
  if (licenseStatus?.isCurrentlyLicensed) {
    return null;
  }

  return (
    <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
  );
};

export default BannerAdComponent;
