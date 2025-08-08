import React from 'react';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';

const BannerAdComponent = props => {
  const {unitId} = props;

  return (
    <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
  );
};

export default BannerAdComponent;
