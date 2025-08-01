import React, {useState, useEffect, useReducer, useMemo} from 'react';
import SecureStorage, {ACCESSIBLE} from 'react-native-fast-secure-storage';
import {sign, decode} from 'react-native-pure-jwt';

import {CloudAuthContext} from '../types';
import keys from '../../keys';
import deviceInfo from '../../lib/deviceInfo';

const CloudAuthContextProvider = props => {
  const {children} = props;
  const [expiredAuthTokenDialogVisible, setExpiredAuthTokenDialogVisible] =
    useState(false);

  const [state, dispatch] = useReducer(
    (prevState, action) => {
      switch (action.type) {
        case 'RESTORE_TOKEN':
          return {
            ...prevState,
            authToken: action.authToken,
            authUser: action.authUser,
            isLoading: false,
          };
        case 'SIGN_IN':
          return {
            ...prevState,
            isLoading: false,
            isSignout: false,
            authToken: action.authToken,
            authUser: action.authUser,
          };
        case 'SIGN_UP':
          return {
            ...prevState,
            isLoading: false,
            isSignout: false,
            authToken: action.authToken,
            authUser: action.authUser,
            showPostSignupScreen: true,
          };
        case 'SIGN_OUT':
          return {
            ...prevState,
            isLoading: false,
            isSignout: true,
            authToken: null,
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
      authToken: null,
      authUser: null,
    },
  );

  useEffect(() => {
    /** Fetch the token from storage then navigate to our appropriate place **/
    const checkAuth = async () => {
      let authToken = null;
      let authUser = null;

      try {
        /** Use SecureStore or AsyncStorage to get and set user token */
        // authToken = await SecureStore.getItemAsync('cloudAuthToken');
        authToken = null;

        const hasAuthToken = await SecureStorage.hasItem('cloudAuthToken');

        if (hasAuthToken) {
          authToken = await SecureStorage.getItem('cloudAuthToken');
          const deviceId = await deviceInfo.getDeviceId();
          let secretKey = deviceId;

          // decode token
          const {payload} = await decode(
            authToken, // the token
            secretKey, // the secret
            {
              skipValidation: false, // to skip signature and exp verification
            },
          );

          authUser = payload;
        }
      } catch (error) {
        /** Restoring token failed **/
        console.debug(error);
      }

      /** After restoring token, we may need to validate it in production apps **/

      /**
       * This will switch to the App screen or Auth screen and this loading
       * screen will be unmounted and thrown away.
       */
      dispatch({type: 'RESTORE_TOKEN', authToken, authUser});
    };

    const clearAuth = async () => {
      const authToken = null;
      const authUser = null;

      dispatch({type: 'RESTORE_TOKEN', authToken, authUser});
    };

    checkAuth();
  }, []);

  const authActions = useMemo(
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
          authToken: data?.token,
          authUser: data?.user,
        });
      },
      signOut: async () => {
        try {
          const hasAuthToken = await SecureStorage.hasItem('cloudAuthToken');

          if (hasAuthToken) {
            await SecureStorage.removeItem('cloudAuthToken');
          }
        } catch (error) {
          console.debug(error);
        }

        dispatch({type: 'SIGN_OUT'});
      },
      signUp: data => {
        /**
         * In a production app, we need to send user data to server and get a token
         * We will also need to handle errors if sign up failed
         * After getting token, we need to persist the token using `SecureStore`
         * In the example, we'll use a dummy token
         */
        dispatch({
          type: 'SIGN_UP',
          authToken: data?.token,
          authUser: data?.user,
        });
      },
      resignIn: data => {
        dispatch({
          type: 'SIGN_IN',
          authToken: data?.token,
          authUser: data?.user,
        });
      },
      restoreAuth: data => {
        let authToken = null;
        let authUser = null;

        if (data?.authToken && data?.authUser) {
          authToken = data.authToken;
          authUser = data.authUser;
        }

        dispatch({type: 'RESTORE_TOKEN', authToken, authUser});
      },
      hidePostSignupScreen: () => {
        dispatch({type: 'HIDE_POST_SIGNUP_SCREEN'});
      },
      setExpiredAuthTokenDialogVisible,
    }),
    [],
  );

  const otherState = {expiredAuthTokenDialogVisible};

  const otherActions = useMemo(() => ({
    setExpiredAuthTokenDialogVisible,
  }));

  return (
    <CloudAuthContext.Provider
      value={[state, authActions, otherState, otherActions]}>
      {children}
    </CloudAuthContext.Provider>
  );
};

export default CloudAuthContextProvider;
