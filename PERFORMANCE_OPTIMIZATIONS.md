# Performance Optimizations for FCMS React Native App

This document outlines the performance optimizations implemented to fix the flickering issue when navigating between screens.

## Issues Identified

1. **Excessive Query Refetching**: The query client was configured with `networkMode: 'always'` causing unnecessary network requests
2. **Unnecessary Re-renders**: Screen components were not memoized, causing excessive re-renders
3. **Poor Navigation Performance**: Missing screen transition optimizations
4. **Heavy Context Providers**: Multiple nested context providers causing performance overhead

## Optimizations Implemented

### 1. Query Client Optimization (`index.js`)

- Changed `networkMode` from `'always'` to `'online'`
- Added `staleTime` of 5 minutes to reduce unnecessary refetches
- Added `cacheTime` of 10 minutes for better caching
- Disabled `refetchOnWindowFocus` and `refetchOnReconnect`
- Reduced retry attempts to 1

### 2. Navigation Container Optimization (`index.js`)

- Added screen transition configuration
- Set animation duration to 200ms for smoother transitions
- Added `slide_from_right` animation for consistent navigation

### 3. Screen Component Memoization (`src/stacks/RootStack.js`)

- Wrapped all screen components with `React.memo()`
- Created memoized versions of all screen components
- Updated all Stack.Screen components to use memoized versions

### 4. Tab Navigation Optimization (`src/tabs/MainTab.js`)

- Added `lazy: true` for tab lazy loading
- Set `unmountOnBlur: false` to keep tabs mounted
- Memoized all tab screen components
- Optimized tab rendering logic

### 5. Performance Monitoring (`src/utils/PerformanceMonitor.js`)

- Created performance monitoring utility
- Added hooks for monitoring component render performance
- Added navigation performance monitoring
- Implemented deferred operation handling

### 6. Screen Optimization Utilities (`src/utils/ScreenOptimization.js`)

- Created `withScreenOptimization` HOC
- Added `ScreenWrapper` component
- Implemented `useScreenFocus` hook
- Added `useDebouncedScreenUpdate` hook
- Created optimized screen transition configuration

## Usage

### Using Performance Monitor

```javascript
import {
  usePerformanceMonitor,
  performanceMonitor,
} from '../utils/PerformanceMonitor';

const MyScreen = () => {
  usePerformanceMonitor('MyScreen');

  // Monitor async operations
  const handleAsyncOperation = async () => {
    await performanceMonitor.measureAsync('async-operation', async () => {
      // Your async operation
    });
  };

  // Defer heavy operations
  const handleHeavyOperation = () => {
    performanceMonitor.deferOperation(() => {
      // Heavy operation
    });
  };
};
```

### Using Screen Optimization

```javascript
import {
  withScreenOptimization,
  ScreenWrapper,
} from '../utils/ScreenOptimization';

const MyScreen = ({navigation, route}) => {
  return <ScreenWrapper>{/* Your screen content */}</ScreenWrapper>;
};

export default withScreenOptimization(MyScreen);
```

## Expected Results

After implementing these optimizations, you should see:

1. **Reduced Flickering**: Smoother transitions between screens
2. **Better Performance**: Faster screen loading and navigation
3. **Reduced Network Requests**: Fewer unnecessary API calls
4. **Improved User Experience**: More responsive app interactions

## Monitoring

In development mode, the performance monitor will log warnings for operations that take longer than 16ms (60fps threshold). Check the console for performance warnings.

## Additional Recommendations

1. **Image Optimization**: Consider using `react-native-fast-image` for better image loading
2. **List Optimization**: Use `FlashList` instead of `FlatList` for large lists
3. **Bundle Optimization**: Consider code splitting for large components
4. **Memory Management**: Implement proper cleanup in useEffect hooks

## Testing

To test the optimizations:

1. Navigate between different screens rapidly
2. Check for smooth transitions
3. Monitor network requests in developer tools
4. Test on lower-end devices
5. Check performance metrics in development console
