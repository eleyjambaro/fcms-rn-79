import React, {useState, useCallback} from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {useQuery} from '@tanstack/react-query';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import routes from '../constants/routes';
import {lookupBranch} from '../serverDbQueries/v2/devices';

import CloudV2SignIn from '../screens/CloudV2SignIn';
import CloudV2SignUpStep1 from '../screens/CloudV2SignUpStep1';
import CloudV2SignUpStep2 from '../screens/CloudV2SignUpStep2';
import CloudV2OTPVerification from '../screens/CloudV2OTPVerification';
import CloudV2OnboardingSetPassword from '../screens/CloudV2OnboardingSetPassword';
import CloudV2DeviceRegistration from '../screens/CloudV2DeviceRegistration';
import CloudV2BranchSetup from '../screens/CloudV2BranchSetup';
import CloudV2TeamAssignment from '../screens/CloudV2TeamAssignment';
import CloudV2SubAccountSignIn from '../screens/CloudV2SubAccountSignIn';
import Splash from '../screens/Splash';

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
  const [cloudAuthState, {setDesignatedBranch}] = useCloudAuthContext();

  const hasAuth = !!(cloudAuthState.authToken && cloudAuthState.authUser);
  const hasDevice = !!(cloudAuthState.deviceId && cloudAuthState.deviceToken);
  const hasBranch = !!cloudAuthState.designatedBranch;

  // Tracks whether the server-side branch check for Phase 3 has resolved.
  // Starts false so we show Splash while the check is in-flight.
  // Only flipped to true when we KNOW the device has no branch — meaning the
  // BranchSetup screen is safe to show. When a branch IS found, setDesignatedBranch
  // makes hasBranch true before we ever flip this, so App.js switches to RootStack
  // without BranchSetup ever being visible.
  const [branchCheckDone, setBranchCheckDone] = useState(false);

  const handleBranchCheckSuccess = useCallback(
    async data => {
      if (data?.data?.branch) {
        // Branch found on server: apply it. hasBranch becomes true → App.js
        // renders RootStack. We deliberately do NOT set branchCheckDone here
        // so Splash stays visible during the async setDesignatedBranch work.
        await setDesignatedBranch(data.data.branch);
      } else {
        setBranchCheckDone(true);
      }
    },
    [setDesignatedBranch],
  );

  const handleBranchCheckError = useCallback(() => {
    // Server unreachable — let the user pick manually
    setBranchCheckDone(true);
  }, []);

  // When the device is registered but no branch is stored locally, check the
  // server before showing the branch selection screen — the device may already
  // be assigned to a branch (e.g. after a reinstall that cleared local storage).
  useQuery(
    ['cloudV2DeviceMe', cloudAuthState.deviceId],
    ({queryKey}) => lookupBranch(queryKey[1]),
    {
      enabled: hasAuth && hasDevice && !hasBranch,
      onSuccess: handleBranchCheckSuccess,
      onError: handleBranchCheckError,
    },
  );

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

  // Phase 3: authenticated + device, but no branch assigned yet.
  // Hold on Splash until branchCheckDone — this prevents the branch selection
  // screen from flashing when the device already has a server-side branch.
  if (hasAuth && hasDevice) {
    if (!branchCheckDone) {
      return <Splash />;
    }
    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen
          name={routes.cloudV2BranchSetup()}
          component={CloudV2BranchSetup}
        />
        <Stack.Screen
          name={routes.cloudV2TeamAssignment()}
          component={CloudV2TeamAssignment}
        />
      </Stack.Navigator>
    );
  }

  // Phase 1: not authenticated — show full sign in / sign up flow.
  // Default to the sign-in screen matching the last successful sign-in: a team
  // member (sub-account) lands on Team Member Sign In, everyone else (owner /
  // first run) on Company Owner Sign In.
  const initialAuthRoute =
    cloudAuthState.lastSignInAccountType === 'sub'
      ? routes.cloudV2SubAccountSignIn()
      : routes.cloudV2SignIn();

  return (
    <Stack.Navigator
      initialRouteName={initialAuthRoute}
      screenOptions={{headerShown: false}}>
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
      <Stack.Screen
        name={routes.cloudV2OnboardingSetPassword()}
        component={CloudV2OnboardingSetPassword}
      />
      <Stack.Screen
        name={routes.cloudV2SubAccountSignIn()}
        component={CloudV2SubAccountSignIn}
      />
    </Stack.Navigator>
  );
};

export default CloudAuthStackV2;
