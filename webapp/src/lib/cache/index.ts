/**
 * Data Caching & Synchronization Layer
 * 통합 MCP 인프라를 위한 데이터 캐싱 및 동기화
 */

import { logger } from '../utils/logger';

// ============ Cache Types ============

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh
  onEvict?: (key: string, value: any) => void; // Callback on eviction
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccess: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

// ============ Base Cache Class ============

export abstract class BaseCache<T = any> {
  protected options: Required<CacheOptions>;
  protected stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0
  };

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: 5 * 60 * 1000, // 5 minutes default
      maxSize: 1000,
      staleWhileRevalidate: true,
      onEvict: () => {},
      ...options
    };
  }

  abstract get(key: string): T | null;
  abstract set(key: string, value: T, ttl?: number): void;
  abstract has(key: string): boolean;
  abstract delete(key: string): boolean;
  abstract clear(): void;
  abstract keys(): string[];
  abstract values(): T[];
  abstract entries(): Array<[string, T]>;

  /**
   * 캐시 통계 조회
   */
  getStats(): CacheStats {
    this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    return { ...this.stats };
  }

  /**
   * 캐시 통계 초기화
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0
    };
  }

  /**
   * 캐시 엔트리 유효성 검사
   */
  protected isValid(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * LRU 업데이트
   */
  protected updateLRU(entry: CacheEntry<T>): void {
    entry.lastAccess = Date.now();
    entry.hits++;
  }
}

// ============ Memory Cache Implementation ============

export class MemoryCache<T = any> extends BaseCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (!this.isValid(entry)) {
      if (!this.options.staleWhileRevalidate) {
        this.delete(key);
        this.stats.misses++;
        return null;
      }
    }

    this.updateLRU(entry);
    this.stats.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    // 크기 제한 확인
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.options.ttl,
      hits: 0,
      lastAccess: Date.now()
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && this.isValid(entry);
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.options.onEvict(key, entry.value);
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return true;
    }
    return false;
  }

  clear(): void {
    this.cache.forEach((entry, key) => {
      this.options.onEvict(key, entry.value);
    });
    this.cache.clear();
    this.stats.size = 0;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  values(): T[] {
    return Array.from(this.cache.values())
      .filter(entry => this.isValid(entry))
      .map(entry => entry.value);
  }

  entries(): Array<[string, T]> {
    return Array.from(this.cache.entries())
      .filter(([_, entry]) => this.isValid(entry))
      .map(([key, entry]) => [key, entry.value]);
  }

  /**
   * LRU 기반 제거
   */
  protected evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    });

    if (lruKey) {
      this.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * 만료된 엔트리 정리
   */
  prune(): number {
    let pruned = 0;
    const now = Date.now();

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp >= entry.ttl) {
        this.delete(key);
        pruned++;
      }
    });

    return pruned;
  }
}

// ============ LocalStorage Cache Implementation ============

export class LocalStorageCache<T = any> extends BaseCache<T> {
  private prefix: string;

  constructor(prefix: string = 'mcp_cache_', options: CacheOptions = {}) {
    super(options);
    this.prefix = prefix;
    this.loadStats();
  }

  get(key: string): T | null {
    try {
      const data = localStorage.getItem(this.prefix + key);
      if (!data) {
        this.stats.misses++;
        this.saveStats();
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(data);
      
      if (!this.isValid(entry)) {
        if (!this.options.staleWhileRevalidate) {
          this.delete(key);
          this.stats.misses++;
          this.saveStats();
          return null;
        }
      }

      this.updateLRU(entry);
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
      this.stats.hits++;
      this.saveStats();
      
      return entry.value;
    } catch (error) {
      logger.error('LocalStorage cache get error', error as Error);
      return null;
    }
  }

  set(key: string, value: T, ttl?: number): void {
    try {
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: ttl || this.options.ttl,
        hits: 0,
        lastAccess: Date.now()
      };

      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
      this.updateSize();
      
      // 크기 제한 확인
      if (this.stats.size > this.options.maxSize) {
        this.evictLRU();
      }
    } catch (error) {
      logger.error('LocalStorage cache set error', error as Error);
    }
  }

  has(key: string): boolean {
    const data = localStorage.getItem(this.prefix + key);
    if (!data) return false;
    
    try {
      const entry: CacheEntry<T> = JSON.parse(data);
      return this.isValid(entry);
    } catch {
      return false;
    }
  }

  delete(key: string): boolean {
    const data = localStorage.getItem(this.prefix + key);
    if (!data) return false;

    try {
      const entry: CacheEntry<T> = JSON.parse(data);
      this.options.onEvict(key, entry.value);
      localStorage.removeItem(this.prefix + key);
      this.updateSize();
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    const keys = this.keys();
    keys.forEach(key => {
      this.delete(key);
    });
    this.updateSize();
  }

  keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }

  values(): T[] {
    return this.keys()
      .map(key => this.get(key))
      .filter((value): value is T => value !== null);
  }

  entries(): Array<[string, T]> {
    return this.keys()
      .map(key => [key, this.get(key)] as [string, T | null])
      .filter((entry): entry is [string, T] => entry[1] !== null);
  }

  protected evictLRU(): void {
    const entries = this.keys().map(key => {
      const data = localStorage.getItem(this.prefix + key);
      if (!data) return null;
      
      try {
        const entry: CacheEntry<T> = JSON.parse(data);
        return { key, entry };
      } catch {
        return null;
      }
    }).filter(item => item !== null) as Array<{ key: string; entry: CacheEntry<T> }>;

    entries.sort((a, b) => a.entry.lastAccess - b.entry.lastAccess);

    const toEvict = Math.max(1, Math.floor(entries.length * 0.1)); // 10% eviction
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      this.delete(entries[i].key);
      this.stats.evictions++;
    }

    this.saveStats();
  }

  private updateSize(): void {
    this.stats.size = this.keys().length;
    this.saveStats();
  }

  private loadStats(): void {
    try {
      const stats = localStorage.getItem(this.prefix + '__stats__');
      if (stats) {
        this.stats = JSON.parse(stats);
      }
    } catch {
      // Ignore errors
    }
  }

  private saveStats(): void {
    try {
      localStorage.setItem(this.prefix + '__stats__', JSON.stringify(this.stats));
    } catch {
      // Ignore errors
    }
  }
}

// ============ Cache Manager ============

export class CacheManager {
  private caches: Map<string, BaseCache> = new Map();

  /**
   * 캐시 인스턴스 생성 또는 조회
   */
  getCache<T = any>(name: string, options?: CacheOptions): BaseCache<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MemoryCache<T>(options));
    }
    return this.caches.get(name) as BaseCache<T>;
  }

  /**
   * LocalStorage 캐시 생성 또는 조회
   */
  getLocalStorageCache<T = any>(name: string, options?: CacheOptions): LocalStorageCache<T> {
    const key = `ls_${name}`;
    if (!this.caches.has(key)) {
      this.caches.set(key, new LocalStorageCache<T>(name + '_', options));
    }
    return this.caches.get(key) as LocalStorageCache<T>;
  }

  /**
   * 특정 캐시 제거
   */
  removeCache(name: string): boolean {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
      return this.caches.delete(name);
    }
    return false;
  }

  /**
   * 모든 캐시 제거
   */
  clearAll(): void {
    this.caches.forEach(cache => cache.clear());
    this.caches.clear();
  }

  /**
   * 전체 캐시 통계
   */
  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    this.caches.forEach((cache, name) => {
      stats[name] = cache.getStats();
    });
    return stats;
  }
}

// ============ Async Cache Wrapper ============

export class AsyncCache<T = any> {
  private cache: BaseCache<Promise<T>>;
  private pending: Map<string, Promise<T>> = new Map();

  constructor(cache: BaseCache<Promise<T>>) {
    this.cache = cache;
  }

  /**
   * 비동기 캐시 조회
   */
  async get(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttl?: number; force?: boolean }
  ): Promise<T> {
    // 강제 갱신
    if (options?.force) {
      return this.fetch(key, fetcher, options.ttl);
    }

    // 캐시 확인
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    // 이미 요청 중인 경우
    const pending = this.pending.get(key);
    if (pending) {
      return pending;
    }

    // 새로운 요청
    return this.fetch(key, fetcher, options?.ttl);
  }

  /**
   * 데이터 페칭 및 캐싱
   */
  private async fetch(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const promise = fetcher()
      .then(data => {
        this.cache.set(key, Promise.resolve(data), ttl);
        this.pending.delete(key);
        return data;
      })
      .catch(error => {
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * 캐시 무효화
   */
  invalidate(key: string): boolean {
    this.pending.delete(key);
    return this.cache.delete(key);
  }

  /**
   * 패턴 기반 무효화
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    const keys = this.cache.keys();
    
    keys.forEach(key => {
      if (pattern.test(key)) {
        this.invalidate(key);
        count++;
      }
    });
    
    return count;
  }
}

// ============ Data Synchronization ============

export interface SyncOptions {
  syncInterval?: number;
  conflictResolver?: (local: any, remote: any) => any;
  onSync?: (synced: number, conflicts: number) => void;
  onError?: (error: Error) => void;
}

export class DataSynchronizer<T = any> {
  private localCache: BaseCache<T>;
  private syncTimer: NodeJS.Timeout | null = null;
  private options: Required<SyncOptions>;
  private isSyncing = false;

  constructor(localCache: BaseCache<T>, options: SyncOptions = {}) {
    this.localCache = localCache;
    this.options = {
      syncInterval: 30000, // 30 seconds
      conflictResolver: (local, remote) => remote, // Default: remote wins
      onSync: () => {},
      onError: () => {},
      ...options
    };
  }

  /**
   * 동기화 시작
   */
  start(remoteFetcher: () => Promise<Record<string, T>>): void {
    this.stop();
    
    const sync = async () => {
      if (this.isSyncing) return;
      
      this.isSyncing = true;
      try {
        const remoteData = await remoteFetcher();
        const synced = await this.sync(remoteData);
        this.options.onSync(synced.synced, synced.conflicts);
      } catch (error) {
        logger.error('Data synchronization failed', error as Error);
        this.options.onError(error as Error);
      } finally {
        this.isSyncing = false;
      }
    };

    // 초기 동기화
    sync();
    
    // 주기적 동기화
    this.syncTimer = setInterval(sync, this.options.syncInterval);
  }

  /**
   * 동기화 중지
   */
  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * 수동 동기화
   */
  async sync(remoteData: Record<string, T>): Promise<{ synced: number; conflicts: number }> {
    let synced = 0;
    let conflicts = 0;

    // 원격 데이터 업데이트
    for (const [key, remoteValue] of Object.entries(remoteData)) {
      const localValue = this.localCache.get(key);
      
      if (!localValue) {
        // 새로운 데이터
        this.localCache.set(key, remoteValue);
        synced++;
      } else if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
        // 충돌 해결
        const resolved = this.options.conflictResolver(localValue, remoteValue);
        this.localCache.set(key, resolved);
        conflicts++;
      }
    }

    // 삭제된 데이터 처리
    const localKeys = this.localCache.keys();
    const remoteKeys = new Set(Object.keys(remoteData));
    
    localKeys.forEach(key => {
      if (!remoteKeys.has(key)) {
        this.localCache.delete(key);
        synced++;
      }
    });

    return { synced, conflicts };
  }

  /**
   * 동기화 상태 확인
   */
  isSynchronizing(): boolean {
    return this.isSyncing;
  }
}

// ============ Singleton Instances ============

export const cacheManager = new CacheManager();

// 기본 캐시 인스턴스
export const serviceCache = cacheManager.getCache('services', { ttl: 60000 }); // 1 minute
export const metricsCache = cacheManager.getCache('metrics', { ttl: 30000 }); // 30 seconds
export const configCache = cacheManager.getLocalStorageCache('config', { ttl: 86400000 }); // 24 hours

// 비동기 캐시 래퍼
export const asyncServiceCache = new AsyncCache(serviceCache);
export const asyncMetricsCache = new AsyncCache(metricsCache);