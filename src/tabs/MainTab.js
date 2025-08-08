import * as React from 'react';
import {Pressable, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FeatherIcons from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTheme, Avatar, Text} from 'react-native-paper';

import routes from '../constants/routes';
import Home from '../screens/Home';
import Items from '../screens/Items';
import Reports from '../screens/Reports';
import Inventory from '../screens/Inventory';
import PurchaseEntryList from '../screens/PurchaseEntryList';
import StockUsageEntryList from '../screens/StockUsageEntryList';
import HomeHeader from '../components/headers/HomeHeader';
import Settings from '../screens/Settings';
import CompanyIcon from '../components/icons/CompanyIcon';
import useAuthContext from '../hooks/useAuthContext';
import UnauthorizedAccount from '../screens/UnauthorizedAccount';

const Tab = createBottomTabNavigator();

// Memoize components to prevent unnecessary re-renders
const MemoizedHome = React.memo(Home);
const MemoizedItems = React.memo(Items);
const MemoizedReports = React.memo(Reports);
const MemoizedInventory = React.memo(Inventory);
const MemoizedPurchaseEntryList = React.memo(PurchaseEntryList);
const MemoizedStockUsageEntryList = React.memo(StockUsageEntryList);
const MemoizedSettings = React.memo(Settings);
const MemoizedUnauthorizedAccount = React.memo(UnauthorizedAccount);

const MainTab = React.memo(function MainTab(props) {
  const {navigation} = props;
  const {colors} = useTheme();
  const [{authUser}] = useAuthContext();
  const userRoleConfig = authUser?.role_config;
  const tabBarBadgeStyle = {fontSize: 10, top: -8};

  const renderReportsTabScreen = () => {
    const enabledModule = 'reports';
    let component = MemoizedReports;

    if (authUser.is_root_account) {
      // remain to default values
    } else if (userRoleConfig?.enable?.[0] === '*') {
      // disable overrides enabled behavior
      if (userRoleConfig?.disable?.includes(enabledModule)) {
        component = MemoizedUnauthorizedAccount;
      } else {
        // remain to default values
      }
    } else if (userRoleConfig?.enable?.includes(enabledModule)) {
      // disable overrides enabled behavior
      if (userRoleConfig?.disable?.includes(enabledModule)) {
        component = MemoizedUnauthorizedAccount;
      } else {
        // remain to default values
      }
    } else {
      return null;
    }

    return <Tab.Screen name={routes.reports()} component={component} />;
  };

  const renderSettingsTabScreen = () => {
    const enabledModule = 'settings';
    let component = MemoizedSettings;

    if (authUser.is_root_account) {
      // remain to default values
    } else if (userRoleConfig?.enable?.[0] === '*') {
      // disable overrides enabled behavior
      if (userRoleConfig?.disable?.includes(enabledModule)) {
        component = MemoizedUnauthorizedAccount;
      } else {
        // remain to default values
      }
    } else if (userRoleConfig?.enable?.includes(enabledModule)) {
      // disable overrides enabled behavior
      if (userRoleConfig?.disable?.includes(enabledModule)) {
        component = MemoizedUnauthorizedAccount;
      } else {
        // remain to default values
      }
    } else {
      return null;
    }

    return <Tab.Screen name={routes.settings()} component={component} />;
  };

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home-outline' : 'home-outline';
          } else if (route.name === 'Items') {
            iconName = focused ? 'pricetags-outline' : 'pricetags-outline';
          } else if (route.name === 'Reports') {
            iconName = focused ? 'chart-line' : 'chart-line';
            return (
              <MaterialCommunityIcons
                name={iconName}
                size={size}
                color={color}
              />
            );
          } else if (route.name === 'StockUsageEntryList') {
            iconName = focused
              ? 'text-box-minus-outline'
              : 'text-box-minus-outline';
            return (
              <MaterialCommunityIcons
                name={iconName}
                size={size}
                color={color}
              />
            );
          } else if (route.name === 'PurchaseEntryList') {
            iconName = focused
              ? 'text-box-plus-outline'
              : 'text-box-plus-outline';
            return (
              <MaterialCommunityIcons
                name={iconName}
                size={size}
                color={color}
              />
            );
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings-outline' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.dark,
        tabBarStyle: {height: 74},
        tabBarItemStyle: {marginVertical: 15},
        lazy: true, // Enable lazy loading for tabs
        unmountOnBlur: false, // Keep tabs mounted to prevent flickering
      })}>
      <Tab.Screen
        name={routes.home()}
        component={MemoizedHome}
        options={{
          headerTitle: '',
          headerLeft: () => (
            <CompanyIcon
              size={29}
              variant="horizontal"
              containerStyle={{paddingLeft: 15, marginRight: -10}}
            />
          ),
          headerRight: () => (
            <Pressable
              style={{paddingHorizontal: 15}}
              onPress={() => {
                navigation.navigate(routes.account());
              }}>
              <Avatar.Icon
                size={35}
                icon="account-cog-outline"
                color={colors.dark}
                style={{backgroundColor: colors.neutralTint5}}
              />
            </Pressable>
          ),
        }}
      />
      {renderReportsTabScreen()}
      {renderSettingsTabScreen()}
      {/* <Tab.Group
        screenOptions={{
          tabBarHideOnKeyboard: true,
        }}>
        <Tab.Screen
          name={routes.stockUsageEntryList()}
          component={StockUsageEntryList}
          options={{
            headerTitle: 'Stock Usage List',
            title: 'Stock Usage',
            tabBarBadge: 2,
            tabBarBadgeStyle,
            headerRight: () => {
              return (
                <Pressable
                  style={{marginRight: 15}}
                  onPress={() =>
                    navigation.navigate(routes.stockUsageHistory())
                  }>
                  <MaterialCommunityIcons
                    name="history"
                    size={27}
                    color={colors.dark}
                  />
                </Pressable>
              );
            },
          }}
        />
        <Tab.Screen
          name={routes.purchaseEntryList()}
          component={PurchaseEntryList}
          options={{
            headerTitle: 'Purchase List',
            title: 'Purchase List',
            tabBarBadge: 2,
            tabBarBadgeStyle,
            headerRight: () => {
              return (
                <Pressable
                  style={{marginRight: 15}}
                  onPress={() =>
                    navigation.navigate(routes.purchaseListHistory())
                  }>
                  <MaterialCommunityIcons
                    name="history"
                    size={27}
                    color={colors.dark}
                  />
                </Pressable>
              );
            },
          }}
        />
      </Tab.Group> */}
    </Tab.Navigator>
  );
});

export default MainTab;
