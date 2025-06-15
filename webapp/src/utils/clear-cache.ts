/**
 * 브라우저 캐시 및 상태 초기화 유틸리티
 */

export const clearAllCaches = async () => {
  console.log('[ClearCache] Starting cache cleanup...');
  
  // 1. Service Worker 캐시 삭제
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => {
        console.log(`[ClearCache] Deleting cache: ${cacheName}`);
        return caches.delete(cacheName);
      })
    );
  }
  
  // 2. LocalStorage 초기화
  const keysToPreserve = ['theme', 'language']; // 보존할 키들
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (!keysToPreserve.includes(key)) {
      console.log(`[ClearCache] Removing localStorage key: ${key}`);
      localStorage.removeItem(key);
    }
  });
  
  // 3. SessionStorage 초기화
  console.log('[ClearCache] Clearing sessionStorage');
  sessionStorage.clear();
  
  // 4. IndexedDB 초기화 (필요시)
  if ('indexedDB' in window) {
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map(db => {
        if (db.name) {
          console.log(`[ClearCache] Deleting IndexedDB: ${db.name}`);
          return indexedDB.deleteDatabase(db.name);
        }
        return Promise.resolve();
      })
    );
  }
  
  console.log('[ClearCache] Cache cleanup completed');
};

export const forceRefreshMonitoringData = () => {
  // 모니터링 데이터에 타임스탬프 추가하여 캐시 무효화
  const timestamp = Date.now();
  const baseUrl = 'http://localhost:3100/api/monitoring';
  
  return {
    status: `${baseUrl}/status?_t=${timestamp}`,
    summary: `${baseUrl}/summary?_t=${timestamp}`,
    metrics: `${baseUrl}/services/metrics?_t=${timestamp}`
  };
};

export const clearReactQueryCache = () => {
  // React Query 캐시가 있다면 초기화
  const queryClient = (window as any).__REACT_QUERY_CLIENT__;
  if (queryClient) {
    console.log('[ClearCache] Clearing React Query cache');
    queryClient.clear();
  }
};

export const hardRefresh = () => {
  // 캐시 무시하고 강제 새로고침
  window.location.reload();
};