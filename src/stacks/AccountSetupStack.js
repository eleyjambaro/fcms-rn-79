import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';

import routes from '../constants/routes';
import CreateAccount from '../screens/CreateAccount';
import CreateCompany from '../screens/CreateCompany';
import ActivateLicense from '../screens/ActivateLicense';

const Stack = createStackNavigator();

const AccountSetupStack = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen
        name={routes.activateLicense()}
        component={ActivateLicense}
      />
      <Stack.Screen name={routes.createCompany()} component={CreateCompany} />
      <Stack.Screen name={routes.createAccount()} component={CreateAccount} />
    </Stack.Navigator>
  );
};

export default AccountSetupStack;
