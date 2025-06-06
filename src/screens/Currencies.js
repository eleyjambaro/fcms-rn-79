import React, {useState, useEffect} from 'react';
import {View, Text} from 'react-native';
import {
  Button,
  Modal,
  Title,
  Portal,
  Searchbar,
  useTheme,
  Snackbar,
  Card,
  Subheading,
  ActivityIndicator,
} from 'react-native-paper';
import {useQueryClient, useMutation, useQuery} from '@tanstack/react-query';
import CurrencyListLib from 'currency-list';

import routes from '../constants/routes';
import CurrencyList from '../components/currencies/CurrencyList';
import useSearchbarContext from '../hooks/useSearchbarContext';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {getSettings, updateSettings} from '../localDbQueries/settings';

function Currencies(props) {
  const {navigation, viewMode} = props;
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const {keyword, setKeyword} = useSearchbarContext();
  const {
    status: getSettingsStatus,
    data: getSettingsData,
    isRefetching,
    isLoading,
  } = useQuery(['settings', {settingNames: ['currency_code']}], getSettings);

  const onChangeSearch = keyword => setKeyword(keyword);

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const renderCurrentCurrency = () => {
    if (getSettingsStatus === 'loading') {
      return null;
    }

    if (getSettingsStatus === 'error') {
      return null;
    }

    const settings = getSettingsData?.resultMap;

    if (
      !settings ||
      !settings.currency_code ||
      settings.currency_code === '0'
    ) {
      return null;
    }

    const currency = CurrencyListLib.get(settings.currency_code);

    if (settings.currency_code) {
      return (
        <Card style={{marginTop: 5, marginHorizontal: 5}}>
          <Card.Content>
            <View style={{flexDirection: 'row'}}>
              <View>
                <Text style={{fontWeight: 'bold'}}>Currency</Text>
                <Text
                  style={{
                    fontWeight: 'bold',
                    color: colors.dark,
                    marginTop: 10,
                  }}>
                  {`${currency?.name} (${currency?.code}) - ${currency?.symbol}`}
                </Text>
              </View>
              {isRefetching && (
                <ActivityIndicator
                  size={'small'}
                  style={{marginLeft: 'auto'}}
                />
              )}
            </View>
          </Card.Content>
        </Card>
      );
    } else {
      return null;
    }
  };

  return (
    <View style={{flex: 1}}>
      {renderCurrentCurrency()}
      <View style={{flexDirection: 'row', padding: 5}}>
        <Searchbar
          placeholder="Search currency"
          onChangeText={onChangeSearch}
          value={keyword}
          style={{flex: 1}}
        />
      </View>

      <View style={{flex: 1}}>
        <CurrencyList viewMode={viewMode} filter={{keyword}} />
      </View>
    </View>
  );
}

export default Currencies;
