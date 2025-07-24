import {StyleSheet, Image, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import React, {useEffect, useState} from 'react';
import {
  TestIds,
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeMediaView,
  NativeAdEventType,
  NativeAssetType,
} from 'react-native-google-mobile-ads';

const NativeAdComponent = () => {
  const [nativeAd, setNativeAd] = useState();
  const {colors} = useTheme();

  useEffect(() => {
    NativeAd.createForAdRequest(TestIds.NATIVE)
      .then(setNativeAd)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!nativeAd) return;
    const listener = nativeAd.addAdEventListener(
      NativeAdEventType.CLICKED,
      () => {
        console.info('Native ad clicked');
      },
    );
    return () => {
      listener.remove();
      // or
      nativeAd.destroy();
    };
  }, [nativeAd]);

  const renderHeadline = () => {
    if (nativeAd.headline)
      return (
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text style={{fontSize: 18, fontWeight: 'bold'}}>
            {nativeAd.headline}
          </Text>
        </NativeAsset>
      );
  };

  if (!nativeAd) {
    return null;
  }

  return (
    //  Wrap all the ad assets in the NativeAdView component, and register the view with the nativeAd prop
    <NativeAdView
      nativeAd={nativeAd}
      style={{
        padding: 5,
        backgroundColor: colors.primary,
      }}>
      {/* Display the icon asset with Image component, and use NativeAsset to
      register the view */}

      {nativeAd.icon && (
        <NativeAsset assetType={NativeAssetType.ICON}>
          <Image source={{uri: nativeAd.icon.url}} width={50} height={50} />
        </NativeAsset>
      )}
      {/* Display the headline asset with Text component, and use NativeAsset to
      register the view */}
      {/* {renderHeadline()} */}
      <View>
        <Text style={{fontSize: 18, fontWeight: 'bold'}}>
          {nativeAd.headline}
        </Text>
      </View>

      {/* Always display an ad attribution to denote that the view is an
      advertisement */}
      <View>
        <Text
          style={{
            alignSelf: 'flex-end',
            color: colors.surface,
            fontWeight: 'bold',
          }}>
          Sponsored
        </Text>
      </View>

      {/* Display the media asset */}
      {/* <NativeMediaView /> */}
      {/* Repeat the process for the other assets in the NativeAd. */}
    </NativeAdView>
  );
};

export default NativeAdComponent;

const styles = StyleSheet.create({});
