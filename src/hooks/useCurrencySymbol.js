import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {useQuery} from '@tanstack/react-query';
import CurrencyListLib from 'currency-list';
import {getSettings} from '../localDbQueries/settings';

const useCurrencySymbol = () => {
  const {status: getSettingsStatus, data: getSettingsData} = useQuery(
    ['settings', {settingNames: ['currency_code']}],
    getSettings,
  );

  if (getSettingsStatus === 'loading') {
    return null;
  }

  if (getSettingsStatus === 'error') {
    return null;
  }

  const settings = getSettingsData?.resultMap;

  if (!settings || !settings.currency_code || settings.currency_code === '0') {
    return null;
  }

  const currency = CurrencyListLib.get(settings.currency_code);

  if (currency) {
    return currency.symbol;
  } else {
    return '';
  }
};

export default useCurrencySymbol;

const styles = StyleSheet.create({});
