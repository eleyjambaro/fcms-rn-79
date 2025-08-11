import {useIsFocused} from '@react-navigation/native';
import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  StatusBar,
  ToastAndroid,
} from 'react-native';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';
import {
  Surface,
  useTheme,
  FAB,
  Portal,
  Badge,
  Banner,
  Dialog,
  Paragraph,
  Button,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FeatherIcons from 'react-native-vector-icons/Feather';

import routes from '../constants/routes';
import {env} from '../constants/appConfig';
import {getBatchPurchaseEntriesCount} from '../localDbQueries/batchPurchase';
import {getBatchStockUsageEntriesCount} from '../localDbQueries/batchStockUsage';
import useAuthContext from '../hooks/useAuthContext';
import {getAuthTokenStatus} from '../localDbQueries/accounts';
import {getLicenseStatus} from '../localDbQueries/license';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import appDefaults from '../constants/appDefaults';
import useWindowProperties from '../hooks/useWindowProperties';
import BannerAdComponent from '../components/ads/BannerAdComponent';
import {adUnitIds} from '../constants/adUnitIds';

const Home = props => {
  const {navigation} = props;
  const isFocused = useIsFocused();
  const {colors} = useTheme();
  const [
    {authUser},
    {signOut},
    {expiredAuthTokenDialogVisible},
    {setExpiredAuthTokenDialogVisible},
  ] = useAuthContext();
  const userRoleConfig = authUser?.role_config;
  const {isLandscapeMode, width} = useWindowProperties();
  const {
    status: batchPurchaseEntriesCountStatus,
    data: batchPurchaseEntriesCountData,
  } = useQuery(
    ['batchPurchaseEntriesCount', {autoFetchCurrentId: true}],
    getBatchPurchaseEntriesCount,
  );
  const {
    status: batchStockUsageEntriesCountStatus,
    data: batchStockUsageEntriesCountData,
  } = useQuery(
    ['batchStockUsageEntriesCount', {}],
    getBatchStockUsageEntriesCount,
  );
  const {
    isRefetching: isRefetchingAuthTokenStatus,
    status: authTokenStatus,
    data: authTokenData,
    refetch: refetchAuthTokenStatus,
  } = useQuery(['authTokenStatus'], getAuthTokenStatus);
  const {
    status: getLicenseStatusReqStatus,
    data: getLicenseStatusReqData,
    error,
  } = useQuery(['licenseKeyStatus', {}], getLicenseStatus);

  useEffect(() => {
    if (authTokenData) {
      const {isAuthTokenExpired, authToken} = authTokenData.result;

      if (isFocused) {
        refetchAuthTokenStatus();
      }

      if (
        authTokenStatus !== 'loading' &&
        !isRefetchingAuthTokenStatus &&
        authToken && // do not run if authToken was already deleted
        isAuthTokenExpired
      ) {
        setExpiredAuthTokenDialogVisible(() => true);
      }
    }
  }, [isFocused, authTokenStatus, authTokenData]);

  const wrapperMargin = 0;
  const groupPadding = 10;
  let buttonPerRow = isLandscapeMode ? 6 : 3;
  const spaceBetweenButton = 12;
  const buttonWidth =
    (width - wrapperMargin - groupPadding) / buttonPerRow - spaceBetweenButton;
  const buttonHeight = 120;

  const [state, setState] = React.useState({open: false});
  const [devModeBannerVisible, setDevModeBannerVisible] = useState(
    env === 'dev' ? true : false,
  );
  const [
    licenseNearToExpiredBannerVisible,
    setLicenseNearToExpiredBannerVisible,
  ] = useState(false);

  const onStateChange = ({open}) => setState({open});

  const renderBatchPurchaseButtonBadge = () => {
    if (batchPurchaseEntriesCountStatus === 'loading') return null;

    if (batchPurchaseEntriesCountData && batchPurchaseEntriesCountData > 0)
      return (
        <Badge style={styles.buttonBadge}>
          {batchPurchaseEntriesCountData}
        </Badge>
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

  const licenseStatus = getLicenseStatusReqData?.result;
  const {licenseKey, metadata, isLicenseExpired, appConfigFromLicense} =
    licenseStatus;

  const highlightedFirstRowButtons = ['batchPurchase', 'endingInventory']; // batch entry highlighted row
  const mainFirstRowButtons = ['recipes', 'revenues', 'inventory'];
  const mainSecondRowButtons = ['logs', 'vendors', 'spoilage'];
  const mainThirdRowButtons = ['salesLog', 'counter', 'salesOrders'];
  const allButtons = [
    ...highlightedFirstRowButtons,
    ...mainFirstRowButtons,
    ...mainSecondRowButtons,
    ...mainThirdRowButtons,
  ];
  let allMainButtons = [
    ...mainFirstRowButtons,
    ...mainSecondRowButtons,
    ...mainThirdRowButtons,
  ];

  // Remove unabled features
  const enabledFeatureButtons = allMainButtons.filter(mainButton => {
    if (
      mainButton === 'salesLog' ||
      mainButton === 'counter' ||
      mainButton === 'salesOrders'
    ) {
      if (env === 'dev') {
        return true;
      }

      if (appConfigFromLicense?.enableSales) {
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  });

  allMainButtons = enabledFeatureButtons;

  const jsxButtons = {
    batchPurchase: (
      <Pressable
        key={routes.purchaseEntryList()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.surface,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => {
          navigation.navigate(routes.purchaseEntryList());
        }}>
        {renderBatchPurchaseButtonBadge()}
        <MaterialCommunityIcons
          name="text-box-plus-outline"
          size={37}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Batch Purchase
        </Text>
      </Pressable>
    ),
    endingInventory: (
      <Pressable
        key={routes.endingInventory()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.surface,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => {
          navigation.navigate(routes.endingInventory());
        }}>
        <MaterialCommunityIcons
          name="clipboard-edit-outline"
          size={37}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Ending Inventory
        </Text>
      </Pressable>
    ),
    recipes: (
      <Pressable
        key={routes.recipes()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.neutralTint3,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => {
          navigation.navigate(routes.recipes());
        }}>
        <MaterialCommunityIcons
          name="food-outline"
          size={40}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Recipes
        </Text>
      </Pressable>
    ),
    revenues: (
      <Pressable
        key={routes.revenues()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.neutralTint3,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => {
          navigation.navigate(routes.revenues());
        }}>
        <MaterialCommunityIcons
          name="cash-multiple"
          size={37}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Revenues
        </Text>
      </Pressable>
    ),
    inventory: (
      <Pressable
        key={routes.items()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.neutralTint3,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => navigation.navigate(routes.items())}>
        <MaterialCommunityIcons
          name="clipboard-list-outline"
          size={40}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Inventory
        </Text>
      </Pressable>
    ),
    logs: (
      <Pressable
        key={routes.logs()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.neutralTint3,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => navigation.navigate(routes.logs())}>
        <MaterialCommunityIcons
          name="format-list-bulleted-type"
          size={40}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Inventory Logs
        </Text>
      </Pressable>
    ),
    vendors: (
      <Pressable
        key={routes.vendors()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.neutralTint3,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => {
          navigation.navigate(routes.vendors());
        }}>
        <MaterialCommunityIcons
          name="store-outline"
          size={37}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Vendors
        </Text>
      </Pressable>
    ),
    spoilage: (
      <Pressable
        key={routes.spoilage()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.neutralTint3,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => {
          navigation.navigate(routes.spoilage());
        }}>
        <MaterialCommunityIcons
          name="food-drumstick-off-outline"
          size={35}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Spoilage / Wastage
        </Text>
      </Pressable>
    ),
    salesLog: (
      <Pressable
        key={routes.salesInvoices()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.neutralTint3,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => {
          navigation.navigate(routes.salesInvoices());
        }}>
        <MaterialIcons name="receipt-long" size={37} color={colors.dark} />
        <Text numberOfLines={3} style={styles.buttonText}>
          Sales Invoices
        </Text>
      </Pressable>
    ),
    counter: (
      <Pressable
        key={routes.counter()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.neutralTint3,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => {
          navigation.navigate(routes.counter());
        }}>
        <MaterialCommunityIcons
          name="point-of-sale"
          size={37}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Sales Register
        </Text>
      </Pressable>
    ),
    salesOrders: (
      <Pressable
        key={routes.salesOrderGroups()}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.neutralTint3,
            height: buttonHeight,
            width: buttonWidth,
          },
        ]}
        onPress={() => {
          navigation.navigate(routes.salesOrderGroups());
        }}>
        <MaterialCommunityIcons
          name="clipboard-check-multiple-outline"
          size={37}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Sales Orders
        </Text>
      </Pressable>
    ),
  };

  const renderHighlightedFirstRowButtons = () => {
    let jsxArrayOfButtons = [];

    for (let rowButton of highlightedFirstRowButtons) {
      if (authUser.is_root_account) {
        jsxArrayOfButtons.push(jsxButtons[rowButton]);
      } else if (userRoleConfig?.enable?.[0] === '*') {
        jsxArrayOfButtons.push(jsxButtons[rowButton]);
      }
    }

    // add hidden placeholder button to an empty space of the row
    for (let index = jsxArrayOfButtons.length; index < buttonPerRow; index++) {
      let hiddenPlaceholderButton = (
        <View
          key={index}
          style={{
            height: buttonHeight,
            width: buttonWidth,
            borderRadius: 20,
          }}
        />
      );

      jsxArrayOfButtons.push(hiddenPlaceholderButton);
    }

    return jsxArrayOfButtons;
  };

  const renderMainButtons = () => {
    let numberOfRows = 0;

    const enabledButtons = allMainButtons.filter(mainButton => {
      if (authUser.is_root_account) {
        return true;
      } else if (userRoleConfig?.enable?.[0] === '*') {
        // disable overrides enabled behavior
        if (userRoleConfig?.disable?.includes(mainButton)) {
          return false;
        } else {
          return true;
        }
      } else if (userRoleConfig?.enable?.includes(mainButton)) {
        // disable overrides enabled behavior
        if (userRoleConfig?.disable?.includes(mainButton)) {
          return false;
        } else {
          return true;
        }
      } else {
        return false;
      }
    });

    let mainButtonsToSplice = [...allMainButtons];

    for (
      let index = 0;
      index < mainButtonsToSplice.length;
      index + buttonPerRow
    ) {
      mainButtonsToSplice.splice(0, buttonPerRow);
      numberOfRows++;
    }

    let jsxMainButtonsInsideRowContainers = [];

    let enabledMainButtonsToSplice = [...enabledButtons];

    for (let index = 0; index < numberOfRows; index++) {
      const enabledButtonsInARow = enabledMainButtonsToSplice
        .splice(0, buttonPerRow)
        .map(button => {
          return jsxButtons[button];
        });

      /**
       * Get the incomplete row (the row that is less than buttonPerRow)
       */
      const totalEmptySpaceOfTheRow =
        buttonPerRow - enabledButtonsInARow.length;

      // add hidden placeholder button to an empty space of the row
      for (let index = 0; index < totalEmptySpaceOfTheRow; index++) {
        let hiddenPlaceholderButton = (
          <View
            key={index}
            style={{
              height: buttonHeight,
              width: buttonWidth,
              borderRadius: 20,
            }}
          />
        );

        enabledButtonsInARow.push(hiddenPlaceholderButton);
      }

      const rowContainer = (
        <View key={index} style={styles.row}>
          {enabledButtonsInARow}
        </View>
      );

      jsxMainButtonsInsideRowContainers.push(rowContainer);
    }

    return jsxMainButtonsInsideRowContainers;
  };

  if (authTokenStatus === 'loading') {
    return null;
  }

  if (authTokenStatus === 'error') {
    return null;
  }

  const {open} = state;

  return (
    <>
      <StatusBar barStyle={'dark-content'} />
      {isFocused && !expiredAuthTokenDialogVisible ? (
        <Portal>
          <FAB.Group
            fabStyle={{
              backgroundColor: colors.primary,
              elevation: 3,
              marginBottom: 120,
            }}
            color={colors.dark}
            open={open}
            icon={open ? 'close' : 'plus'}
            actions={[
              {
                icon: 'food-turkey',
                label: 'Create Recipe',
                color: colors.dark,
                labelTextColor: colors.dark,
                onPress: () => navigation.navigate(routes.createRecipe()),
              },
              {
                icon: 'tag-plus',
                label: 'Register Item',
                color: colors.dark,
                labelTextColor: colors.dark,
                onPress: () => navigation.navigate(routes.addItem()),
                small: false,
              },
            ]}
            onStateChange={onStateChange}
            onPress={() => {
              if (open) {
                // do something if the speed dial is open
              }
            }}
          />
        </Portal>
      ) : null}
      <Banner
        style={{backgroundColor: colors.neutralTint5}}
        visible={devModeBannerVisible}
        actions={[
          {
            label: 'Okay',
            onPress: () => setDevModeBannerVisible(() => false),
          },
        ]}
        icon="toolbox-outline">
        Warning: You are running this app in a Development Mode.
      </Banner>
      <Banner
        style={{backgroundColor: colors.neutralTint5}}
        visible={licenseNearToExpiredBannerVisible}
        actions={[
          {
            label: 'Go to Settings',
            onPress: () => navigation.navigate(routes.activateLicense()),
          },
          {
            label: 'Okay',
            onPress: () => setLicenseNearToExpiredBannerVisible(() => false),
          },
        ]}
        icon="key-alert-outline">
        {`Your ${appDefaults.appDisplayName} license will expire soon. You need to renew your license in Settings.`}
      </Banner>
      <ScrollView style={[styles.container, {backgroundColor: colors.surface}]}>
        <View style={[styles.wrapper, {marginHorizontal: wrapperMargin}]}>
          <View
            style={[
              styles.group,
              {
                padding: groupPadding,
                backgroundColor: colors.primary,
              },
            ]}>
            <View style={[styles.groupHeader, {flexDirection: 'row'}]}>
              {/* <View
                style={{
                  backgroundColor: colors.surface,
                  height: 18,
                  width: 18,
                  borderRadius: 18 / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 6,
                }}>
                <MaterialCommunityIcons
                  name="plus-minus-variant"
                  size={14}
                  color={colors.primary}
                />
              </View> */}
              <Text
                style={{
                  marginLeft: 5,
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: colors.surface,
                }}>
                {'Inventory Batch Entry'}
              </Text>
            </View>
            {/* Highlighted first row */}
            <View style={styles.row}>{renderHighlightedFirstRowButtons()}</View>
          </View>

          <View
            style={[styles.group, {padding: groupPadding, paddingBottom: 150}]}>
            {/* <View style={[styles.groupHeader]}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {'Inventory Management'}
              </Text>
            </View> */}
            {/* First row */}
            {renderMainButtons()}
          </View>
        </View>
      </ScrollView>
      <View>
        <BannerAdComponent unitId={adUnitIds.homeScreenBanner} />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
  },
  group: {
    flex: 1,
    marginBottom: 10,
    justifyContent: 'space-between',
    elevation: 2,
  },
  groupHeader: {
    height: 30,
    marginBottom: 10,
    // justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  button: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2b2d42',
  },
  buttonBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  placeholderButton: {},
});

export default Home;
