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
import {TRANSFER_PERMISSIONS} from '../constants/transferPermissions';
import {getBatchPurchaseEntriesCount} from '../localDbQueries/batchPurchase';
import {getBatchStockUsageEntriesCount} from '../localDbQueries/batchStockUsage';
import useCurrentUser from '../hooks/useCurrentUser';
import useRoleAccess from '../hooks/useRoleAccess';
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
  const [{}, {signOut}, {expiredAuthTokenDialogVisible}, {}] = useCurrentUser();
  const {can, canAccessModule} = useRoleAccess();
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
    status: getLicenseStatusReqStatus,
    data: getLicenseStatusReqData,
    error,
  } = useQuery(['licenseKeyStatus', {}], getLicenseStatus);

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

  const highlightedFirstRowButtons = [
    'batchPurchase',
    'batchTransfer',
    'endingInventory',
  ]; // batch entry highlighted row
  const mainFirstRowButtons = ['recipes', 'revenues', 'inventory'];
  const mainSecondRowButtons = ['logs', 'vendors', 'spoilage'];
  const mainThirdRowButtons = ['salesLog', 'counter', 'salesOrders'];
  const mainFourthRowButtons = ['sellingMenu'];
  const allButtons = [
    ...highlightedFirstRowButtons,
    ...mainFirstRowButtons,
    ...mainSecondRowButtons,
    ...mainThirdRowButtons,
    ...mainFourthRowButtons,
  ];
  let allMainButtons = [
    ...mainFirstRowButtons,
    ...mainSecondRowButtons,
    ...mainThirdRowButtons,
    ...mainFourthRowButtons, // temporily remove selling menu
  ];

  // Remove disabled features
  const enabledFeatureButtons = allMainButtons.filter(mainButton => {
    if (
      mainButton === 'salesLog' ||
      mainButton === 'counter' ||
      mainButton === 'salesOrders' ||
      mainButton === 'sellingMenu'
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
    batchTransfer: (
      <Pressable
        key={routes.batchTransferTypePicker()}
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
          navigation.navigate(routes.batchTransferTypePicker());
        }}>
        <MaterialCommunityIcons
          name="swap-horizontal-bold"
          size={37}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Batch Transfer
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
    sellingMenu: (
      <Pressable
        key={routes.sellingMenu()}
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
          navigation.navigate(routes.sellingMenu());
        }}>
        <MaterialCommunityIcons
          name="food-fork-drink"
          size={37}
          color={colors.dark}
        />
        <Text numberOfLines={3} style={styles.buttonText}>
          Selling Menu
        </Text>
      </Pressable>
    ),
  };

  // Highlighted batch buttons map onto granular permission keys. (The transfer
  // button uses the `transfer.*` key family, so its module key is `transfer`.)
  const highlightedButtonPermission = {
    batchPurchase: 'batchPurchase',
    batchTransfer: 'transfer',
    endingInventory: 'endingInventory',
  };

  // The "Inventory Batch Entry" group only contains the highlighted buttons, so
  // hide the whole (primary-colored) container when none of them are accessible.
  const hasEnabledHighlightedFirstRowButtons = highlightedFirstRowButtons.some(
    rowButton =>
      canAccessModule(highlightedButtonPermission[rowButton] || rowButton),
  );

  const renderHighlightedFirstRowButtons = () => {
    let jsxArrayOfButtons = [];

    for (let rowButton of highlightedFirstRowButtons) {
      if (
        canAccessModule(highlightedButtonPermission[rowButton] || rowButton)
      ) {
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

    const enabledButtons = allMainButtons.filter(mainButton =>
      canAccessModule(mainButton),
    );

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

  const {open} = state;

  // Speed-dial actions are role-gated: only the creation actions the signed-in
  // user is permitted to perform appear, and the FAB itself hides when none do.
  const fabActions = [];

  if (can(TRANSFER_PERMISSIONS.CREATE)) {
    fabActions.push({
      icon: 'swap-horizontal-bold',
      label: 'Request new Batch Transfer',
      color: colors.dark,
      labelTextColor: colors.dark,
      onPress: () => navigation.navigate(routes.batchTransferRequestForm()),
    });
  }

  if (can('recipes.create')) {
    fabActions.push({
      icon: 'food-turkey',
      label: 'Create Recipe',
      color: colors.dark,
      labelTextColor: colors.dark,
      onPress: () => navigation.navigate(routes.createRecipe()),
    });
  }

  if (can('items.create')) {
    fabActions.push({
      icon: 'tag-plus',
      label: 'Register Item',
      color: colors.dark,
      labelTextColor: colors.dark,
      onPress: () => navigation.navigate(routes.selectAddItemMode()),
      small: false,
    });
  }

  return (
    <>
      <StatusBar barStyle={'dark-content'} />
      {isFocused && !expiredAuthTokenDialogVisible && fabActions.length > 0 ? (
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
            actions={fabActions}
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
          {hasEnabledHighlightedFirstRowButtons && (
            <View
              style={[
                styles.group,
                {
                  padding: groupPadding,
                  backgroundColor: colors.primary,
                },
              ]}>
              <View style={[styles.groupHeader, {flexDirection: 'row'}]}>
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
              <View style={styles.row}>
                {renderHighlightedFirstRowButtons()}
              </View>
            </View>
          )}

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
