import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {useQuery} from '@tanstack/react-query';

import routes from '../constants/routes';
import Login from '../screens/Login';
import CreateCompany from '../screens/CreateCompany';
import CreateAccount from '../screens/CreateAccount';
import {hasRootAccount} from '../localDbQueries/accounts';
import {createCompany, hasCompany} from '../localDbQueries/companies';
import FilesAndMediaManagementPermissionNeeded from '../screens/FilesAndMediaManagementPermissionNeeded';

const Stack = createStackNavigator();

const AuthStack = () => {
  const {status: hasCompanyStatus, data: hasCompanyData} = useQuery(
    ['hasCompany'],
    hasCompany,
  );
  const {status: hasRootAccountStatus, data: hasRootAccountData} = useQuery(
    ['hasRootAccount'],
    hasRootAccount,
  );

  if (hasCompanyStatus === 'loading' || hasRootAccountStatus === 'loading') {
    return null;
  }

  if (hasCompanyStatus === 'error' || hasRootAccountStatus === 'error') {
    return null;
  }

  let createCompanyScreen = null;

  let createAccountOrLoginScreen = (
    <Stack.Screen name={routes.createAccount()} component={CreateAccount} />
  );

  if (!hasCompanyData?.result) {
    createCompanyScreen = (
      <Stack.Screen name={routes.createCompany()} component={CreateCompany} />
    );
  }

  if (hasRootAccountData?.result) {
    createAccountOrLoginScreen = (
      <Stack.Screen name={routes.login()} component={Login} />
    );
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {createCompanyScreen}
      {createAccountOrLoginScreen}
      <Stack.Screen
        name={routes.filesAndMediaManagementPermissionNeeded()}
        component={FilesAndMediaManagementPermissionNeeded}
      />
    </Stack.Navigator>
  );
};

export default AuthStack;
