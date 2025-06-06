import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {useQuery} from '@tanstack/react-query';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import routes from '../constants/routes';
import CloudAccount from '../screens/CloudAccount';

const Tab = createBottomTabNavigator();

const CloudAccountRootTab = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name={routes.cloudAccount()}
        component={CloudAccount}
        options={{
          headerTitle: 'Cloud Account',
          tabBarStyle: {
            display: 'none',
          },
        }}
      />
    </Tab.Navigator>
  );
};

export default CloudAccountRootTab;
