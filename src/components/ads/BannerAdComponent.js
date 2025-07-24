import React from 'react';
import {BannerAd, BannerAdSize, TestIds} from 'react-native-google-mobile-ads';
import appJson from '../../../app.json';

const adUnitId = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : appJson['react-native-google-mobile-ads'].android_app_id;

const BannerAdComponent = () => {
  return (
    <BannerAd unitId={adUnitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
  );
};

export default BannerAdComponent;
