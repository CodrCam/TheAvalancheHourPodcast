// hooks/usePerformanceMonitor.js
import { useEffect, useRef, useCallback } from 'react';

export function usePerformanceMonitor(operationName) {
  const startTimeRef = useRef(null);
  const timingsRef = useRef([]);

  const startTimer = useCallback(() => {
    startTimeRef.current = performance.now();
    console.log(`🚀 Starting: ${operationName}`);
  }, [operationName]);

  const endTimer = useCallback(() => {
    if (startTimeRef.current) {
      const duration = performance.now() - startTimeRef.current;
      console.log(`⏱️ ${operationName}: ${duration.toFixed(2)}ms`);
      
      // Store timing for analysis
      timingsRef.current.push({
        operation: operationName,
        duration,
        timestamp: new Date().toISOString()
      });

      // Optional: Send to analytics service
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'timing_complete', {
          event_category: 'Performance',
          event_label: operationName,
          value: Math.round(duration),
          custom_map: { metric1: 'load_time' }
        });
      }

      // Optional: Send to other analytics (like Plausible, Mixpanel, etc.)
      if (typeof window !== 'undefined' && window.plausible) {
        window.plausible('Performance Timing', {
          props: {
            operation: operationName,
            duration: Math.round(duration)
          }
        });
      }
      
      startTimeRef.current = null;
      return duration;
    }
    return null;
  }, [operationName]);

  const getTimings = useCallback(() => {
    return [...timingsRef.current];
  }, []);

  const clearTimings = useCallback(() => {
    timingsRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      startTimeRef.current = null;
    };
  }, []);

  return { 
    startTimer, 
    endTimer, 
    getTimings, 
    clearTimings 
  };
}

// Additional hook for measuring component render times
export function useRenderPerformance(componentName) {
  const renderStartRef = useRef(null);

  useEffect(() => {
    renderStartRef.current = performance.now();
  });

  useEffect(() => {
    if (renderStartRef.current) {
      const renderTime = performance.now() - renderStartRef.current;
      console.log(`🎨 ${componentName} render: ${renderTime.toFixed(2)}ms`);
    }
  });
}

// Hook for measuring API call performance
export function useApiPerformance() {
  const measureApiCall = useCallback(async (apiName, apiCall) => {
    const startTime = performance.now();
    console.log(`🌐 API Call Started: ${apiName}`);
    
    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      console.log(`✅ API Call Success: ${apiName} (${duration.toFixed(2)}ms)`);
      
      // Send to analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'api_call_success', {
          event_category: 'API Performance',
          event_label: apiName,
          value: Math.round(duration)
        });
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`❌ API Call Failed: ${apiName} (${duration.toFixed(2)}ms)`, error);
      
      // Send error to analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'api_call_error', {
          event_category: 'API Performance',
          event_label: apiName,
          value: Math.round(duration)
        });
      }
      
      throw error;
    }
  }, []);

  return { measureApiCall };
}