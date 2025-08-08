import {StyleSheet, View} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  Avatar,
  useTheme,
  Subheading,
} from 'react-native-paper';
import React, {useState} from 'react';
import {Formik} from 'formik';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import moment from 'moment';

import useAuthContext from '../hooks/useAuthContext';
import LicenseForm from '../components/forms/LicenseForm';
import {
  activateLicense,
  getLicenseKey,
  getLicenseKeyStatus,
  getLicenseStatus,
} from '../localDbQueries/license';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import appDefaults from '../constants/appDefaults';
import BannerAdComponent from '../components/ads/BannerAdComponent';
import {adUnitIds} from '../constants/adUnitIds';

const ActivateLicense = props => {
  const {navigation} = props;
  const {colors} = useTheme();
  const [authState, {signIn}] = useAuthContext();
  const {
    status: getLicenseStatusReqStatus,
    data: getLicenseStatusReqData,
    error,
  } = useQuery(['licenseKeyStatus', {}], getLicenseStatus);
  const [changeLicenseKeyFormVisible, setChangeLicenseKeyFormVisible] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const queryClient = useQueryClient();
  const activateLicenseMutation = useMutation(activateLicense, {
    onSuccess: () => {
      queryClient.invalidateQueries('licenseKey');
      queryClient.invalidateQueries('licenseKeyStatus');
    },
  });

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await activateLicenseMutation.mutateAsync({
        values,
        authState,
        onError: ({errorMessage}) => {
          console.debug(errorMessage);
        },
      });

      actions.resetForm();

      if (changeLicenseKeyFormVisible) {
        setChangeLicenseKeyFormVisible(() => false);
      }
    } catch (error) {
      console.debug(error);

      if (error?.message) {
        setErrorMessage(() => `${error.message}`);
      } else {
        setErrorMessage(() => 'License activation failed!');
      }

      actions.resetForm();
    }
  };

  const renderContent = () => {
    const licenseStatus = getLicenseStatusReqData?.result;
    const {licenseKey, metadata, isLicenseExpired} = licenseStatus;
    const {expirationDateInMs} = metadata;
    const expirationDate = new Date(expirationDateInMs);

    const expirationDateFormatted = moment(expirationDate).format(
      'MMMM DD, YYYY, hh:mm A',
    );

    if (licenseKey && isLicenseExpired) {
      return (
        <>
          <View
            style={{
              width: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 30,
            }}>
            <Avatar.Icon
              icon="key-alert-outline"
              size={100}
              color={colors.surface}
            />
          </View>
          <View style={{marginBottom: 25}}>
            <Subheading
              style={{
                fontWeight: 'bold',
                textAlign: 'center',
                color: colors.dark,
              }}>
              {'License expired'}
            </Subheading>
            <Text style={[styles.text]}>
              {`Your ${appDefaults.appDisplayName} digital license has been expired since ${expirationDateFormatted}. You are now using your account with FREE and limited app's feature access. Please renew your license to reupgrade your account.`}
            </Text>
          </View>
          {changeLicenseKeyFormVisible ? (
            <LicenseForm
              autoFocus
              onSubmit={handleSubmit}
              onCancel={() => setChangeLicenseKeyFormVisible(() => false)}
            />
          ) : (
            <TextInput label="License Key" value={licenseKey} disabled />
          )}
          <View style={{marginTop: 10}}>
            {!changeLicenseKeyFormVisible && (
              <Button
                icon="key-remove"
                mode="text"
                onPress={() => {
                  setChangeLicenseKeyFormVisible(() => true);
                }}
                style={{marginTop: 15}}>
                Change license key
              </Button>
            )}
          </View>
        </>
      );
    }

    if (licenseKey) {
      return (
        <>
          <View
            style={{
              width: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 30,
            }}>
            <Avatar.Icon
              icon="shield-key-outline"
              size={100}
              color={colors.surface}
            />
          </View>
          <View style={{marginBottom: 25}}>
            <Subheading
              style={{
                fontWeight: 'bold',
                textAlign: 'center',
                color: colors.dark,
              }}>
              {'License is activated'}
            </Subheading>
            <Text style={[styles.text]}>
              {`Your account is upgraded with ${appDefaults.appDisplayName} digital license. License will expire on ${expirationDateFormatted}.`}
            </Text>
          </View>
          {changeLicenseKeyFormVisible ? (
            <LicenseForm
              autoFocus
              onSubmit={handleSubmit}
              onCancel={() => setChangeLicenseKeyFormVisible(() => false)}
            />
          ) : (
            <TextInput label="License Key" value={licenseKey} disabled />
          )}
          <View style={{marginTop: 10}}>
            {!changeLicenseKeyFormVisible && (
              <Button
                icon="key-plus"
                mode="text"
                onPress={() => {
                  setChangeLicenseKeyFormVisible(() => true);
                }}
                style={{marginTop: 15}}>
                Change license key
              </Button>
            )}
          </View>
        </>
      );
    }

    return (
      <>
        <View
          style={{
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 30,
          }}>
          <Avatar.Icon
            icon="account-key-outline"
            size={100}
            color={colors.surface}
          />
        </View>
        <View style={{marginBottom: 25}}>
          <Subheading
            style={{
              fontWeight: 'bold',
              textAlign: 'center',
              color: colors.dark,
            }}>
            Enter license key
          </Subheading>
          <Text style={[styles.text]}>
            {`Upgrade your account using your ${appDefaults.appDisplayName} license key.`}
          </Text>
        </View>
        <LicenseForm
          onSubmit={handleSubmit}
          onCancel={() => navigation.goBack()}
        />
      </>
    );
  };

  if (getLicenseStatusReqStatus === 'loading') {
    return (
      <DefaultLoadingScreen
        containerStyle={{flex: 1, backgroundColor: colors.surface}}
      />
    );
  }

  if (getLicenseStatusReqStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  return (
    <>
      <ErrorMessageModal
        textContent={`${errorMessage}`}
        visible={errorMessage}
        onDismiss={() => {
          setErrorMessage(() => '');
        }}
      />
      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        {renderContent()}
      </View>
      <View>
        <BannerAdComponent unitId={adUnitIds.activateLicenseScreenBanner} />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
});

export default ActivateLicense;
