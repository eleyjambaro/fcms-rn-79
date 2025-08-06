import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';

import routes from '../constants/routes';
import CreateNewOrUseExistingAppData from '../screens/CreateNewOrUseExistingAppData';
import SelectExistingAppData from '../screens/SelectExistingAppData';

const Stack = createStackNavigator();

const ReinstallDetectedStack = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen
        name={routes.createNewOrUseExistingAppData()}
        component={CreateNewOrUseExistingAppData}
        options={{title: 'App Data'}}
      />
      <Stack.Screen
        name={routes.selectExistingAppData()}
        component={SelectExistingAppData}
        options={{title: 'Select Backup'}}
      />
    </Stack.Navigator>
  );
};

export default ReinstallDetectedStack;
