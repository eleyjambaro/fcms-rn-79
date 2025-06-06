import React, {useState, useEffect, useReducer, useMemo} from 'react';

import {AccountSetupContext} from '../types';

const AccountSetupContextProvider = props => {
  const {children} = props;

  const [state, dispatch] = useReducer(
    (prevState, action) => {
      switch (action.type) {
        case 'RESTORE_TOKEN':
          return {
            ...prevState,
            licenseToken: action.licenseToken,
            authUser: action.authUser,
            isLoading: false,
          };
        case 'SIGN_IN':
          return {
            ...prevState,
            isSignout: false,
            licenseToken: action.licenseToken,
            authUser: action.authUser,
          };
        case 'SIGN_UP':
          return {
            ...prevState,
            isSignout: false,
            licenseToken: action.licenseToken,
            authUser: action.authUser,
            showPostSignupScreen: true,
          };
        case 'SIGN_OUT':
          return {
            ...prevState,
            isSignout: true,
            licenseToken: null,
            authUser: null,
            showPostSignupScreen: false,
          };
        case 'HIDE_POST_SIGNUP_SCREEN':
          return {
            ...prevState,
            showPostSignupScreen: false,
          };
      }
    },
    {
      isLoading: true,
      isSignout: false,
      showPostSignupScreen: false,
      licenseToken: null,
      authUser: null,
    },
  );

  useEffect(() => {
    /** Fetch the token from storage then navigate to our appropriate place **/
    const checkAuth = async () => {
      let licenseToken;

      try {
        /** Use SecureStore or AsyncStorage to get and set user token */
        // licenseToken = await SecureStore.getItemAsync('licenseToken');
        licenseToken = null;
      } catch (e) {
        /** Restoring token failed **/
      }

      /** After restoring token, we may need to validate it in production apps **/

      /**
       * This will switch to the App screen or Auth screen and this loading
       * screen will be unmounted and thrown away.
       */
      dispatch({type: 'RESTORE_TOKEN', token: licenseToken});
    };

    checkAuth();
  }, []);

  const accountSetupActions = useMemo(
    () => ({
      signIn: async data => {
        /**
         * In a production app, we need to send some data (usually username, password) to server and get a token
         * We will also need to handle errors if sign in failed
         * After getting token, we need to persist the token using `SecureStore`
         * In the example, we'll use a dummy token
         */
        dispatch({
          type: 'SIGN_IN',
          licenseToken: 'dummy-license-token',
          authUser: data?.authUser,
        });
      },
      signOut: () => dispatch({type: 'SIGN_OUT'}),
      signUp: async data => {
        /**
         * In a production app, we need to send user data to server and get a token
         * We will also need to handle errors if sign up failed
         * After getting token, we need to persist the token using `SecureStore`
         * In the example, we'll use a dummy token
         */
        dispatch({
          type: 'SIGN_UP',
          licenseToken: 'dummy-license-token',
          authUser: data?.authUser,
        });
      },
      hidePostSignupScreen: () => {
        dispatch({type: 'HIDE_POST_SIGNUP_SCREEN'});
      },
    }),
    [],
  );

  return (
    <AccountSetupContext.Provider value={[state, accountSetupActions]}>
      {children}
    </AccountSetupContext.Provider>
  );
};

export default AccountSetupContextProvider;
