import React from 'react';
import {InteractionManager} from 'react-native';
import {useNavigation} from '@react-navigation/native';

/**
 * Performance monitoring utility to help identify and fix performance issues
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.isEnabled = __DEV__;
  }

  /**
   * Start timing a performance metric
   * @param {string} name - Name of the metric
   */
  startTiming(name) {
    if (!this.isEnabled) {
      return;
    }

    this.metrics.set(name, {
      startTime: Date.now(),
      endTime: null,
      duration: null,
    });
  }

  /**
   * End timing a performance metric
   * @param {string} name - Name of the metric
   */
  endTiming(name) {
    if (!this.isEnabled) {
      return;
    }

    const metric = this.metrics.get(name);
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;

      if (metric.duration > 16) {
        // 60fps threshold
        console.warn(
          `Performance issue detected: ${name} took ${metric.duration.toFixed(
            2,
          )}ms`,
        );
      }
    }
  }

  /**
   * Measure the duration of an async operation
   * @param {string} name - Name of the metric
   * @param {Function} operation - The operation to measure
   * @returns {Promise} - The result of the operation
   */
  async measureAsync(name, operation) {
    this.startTiming(name);
    try {
      const result = await operation();
      return result;
    } finally {
      this.endTiming(name);
    }
  }

  /**
   * Measure the duration of a sync operation
   * @param {string} name - Name of the metric
   * @param {Function} operation - The operation to measure
   * @returns {*} - The result of the operation
   */
  measureSync(name, operation) {
    this.startTiming(name);
    try {
      const result = operation();
      return result;
    } finally {
      this.endTiming(name);
    }
  }

  /**
   * Defer heavy operations until after interactions are complete
   * @param {Function} operation - The operation to defer
   */
  deferOperation(operation) {
    InteractionManager.runAfterInteractions(() => {
      operation();
    });
  }

  /**
   * Get all performance metrics
   * @returns {Map} - Map of performance metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Clear all performance metrics
   */
  clearMetrics() {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Hook to monitor component render performance
 */
export const usePerformanceMonitor = componentName => {
  React.useEffect(() => {
    if (__DEV__) {
      performanceMonitor.startTiming(`${componentName}-render`);

      return () => {
        performanceMonitor.endTiming(`${componentName}-render`);
      };
    }
  }, [componentName]);
};

/**
 * Hook to monitor screen navigation performance
 */
export const useNavigationPerformance = screenName => {
  const navigation = useNavigation();

  React.useEffect(() => {
    if (__DEV__) {
      performanceMonitor.startTiming(`${screenName}-navigation`);

      return () => {
        performanceMonitor.endTiming(`${screenName}-navigation`);
      };
    }
  }, [screenName]);

  return navigation;
};
