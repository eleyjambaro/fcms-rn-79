import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';
import {useQueryClient} from '@tanstack/react-query';

export default function useAppLifecycle() {
  const appState = useRef(AppState.currentState);
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const isForeground =
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active';

      if (isForeground || nextAppState === 'background') {
        queryClient.invalidateQueries(['authTokenStatus']);
        queryClient.invalidateQueries(['licenseKeyStatus']);
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [queryClient]);
}
