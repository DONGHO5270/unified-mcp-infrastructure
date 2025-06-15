/**
 * Robust Singleton Pattern for Library Initialization
 * Prevents multiple initialization in React 19 + HMR environment
 */

import React from 'react';

interface InitState {
  status: 'idle' | 'initializing' | 'initialized' | 'error';
  promise: Promise<void> | null;
  error: Error | null;
  initCount: number;
  lastInitTime: number;
}

// Global state persisted across HMR updates
declare global {
  interface Window {
    __MCP_LIB_INIT_STATE__: InitState;
  }
}

// Initialize or get existing state
function getInitState(): InitState {
  if (typeof window === 'undefined') {
    return {
      status: 'idle',
      promise: null,
      error: null,
      initCount: 0,
      lastInitTime: 0
    };
  }

  if (!window.__MCP_LIB_INIT_STATE__) {
    window.__MCP_LIB_INIT_STATE__ = {
      status: 'idle',
      promise: null,
      error: null,
      initCount: 0,
      lastInitTime: 0
    };
  }

  return window.__MCP_LIB_INIT_STATE__;
}

/**
 * Enhanced initialization with multiple safety checks
 */
export async function safeInitializeLibrary(
  config: any,
  doInit: (config: any) => Promise<void>
): Promise<void> {
  const state = getInitState();
  
  // Log attempt
  console.debug(`[SafeInit] Attempt #${state.initCount + 1}, Status: ${state.status}`);

  // Already initialized successfully
  if (state.status === 'initialized') {
    console.debug('[SafeInit] Already initialized, skipping');
    return Promise.resolve();
  }

  // Currently initializing - return existing promise
  if (state.status === 'initializing' && state.promise) {
    console.debug('[SafeInit] Already initializing, returning existing promise');
    return state.promise;
  }

  // Error state - retry after delay
  if (state.status === 'error') {
    const timeSinceError = Date.now() - state.lastInitTime;
    if (timeSinceError < 5000) { // 5 second cooldown
      console.warn('[SafeInit] Recent error, waiting for cooldown', state.error);
      return Promise.reject(state.error);
    }
  }

  // Start new initialization
  state.status = 'initializing';
  state.initCount++;
  state.lastInitTime = Date.now();

  state.promise = doInit(config)
    .then(() => {
      state.status = 'initialized';
      state.error = null;
      console.info(`[SafeInit] Successfully initialized on attempt #${state.initCount}`);
      
      // Track in debugger if available
      if ((window as any).reactInitDebugger) {
        (window as any).reactInitDebugger.trackLibraryInit('safeInitialize-success');
      }
    })
    .catch((error) => {
      state.status = 'error';
      state.error = error;
      state.promise = null;
      console.error('[SafeInit] Initialization failed:', error);
      throw error;
    });

  return state.promise;
}

/**
 * Reset initialization state (useful for testing or forced re-init)
 */
export function resetInitState(): void {
  const state = getInitState();
  state.status = 'idle';
  state.promise = null;
  state.error = null;
  console.info('[SafeInit] State reset');
}

/**
 * Get current initialization status
 */
export function getInitStatus(): {
  isInitialized: boolean;
  isInitializing: boolean;
  hasError: boolean;
  initCount: number;
} {
  const state = getInitState();
  return {
    isInitialized: state.status === 'initialized',
    isInitializing: state.status === 'initializing',
    hasError: state.status === 'error',
    initCount: state.initCount
  };
}

/**
 * HMR-aware initialization wrapper
 */
export function createHMRSafeInitializer<T extends (...args: any[]) => Promise<void>>(
  initFn: T,
  moduleId: string
): T {
  return (async (...args: any[]) => {
    // Check if this module has been hot-reloaded
    const hmrKey = `__HMR_INIT_${moduleId}__`;
    
    if (typeof window !== 'undefined') {
      const hmrState = (window as any)[hmrKey];
      
      if (hmrState?.initialized && Date.now() - hmrState.timestamp < 1000) {
        console.debug(`[HMR] Skipping re-init for ${moduleId} (recent HMR update)`);
        return;
      }
      
      (window as any)[hmrKey] = {
        initialized: true,
        timestamp: Date.now()
      };
    }
    
    return initFn(...args);
  }) as T;
}

/**
 * React 19 Concurrent Mode Safe Hook
 */
export function useSafeInitialization(
  initFn: () => Promise<void>,
  deps: React.DependencyList = []
): {
  isInitialized: boolean;
  isInitializing: boolean;
  error: Error | null;
} {
  const [state, setState] = React.useState(() => ({
    isInitialized: false,
    isInitializing: false,
    error: null as Error | null
  }));

  React.useEffect(() => {
    let cancelled = false;
    
    const doInit = async () => {
      if (cancelled) return;
      
      setState(prev => ({ ...prev, isInitializing: true }));
      
      try {
        await initFn();
        if (!cancelled) {
          setState({ isInitialized: true, isInitializing: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ isInitialized: false, isInitializing: false, error: error as Error });
        }
      }
    };

    doInit();

    return () => {
      cancelled = true;
    };
  }, deps);

  return state;
}

// Export utilities
export default {
  safeInitializeLibrary,
  resetInitState,
  getInitStatus,
  createHMRSafeInitializer,
  useSafeInitialization
};