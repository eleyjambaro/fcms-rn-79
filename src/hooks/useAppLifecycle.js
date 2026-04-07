import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {useQueryClient} from '@tanstack/react-query';
import {runSync} from '../services/syncService';

export default function useAppLifecycle() {
  const appState = useRef(AppState.currentState);
  const wasConnected = useRef(null); // null = unknown (startup)
  const queryClient = useQueryClient();

  useEffect(() => {
    // --- AppState: foreground detection ---
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      const isForeground =
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active';

      if (isForeground || nextAppState === 'background') {
        queryClient.invalidateQueries(['authTokenStatus']);
        queryClient.invalidateQueries(['licenseKeyStatus']);
      }

      if (isForeground) {
        runSync().catch(console.warn);
      }

      appState.current = nextAppState;
    });

    // --- NetInfo: reconnect detection ---
    const netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const isNowConnected = !!(state.isConnected && state.isInternetReachable);

      if (wasConnected.current === false && isNowConnected) {
        runSync().catch(console.warn);
      }

      wasConnected.current = isNowConnected;
    });

    return () => {
      appStateSubscription.remove();
      netInfoUnsubscribe();
    };
  }, [queryClient]);
}
