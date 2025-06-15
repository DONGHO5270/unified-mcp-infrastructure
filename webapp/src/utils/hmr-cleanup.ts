/**
 * HMR (Hot Module Replacement) Cleanup Utilities
 * Prevents memory leaks and duplicate initializations
 */

// Track cleanup functions
const cleanupRegistry = new Map<string, () => void>();

/**
 * Register a cleanup function for HMR
 */
export function registerCleanup(id: string, cleanup: () => void): void {
  // Run existing cleanup if exists
  const existing = cleanupRegistry.get(id);
  if (existing) {
    existing();
  }
  
  cleanupRegistry.set(id, cleanup);
}

/**
 * Run all cleanup functions
 */
export function runAllCleanups(): void {
  cleanupRegistry.forEach((cleanup, id) => {
    try {
      cleanup();
      console.debug(`[HMR] Cleanup completed for: ${id}`);
    } catch (error) {
      console.error(`[HMR] Cleanup failed for ${id}:`, error);
    }
  });
  cleanupRegistry.clear();
}

/**
 * HMR-safe singleton pattern
 */
export function createHMRSingleton<T>(
  id: string,
  factory: () => T,
  cleanup?: (instance: T) => void
): T {
  const globalKey = `__hmr_singleton_${id}`;
  
  if ((window as any)[globalKey]) {
    return (window as any)[globalKey];
  }
  
  const instance = factory();
  (window as any)[globalKey] = instance;
  
  if (cleanup) {
    registerCleanup(id, () => {
      cleanup(instance);
      delete (window as any)[globalKey];
    });
  }
  
  return instance;
}

// Setup HMR handling
if ((module as any).hot) {
  (module as any).hot.dispose(() => {
    runAllCleanups();
  });
}

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).__hmrCleanup = {
    register: registerCleanup,
    runAll: runAllCleanups
  };
}