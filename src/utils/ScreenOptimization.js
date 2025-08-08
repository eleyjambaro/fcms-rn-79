import React from 'react';
import {View} from 'react-native';

/**
 * Higher-order component to optimize screen performance and reduce flickering
 * @param {React.Component} WrappedComponent - The component to optimize
 * @param {Object} options - Optimization options
 * @returns {React.Component} - Optimized component
 */
export const withScreenOptimization = (WrappedComponent, options = {}) => {
  const {
    shouldMemoize = true,
    shouldUseCallback = true,
    shouldUseMemo = true,
  } = options;

  const OptimizedComponent = React.memo(
    React.forwardRef((props, ref) => {
      return <WrappedComponent {...props} ref={ref} />;
    }),
    (prevProps, nextProps) => {
      // Custom comparison function to prevent unnecessary re-renders
      // Only re-render if essential props have changed
      const essentialProps = ['navigation', 'route', 'focused'];
      return essentialProps.every(prop => prevProps[prop] === nextProps[prop]);
    },
  );

  OptimizedComponent.displayName = `withScreenOptimization(${
    WrappedComponent.displayName || WrappedComponent.name
  })`;

  return OptimizedComponent;
};

/**
 * Screen wrapper component that provides consistent styling and performance optimizations
 */
export const ScreenWrapper = React.memo(({children, style, ...props}) => {
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: 'transparent',
        },
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
});

/**
 * Hook to optimize screen focus handling
 */
export const useScreenFocus = (onFocus, onBlur) => {
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (isFocused && onFocus) {
      onFocus();
    } else if (!isFocused && onBlur) {
      onBlur();
    }
  }, [isFocused, onFocus, onBlur]);

  return {
    isFocused,
    setIsFocused,
  };
};

/**
 * Hook to debounce screen updates to prevent excessive re-renders
 */
export const useDebouncedScreenUpdate = (callback, delay = 300) => {
  const timeoutRef = React.useRef(null);

  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [callback, delay]);
};

/**
 * Screen transition configuration for smooth navigation
 */
export const screenTransitionConfig = {
  animation: 'slide_from_right',
  animationDuration: 200,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  cardStyleInterpolator: ({current, layouts}) => {
    return {
      cardStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [layouts.screen.width, 0],
            }),
          },
        ],
      },
    };
  },
};
