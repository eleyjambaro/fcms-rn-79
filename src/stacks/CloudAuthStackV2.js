import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import routes from '../constants/routes';

import CloudV2SignIn from '../screens/CloudV2SignIn';
import CloudV2SignUpStep1 from '../screens/CloudV2SignUpStep1';
import CloudV2SignUpStep2 from '../screens/CloudV2SignUpStep2';
import CloudV2OTPVerification from '../screens/CloudV2OTPVerification';
import CloudV2DeviceRegistration from '../screens/CloudV2DeviceRegistration';
import CloudV2BranchSetup from '../screens/CloudV2BranchSetup';

const Stack = createStackNavigator();

/**
 * CloudAuthStackV2 — handles the full FCMS Cloud v2 onboarding flow:
 *   Phase 1 (no auth):    Sign In → Sign Up Step 1 → Sign Up Step 2 → OTP Verify
 *   Phase 2 (no device):  Device Registration (auto)
 *   Phase 3 (no branch):  Branch Setup
 *
 * The first screen rendered in the Stack becomes the initial screen.
 * As CloudAuthContext state advances, this component re-renders and shows
 * the next phase automatically.
 */
const CloudAuthStackV2 = () => {
  const [cloudAuthState] = useCloudAuthContext();

  const hasAuth = !!(cloudAuthState.authToken && cloudAuthState.authUser);
  const hasDevice = !!(cloudAuthState.deviceId && cloudAuthState.deviceToken);

  // Phase 2: authenticated but no device registered yet
  if (hasAuth && !hasDevice) {
    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen
          name={routes.cloudV2DeviceRegistration()}
          component={CloudV2DeviceRegistration}
        />
      </Stack.Navigator>
    );
  }

  // Phase 3: authenticated + device, but no branch assigned yet
  if (hasAuth && hasDevice) {
    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen
          name={routes.cloudV2BranchSetup()}
          component={CloudV2BranchSetup}
        />
      </Stack.Navigator>
    );
  }

  // Phase 1: not authenticated — show full sign in / sign up flow
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name={routes.cloudV2SignIn()} component={CloudV2SignIn} />
      <Stack.Screen
        name={routes.cloudV2SignUpStep1()}
        component={CloudV2SignUpStep1}
      />
      <Stack.Screen
        name={routes.cloudV2SignUpStep2()}
        component={CloudV2SignUpStep2}
      />
      <Stack.Screen
        name={routes.cloudV2OTPVerification()}
        component={CloudV2OTPVerification}
      />
    </Stack.Navigator>
  );
};

export default CloudAuthStackV2;
