import 'react-native-gesture-handler';
import * as React from 'react';
import {AppRegistry, useColorScheme} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {
  PaperProvider,
  MD2DarkTheme as PaperDarkTheme,
  MD2LightTheme as PaperDefaultTheme,
  adaptNavigationTheme,
} from 'react-native-paper';
import {
  NavigationContainer,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';
import {navigationRef} from './RootNavigation'; // see: https://reactnavigation.org/docs/navigating-without-navigation-prop/
import merge from 'deepmerge';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {gestureHandlerRootHOC} from 'react-native-gesture-handler';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {TabsProvider} from 'react-native-paper-tabs';

import ItemFormContextProvider from './src/context/providers/ItemFormContextProvider';
import ExpenseFormContextProvider from './src/context/providers/ExpenseFormContextProvider';
import SearchbarContextProvider from './src/context/providers/SearchbarContextProvider';
import RecipeFormContextProvider from './src/context/providers/RecipeFormContextProvider';

import AddedIngredientsContextProvider from './src/context/providers/AddedIngredientsContextProvider';
import SellingMenuFormContextProvider from './src/context/providers/SellingMenuFormContextProvider';
import AddedSellingMenuItemsContextProvider from './src/context/providers/AddedSellingMenuItemsContextProvider';

import AppConfigContextProvider from './src/context/providers/AppConfigContextProvider';
import SalesCounterContextProvider from './src/context/providers/SalesCounterContextProvider';
import CloudAuthContextProvider from './src/context/providers/CloudAuthContextProvider';
import DefaultPrinterContextProvider from './src/context/providers/DefaultPrinterContextProvider';
import AuthContextProvider from './src/context/providers/AuthContextProvider';

const {
  LightTheme: adaptedNavigationLightTheme,
  DarkTheme: adaptedNavigationDarkTheme,
} = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

const pastelBlueTheme = {
  primary: '#00B4D8',
  accent: '#00D8C6',
  dark: '#2b2d42',
  neutral: '#494848',
  neutralTint1: '#636363',
  neutralTint2: '#909090',
  neutralTint3: '#B4B4B4',
  neutralTint4: '#D4D4D4',
  neutralTint5: '#ECECEC',
  highlighted: '#d8f9ff',
  highlightedUpdating: 'rgba(0,180,216, .50)',
  highlightedError: '#ffe9ec',
};

const orangeMono = {
  primary: '#ffb048', // rgba(255,176,72)
  accent: '#fb8e00',
  highlighted: '#ffd195',
  highlightedUpdating: 'rgba(255,176,72, .50)',
};

const CombinedDefaultTheme = {
  ...adaptedNavigationLightTheme,
  ...PaperDefaultTheme,
  // myOwnProperty: true,
  fonts: {
    ...PaperDefaultTheme.fonts,
    labelLarge: {
      fontFamily: 'YourCustomFont',
      fontWeight: '500',
    },
  },
  colors: {
    ...adaptedNavigationLightTheme.colors,
    card: PaperDefaultTheme.colors.surface,
    ...PaperDefaultTheme.colors,
    ...pastelBlueTheme,
    ...orangeMono,
  },
};

const CombinedDarkTheme = {
  ...adaptedNavigationDarkTheme,
  ...PaperDarkTheme,
  fonts: {
    ...PaperDarkTheme.fonts,
    labelLarge: {
      fontFamily: 'YourCustomFont',
      fontWeight: '500',
    },
  },
  colors: {
    ...adaptedNavigationDarkTheme.colors,
    card: PaperDarkTheme.colors.surface,
    ...PaperDarkTheme.colors,
  },
};

// Create a query client
const queryClient = new QueryClient({
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

export default function Main() {
  const isDarkTheme = useColorScheme() === 'dark' ? true : false;
  // const theme = isDarkTheme ? CombinedDarkTheme : CombinedDefaultTheme;
  const theme = CombinedDefaultTheme;

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface,
        }}
        edges={{
          bottom: 'maximum',
          top: 'off',
        }}>
        <CloudAuthContextProvider>
          <QueryClientProvider client={queryClient}>
            <AuthContextProvider>
              <PaperProvider theme={theme}>
                <AppConfigContextProvider>
                  <NavigationContainer
                    theme={theme}
                    ref={navigationRef}
                    navigationInChildEnabled
                    screenOptions={{
                      headerShown: false,
                      animation: 'slide_from_right',
                      animationDuration: 200,
                    }}>
                    <GestureHandlerRootView>
                      <BottomSheetModalProvider>
                        <SearchbarContextProvider>
                          <DefaultPrinterContextProvider>
                            <SalesCounterContextProvider>
                              <AddedIngredientsContextProvider>
                                <ItemFormContextProvider>
                                  <ExpenseFormContextProvider>
                                    <RecipeFormContextProvider>
                                      <SellingMenuFormContextProvider>
                                        <AddedSellingMenuItemsContextProvider>
                                          <TabsProvider>
                                            <App />
                                          </TabsProvider>
                                        </AddedSellingMenuItemsContextProvider>
                                      </SellingMenuFormContextProvider>
                                    </RecipeFormContextProvider>
                                  </ExpenseFormContextProvider>
                                </ItemFormContextProvider>
                              </AddedIngredientsContextProvider>
                            </SalesCounterContextProvider>
                          </DefaultPrinterContextProvider>
                        </SearchbarContextProvider>
                      </BottomSheetModalProvider>
                    </GestureHandlerRootView>
                  </NavigationContainer>
                </AppConfigContextProvider>
              </PaperProvider>
            </AuthContextProvider>
          </QueryClientProvider>
        </CloudAuthContextProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

AppRegistry.registerComponent(appName, () => gestureHandlerRootHOC(Main));
