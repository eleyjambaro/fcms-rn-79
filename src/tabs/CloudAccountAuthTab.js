import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {useQuery} from '@tanstack/react-query';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import routes from '../constants/routes';
import CreateCloudAccount from '../screens/CreateCloudAccount';
import CloudStart from '../screens/CloudStart';
import CloudLogin from '../screens/CloudLogin';
import CloudLoginViaOTP from '../screens/CloudLoginViaOTP';
import {isEmailRegistered} from '../serverDbQueries/auth';

const Tab = createBottomTabNavigator();

const CloudAccountAuthTab = () => {
  return (
    <Tab.Navigator screenOptions={{headerShown: false}}>
      <Tab.Screen
        name={routes.cloudStart()}
        component={CloudStart}
        options={{
          headerTitle: 'Getting Started',
          tabBarStyle: {
            display: 'none',
          },
        }}
      />
      <Tab.Screen
        name={routes.cloudLoginViaOTPThruEmail()}
        component={CloudLoginViaOTP}
        options={{
          headerTitle: 'Cloud Login using OTP',
          tabBarStyle: {
            display: 'none',
          },
        }}
      />
      <Tab.Screen
        name={routes.cloudLogin()}
        component={CloudLogin}
        options={{
          headerTitle: 'Cloud Account Login',
          tabBarStyle: {
            display: 'none',
          },
        }}
      />
      <Tab.Screen
        name={routes.cloudSignup()}
        component={CreateCloudAccount}
        options={{
          headerTitle: 'Create Cloud Account',
          tabBarStyle: {
            display: 'none',
          },
        }}
      />
    </Tab.Navigator>
  );
};

export default CloudAccountAuthTab;
