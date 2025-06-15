/**
 * Advanced Caching Strategies
 * Phase 3 - 캐싱 최적화 전략
 */

import { BaseCache, MemoryCache, CacheOptions } from './index';
import { logger } from '../utils/logger';

// ============ Cache Warming ============

export class CacheWarmer<T = any> {
  private cache: BaseCache<T>;
  private warmupKeys: Map<string, () => Promise<T>> = new Map();
  private warmupInterval: NodeJS.Timeout | null = null;
  private isWarming = false;

  constructor(cache: BaseCache<T>) {
    this.cache = cache;
  }

  /**
   * Register keys for warming
   */
  register(key: string, fetcher: () => Promise<T>): void {
    this.warmupKeys.set(key, fetcher);
  }

  /**
   * Start cache warming
   */
  start(intervalMs: number = 60000): void {
    this.stop();
    
    const warm = async () => {
      if (this.isWarming) return;
      
      this.isWarming = true;
      try {
        await this.warmAll();
      } catch (error) {
        logger.error('Cache warming failed', error as Error);
      } finally {
        this.isWarming = false;
      }
    };

    // Initial warming
    warm();
    
    // Periodic warming
    this.warmupInterval = setInterval(warm, intervalMs);
  }

  /**
   * Stop cache warming
   */
  stop(): void {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
    }
  }

  /**
   * Warm all registered keys
   */
  async warmAll(): Promise<number> {
    let warmed = 0;
    
    // Use forEach instead of for...of for ES5 compatibility
    for (const [key, fetcher] of Array.from(this.warmupKeys.entries())) {
      try {
        const value = await fetcher();
        this.cache.set(key, value);
        warmed++;
      } catch (error) {
        logger.error(`Failed to warm cache key: ${key}`, error as Error);
      }
    }
    
    logger.debug(`Cache warmed ${warmed} keys`);
    return warmed;
  }
}

// ============ Tiered Cache ============

export class TieredCache<T = any> extends BaseCache<T> {
  private tiers: BaseCache<T>[];

  constructor(tiers: BaseCache<T>[]) {
    super();
    this.tiers = tiers;
  }

  get(key: string): T | null {
    for (let i = 0; i < this.tiers.length; i++) {
      const value = this.tiers[i].get(key);
      if (value !== null) {
        // Promote to higher tiers
        for (let j = 0; j < i; j++) {
          this.tiers[j].set(key, value);
        }
        return value;
      }
    }
    return null;
  }

  set(key: string, value: T, ttl?: number): void {
    // Set in all tiers
    this.tiers.forEach(tier => tier.set(key, value, ttl));
  }

  has(key: string): boolean {
    return this.tiers.some(tier => tier.has(key));
  }

  delete(key: string): boolean {
    let deleted = false;
    this.tiers.forEach(tier => {
      if (tier.delete(key)) {
        deleted = true;
      }
    });
    return deleted;
  }

  clear(): void {
    this.tiers.forEach(tier => tier.clear());
  }

  keys(): string[] {
    const allKeys = new Set<string>();
    this.tiers.forEach(tier => {
      tier.keys().forEach(key => allKeys.add(key));
    });
    return Array.from(allKeys);
  }

  values(): T[] {
    const valueMap = new Map<string, T>();
    this.tiers.forEach(tier => {
      tier.entries().forEach(([key, value]) => {
        if (!valueMap.has(key)) {
          valueMap.set(key, value);
        }
      });
    });
    return Array.from(valueMap.values());
  }

  entries(): Array<[string, T]> {
    const entryMap = new Map<string, T>();
    this.tiers.forEach(tier => {
      tier.entries().forEach(([key, value]) => {
        if (!entryMap.has(key)) {
          entryMap.set(key, value);
        }
      });
    });
    return Array.from(entryMap.entries());
  }
}

// ============ Write-Through Cache ============

export class WriteThroughCache<T = any> extends BaseCache<T> {
  private cache: BaseCache<T>;
  private writer: (key: string, value: T) => Promise<void>;

  constructor(
    cache: BaseCache<T>,
    writer: (key: string, value: T) => Promise<void>
  ) {
    super();
    this.cache = cache;
    this.writer = writer;
  }

  get(key: string): T | null {
    return this.cache.get(key);
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    // Write to backing store first
    await this.writer(key, value);
    // Then update cache
    this.cache.set(key, value, ttl);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  keys(): string[] {
    return this.cache.keys();
  }

  values(): T[] {
    return this.cache.values();
  }

  entries(): Array<[string, T]> {
    return this.cache.entries();
  }
}

// ============ Cache Compression ============

export class CompressedCache<T = any> extends BaseCache<T> {
  private cache: BaseCache<string>;
  private compress: (value: T) => string;
  private decompress: (compressed: string) => T;

  constructor(
    cache: BaseCache<string>,
    compress: (value: T) => string,
    decompress: (compressed: string) => T
  ) {
    super();
    this.cache = cache;
    this.compress = compress;
    this.decompress = decompress;
  }

  get(key: string): T | null {
    const compressed = this.cache.get(key);
    if (compressed === null) return null;
    
    try {
      return this.decompress(compressed);
    } catch (error) {
      logger.error('Failed to decompress cache value', error as Error);
      this.cache.delete(key);
      return null;
    }
  }

  set(key: string, value: T, ttl?: number): void {
    try {
      const compressed = this.compress(value);
      this.cache.set(key, compressed, ttl);
    } catch (error) {
      logger.error('Failed to compress cache value', error as Error);
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  keys(): string[] {
    return this.cache.keys();
  }

  values(): T[] {
    const compressedValues = this.cache.values();
    return compressedValues.map(compressed => {
      try {
        return this.decompress(compressed);
      } catch (error) {
        logger.error('Failed to decompress cache value', error as Error);
        return null;
      }
    }).filter((value): value is T => value !== null);
  }

  entries(): Array<[string, T]> {
    const compressedEntries = this.cache.entries();
    return compressedEntries.map(([key, compressed]) => {
      try {
        const value = this.decompress(compressed);
        return [key, value] as [string, T];
      } catch (error) {
        logger.error('Failed to decompress cache value', error as Error);
        return null;
      }
    }).filter((entry): entry is [string, T] => entry !== null);
  }
}

// ============ Smart Cache with ML-based TTL ============

interface AccessPattern {
  key: string;
  accessTimes: number[];
  hitCount: number;
  lastAccess: number;
}

export class SmartCache<T = any> extends MemoryCache<T> {
  private patterns: Map<string, AccessPattern> = new Map();
  protected baselineTTL: number;
  private adaptiveTTL = true;

  constructor(options: CacheOptions & { adaptiveTTL?: boolean } = {}) {
    super(options);
    this.baselineTTL = options.ttl || 5 * 60 * 1000;
    this.adaptiveTTL = options.adaptiveTTL !== false;
  }

  get(key: string): T | null {
    const value = super.get(key);
    
    if (value !== null && this.adaptiveTTL) {
      this.updateAccessPattern(key);
    }
    
    return value;
  }

  set(key: string, value: T, ttl?: number): void {
    const adaptedTTL = this.adaptiveTTL ? this.calculateOptimalTTL(key) : ttl;
    super.set(key, value, adaptedTTL || this.baselineTTL);
  }

  private updateAccessPattern(key: string): void {
    const now = Date.now();
    const pattern = this.patterns.get(key) || {
      key,
      accessTimes: [],
      hitCount: 0,
      lastAccess: now
    };

    pattern.accessTimes.push(now);
    pattern.hitCount++;
    pattern.lastAccess = now;

    // Keep only recent access times (last 100)
    if (pattern.accessTimes.length > 100) {
      pattern.accessTimes = pattern.accessTimes.slice(-100);
    }

    this.patterns.set(key, pattern);
  }

  protected calculateOptimalTTL(key: string): number {
    const pattern = this.patterns.get(key);
    if (!pattern || pattern.accessTimes.length < 2) {
      return this.baselineTTL;
    }

    // Calculate average time between accesses
    const intervals: number[] = [];
    for (let i = 1; i < pattern.accessTimes.length; i++) {
      intervals.push(pattern.accessTimes[i] - pattern.accessTimes[i - 1]);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length
    );

    // Calculate TTL based on access pattern
    // Frequently accessed items get longer TTL
    // Items with regular access patterns get TTL = avg + 2*stdDev
    const suggestedTTL = avgInterval + 2 * stdDev;
    
    // Bound the TTL
    const minTTL = 10 * 1000; // 10 seconds
    const maxTTL = 24 * 60 * 60 * 1000; // 24 hours
    
    return Math.min(maxTTL, Math.max(minTTL, suggestedTTL));
  }

  getAccessPatterns(): Map<string, AccessPattern> {
    return new Map(this.patterns);
  }
}

// ============ Cache Preloading ============

export interface PreloadConfig<T> {
  key: string;
  loader: () => Promise<T>;
  ttl?: number;
  priority?: number;
  dependencies?: string[];
}

export class CachePreloader<T = any> {
  private cache: BaseCache<T>;
  private configs: PreloadConfig<T>[] = [];
  private loading = new Set<string>();

  constructor(cache: BaseCache<T>) {
    this.cache = cache;
  }

  /**
   * Register preload configuration
   */
  register(config: PreloadConfig<T>): void {
    this.configs.push(config);
    this.configs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Preload all registered configurations
   */
  async preloadAll(): Promise<void> {
    const loaded = new Set<string>();
    
    for (const config of this.configs) {
      // Check dependencies
      if (config.dependencies) {
        const allDepsLoaded = config.dependencies.every(dep => loaded.has(dep));
        if (!allDepsLoaded) {
          continue;
        }
      }
      
      try {
        await this.preload(config);
        loaded.add(config.key);
      } catch (error) {
        logger.error(`Failed to preload ${config.key}`, error as Error);
      }
    }
  }

  /**
   * Preload single configuration
   */
  private async preload(config: PreloadConfig<T>): Promise<void> {
    if (this.loading.has(config.key)) {
      return;
    }

    this.loading.add(config.key);
    try {
      const value = await config.loader();
      this.cache.set(config.key, value, config.ttl);
    } finally {
      this.loading.delete(config.key);
    }
  }
}

// ============ Cache Monitoring ============

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  keyCount: number;
}

export class CacheMonitor {
  private metrics: Map<string, CacheMetrics> = new Map();
  private responseTimes: Map<string, number[]> = new Map();

  /**
   * Record cache access
   */
  recordAccess(cacheName: string, hit: boolean, responseTime: number): void {
    const times = this.responseTimes.get(cacheName) || [];
    times.push(responseTime);
    
    // Keep only recent times (last 1000)
    if (times.length > 1000) {
      times.shift();
    }
    
    this.responseTimes.set(cacheName, times);
  }

  /**
   * Get cache metrics
   */
  getMetrics(cacheName: string, cache: BaseCache): CacheMetrics {
    const stats = cache.getStats();
    const times = this.responseTimes.get(cacheName) || [];
    
    const avgResponseTime = times.length > 0
      ? times.reduce((sum, time) => sum + time, 0) / times.length
      : 0;

    return {
      hitRate: stats.hitRate,
      missRate: 1 - stats.hitRate,
      evictionRate: stats.evictions / (stats.hits + stats.misses) || 0,
      avgResponseTime,
      memoryUsage: this.estimateMemoryUsage(cache),
      keyCount: cache.keys().length
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(cache: BaseCache): number {
    // Simple estimation based on serialized size
    try {
      const entries = cache.entries();
      const serialized = JSON.stringify(entries);
      return serialized.length * 2; // Rough estimate (2 bytes per char)
    } catch {
      return 0;
    }
  }

  /**
   * Get all metrics
   */
  getAllMetrics(caches: Map<string, BaseCache>): Map<string, CacheMetrics> {
    const allMetrics = new Map<string, CacheMetrics>();
    
    caches.forEach((cache, name) => {
      allMetrics.set(name, this.getMetrics(name, cache));
    });
    
    return allMetrics;
  }
}