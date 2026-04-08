import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {useQueryClient} from '@tanstack/react-query';
import {runSync} from '../services/syncService';

let syncIntervalId = null;

const startIntervalSync = () => {
  if (syncIntervalId) return;
  runSync().catch(console.warn); // immediate sync on foreground
  syncIntervalId = setInterval(() => {
    runSync().catch(console.warn);
  }, 15_000);
};

const stopIntervalSync = () => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
};

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
        startIntervalSync();
      }

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        stopIntervalSync();
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

    // Start interval if already in foreground on mount
    if (AppState.currentState === 'active') {
      startIntervalSync();
    }

    return () => {
      stopIntervalSync();
      appStateSubscription.remove();
      netInfoUnsubscribe();
    };
  }, [queryClient]);
}
