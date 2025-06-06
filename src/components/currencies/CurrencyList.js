import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TouchableOpacity,
  BackHandler,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  Button,
  useTheme,
  Paragraph,
  Dialog,
  Portal,
  Provider,
  Modal,
  Title,
  Snackbar,
} from 'react-native-paper';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import CurrencyListItem from './CurrencyListItem';
import routes from '../../constants/routes';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import {getCurrencies} from '../../localDbQueries/currencies';
import {getSettings, updateSettings} from '../../localDbQueries/settings';

const CurrencyList = props => {
  const {backAction, viewMode, filter} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [focusedItem, setFocusedItem] = useState(null);
  const [updateSettingsSnackbarVisible, setUpdateSettingsSnackbarVisible] =
    useState(false);
  const {
    status: getCurrenciesStatus,
    data: getCurrenciesData,
    isFetching,
    refetch,
  } = useQuery(['currencies', {filter}], getCurrencies);
  const updateSettingsMutation = useMutation(updateSettings, {
    onSuccess: () => {
      queryClient.invalidateQueries('settings');
    },
  });

  const queryClient = useQueryClient();

  const renderItem = ({item}) => {
    return (
      <CurrencyListItem
        item={item}
        onPressItem={async () => {
          setFocusedItem(() => item);

          try {
            await updateSettingsMutation.mutateAsync({
              values: [
                {
                  name: 'currency_code',
                  value: item.code,
                },
              ],
            });

            setUpdateSettingsSnackbarVisible(() => true);
          } catch (error) {
            console.debug(error);
          }
        }}
      />
    );
  };

  if (getCurrenciesStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (getCurrenciesStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  return (
    <>
      <FlatList
        style={{backgroundColor: colors.surface}}
        data={getCurrenciesData}
        renderItem={renderItem}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              padding: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text>No data to display</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            colors={[colors.primary, colors.accent, colors.dark]}
          />
        }
      />
      <Snackbar
        visible={updateSettingsSnackbarVisible}
        style={{backgroundColor: colors.primary}}
        onDismiss={() => {
          setUpdateSettingsSnackbarVisible(() => false);
        }}
        action={{
          label: 'Okay',
          color: colors.surface,
          onPress: () => {
            setUpdateSettingsSnackbarVisible(() => false);
          },
        }}>
        <Text style={{color: colors.dark}}>
          {' '}
          Currency has been updated successfully!
        </Text>
      </Snackbar>
    </>
  );
};

const styles = StyleSheet.create({
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default CurrencyList;
