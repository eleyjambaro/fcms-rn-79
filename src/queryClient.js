import {QueryClient} from '@tanstack/react-query';

/**
 * Singleton QueryClient shared between the React tree (via QueryClientProvider)
 * and non-React code such as syncService, which needs to invalidate queries
 * after a successful pull so that the UI re-fetches from the updated SQLite DB.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'online',
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      networkMode: 'online',
      retry: 1,
    },
  },
});
