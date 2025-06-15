/**
 * 적응형 캐싱 전략
 * Phase 4 - 지능형 최적화
 */

import { SmartCache } from '../cache/strategies';
import { CacheOptions, BaseCache } from '../cache/index';
import { resourcePredictor, ResourcePrediction } from './resource-predictor';
import { logger } from '../utils/logger';

// 적응형 캐싱 설정
export interface AdaptiveCacheConfig extends CacheOptions {
  mlEnabled?: boolean;
  predictiveWarming?: boolean;
  dynamicTTL?: boolean;
  loadBasedEviction?: boolean;
  performanceOptimization?: boolean;
}

// 캐시 성능 메트릭
export interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  memoryEfficiency: number;
  predictionAccuracy: number;
  warmingEffectiveness: number;
}

// 예측 기반 캐시 키
export interface PredictiveKey {
  key: string;
  priority: number;
  predictedAccessTime: number;
  confidence: number;
  estimatedValue: any;
}

// AI 기반 적응형 캐시
export class AdaptiveIntelligentCache<T = any> extends SmartCache<T> {
  private config: Required<AdaptiveCacheConfig>;
  private performanceHistory: CachePerformanceMetrics[] = [];
  private predictionAccuracy: Map<string, number> = new Map();
  private warmingQueue: PredictiveKey[] = [];
  private loadBasedThresholds = {
    high: 80,   // CPU 80% 이상
    medium: 60, // CPU 60-80%
    low: 40     // CPU 40% 이하
  };

  constructor(config: AdaptiveCacheConfig = {}) {
    super(config);
    this.config = {
      mlEnabled: true,
      predictiveWarming: true,
      dynamicTTL: true,
      loadBasedEviction: true,
      performanceOptimization: true,
      ...config,
      ttl: config.ttl || 5 * 60 * 1000,
      maxSize: config.maxSize || 1000,
      staleWhileRevalidate: config.staleWhileRevalidate !== false,
      onEvict: config.onEvict || (() => {})
    };

    this.startPerformanceMonitoring();
    this.startPredictiveWarming();
  }

  /**
   * ML 강화된 TTL 계산
   */
  protected calculateOptimalTTL(key: string): number {
    if (!this.config.dynamicTTL) {
      return super.calculateOptimalTTL(key);
    }

    const accessPattern = this.getAccessPatterns().get(key);
    if (!accessPattern) {
      return this.baselineTTL;
    }

    // 기본 ML 계산
    const baseTTL = super.calculateOptimalTTL(key);

    // 시스템 부하 고려
    const loadAdjustment = this.calculateLoadBasedTTLAdjustment();

    // 예측 신뢰도 고려
    const predictionAdjustment = this.calculatePredictionBasedTTLAdjustment(key);

    // 성능 피드백 고려
    const performanceAdjustment = this.calculatePerformanceBasedTTLAdjustment(key);

    const finalTTL = baseTTL * loadAdjustment * predictionAdjustment * performanceAdjustment;

    // TTL 범위 제한
    const minTTL = 10 * 1000; // 10초
    const maxTTL = 24 * 60 * 60 * 1000; // 24시간
    
    return Math.min(maxTTL, Math.max(minTTL, finalTTL));
  }

  /**
   * 시스템 부하 기반 TTL 조정
   */
  private calculateLoadBasedTTLAdjustment(): number {
    // 실제 구현에서는 시스템 메트릭을 가져와야 함
    // 여기서는 모의 데이터 사용
    const currentLoad = this.getCurrentSystemLoad();

    if (currentLoad > this.loadBasedThresholds.high) {
      // 높은 부하: TTL 연장하여 캐시 의존도 증가
      return 1.5;
    } else if (currentLoad > this.loadBasedThresholds.medium) {
      // 중간 부하: 기본 TTL 유지
      return 1.0;
    } else {
      // 낮은 부하: TTL 단축하여 최신성 증가
      return 0.7;
    }
  }

  /**
   * 예측 기반 TTL 조정
   */
  private calculatePredictionBasedTTLAdjustment(key: string): number {
    const accuracy = this.predictionAccuracy.get(key) || 0.5;
    
    // 예측 정확도가 높을수록 더 긴 TTL
    return 0.5 + accuracy;
  }

  /**
   * 성능 기반 TTL 조정
   */
  private calculatePerformanceBasedTTLAdjustment(key: string): number {
    if (this.performanceHistory.length < 5) {
      return 1.0;
    }

    const recent = this.performanceHistory.slice(-5);
    const avgHitRate = recent.reduce((sum, metric) => sum + metric.hitRate, 0) / recent.length;

    // 히트율이 높으면 TTL 연장
    if (avgHitRate > 0.8) {
      return 1.2;
    } else if (avgHitRate < 0.5) {
      return 0.8;
    }

    return 1.0;
  }

  /**
   * 현재 시스템 부하 모의 (실제로는 시스템 메트릭에서 가져옴)
   */
  private getCurrentSystemLoad(): number {
    // 실제 구현에서는 resourcePredictor나 시스템 모니터링에서 가져옴
    return Math.random() * 100;
  }

  /**
   * 예측적 캐시 워밍 시작
   */
  private startPredictiveWarming(): void {
    if (!this.config.predictiveWarming) return;

    setInterval(() => {
      this.performPredictiveWarming();
    }, 5 * 60 * 1000); // 5분마다 실행
  }

  /**
   * 예측적 캐시 워밍 수행
   */
  private async performPredictiveWarming(): Promise<void> {
    try {
      const predictions = this.generateCacheWaringPredictions();
      await this.warmPredictedKeys(predictions);
      
      logger.info(`Predictive warming completed: ${predictions.length} keys processed`);
    } catch (error) {
      logger.error('Predictive warming failed', error as Error);
    }
  }

  /**
   * 캐시 워밍 예측 생성
   */
  private generateCacheWaringPredictions(): PredictiveKey[] {
    const predictions: PredictiveKey[] = [];
    const currentTime = Date.now();

    // 접근 패턴 분석
    const patterns = this.getAccessPatterns();
    
    for (const [key, pattern] of Array.from(patterns.entries())) {
      if (pattern.accessTimes.length < 3) continue;

      // 다음 접근 시간 예측
      const intervals = [];
      for (let i = 1; i < pattern.accessTimes.length; i++) {
        intervals.push(pattern.accessTimes[i] - pattern.accessTimes[i - 1]);
      }

      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const predictedAccessTime = pattern.lastAccess + avgInterval;

      // 예측 시간이 가까운 미래(다음 30분 이내)인 경우
      if (predictedAccessTime > currentTime && predictedAccessTime < currentTime + 30 * 60 * 1000) {
        const confidence = this.calculatePredictionConfidence(intervals);
        
        predictions.push({
          key,
          priority: pattern.hitCount,
          predictedAccessTime,
          confidence,
          estimatedValue: null // 실제 구현에서는 값 추정 로직 필요
        });
      }
    }

    // 우선순위 정렬 (신뢰도 * 우선순위)
    return predictions.sort((a, b) => (b.confidence * b.priority) - (a.confidence * a.priority));
  }

  /**
   * 예측 신뢰도 계산
   */
  private calculatePredictionConfidence(intervals: number[]): number {
    if (intervals.length < 2) return 0.1;

    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean; // 변동계수

    // 변동계수가 낮을수록 높은 신뢰도
    return Math.max(0.1, Math.min(0.9, 1 - cv));
  }

  /**
   * 예측된 키들을 미리 로드
   */
  private async warmPredictedKeys(predictions: PredictiveKey[]): Promise<void> {
    const maxWarmingKeys = 50; // 한 번에 최대 50개 키만 워밍
    const selectedKeys = predictions.slice(0, maxWarmingKeys);

    for (const prediction of selectedKeys) {
      if (!this.has(prediction.key)) {
        // 실제 구현에서는 데이터 소스에서 값을 가져와야 함
        // 여기서는 모의 구현
        await this.warmKey(prediction);
      }
    }
  }

  /**
   * 단일 키 워밍
   */
  private async warmKey(prediction: PredictiveKey): Promise<void> {
    try {
      // 실제 구현에서는 데이터 fetcher 호출
      // const value = await this.dataFetcher(prediction.key);
      // this.set(prediction.key, value);
      
      // 모의 구현
      const mockValue = `warmed_${prediction.key}_${Date.now()}`;
      this.set(prediction.key, mockValue as T);
      
      logger.debug(`Warmed cache key: ${prediction.key}`);
    } catch (error) {
      logger.error(`Failed to warm key: ${prediction.key}`, error as Error);
    }
  }

  /**
   * 부하 기반 캐시 제거
   */
  protected evictLRU(): void {
    if (!this.config.loadBasedEviction) {
      super.evictLRU();
      return;
    }

    const currentLoad = this.getCurrentSystemLoad();
    let evictionRatio = 0.1; // 기본 10% 제거

    if (currentLoad > this.loadBasedThresholds.high) {
      evictionRatio = 0.05; // 높은 부하시 적게 제거 (캐시 유지)
    } else if (currentLoad < this.loadBasedThresholds.low) {
      evictionRatio = 0.2; // 낮은 부하시 더 많이 제거 (메모리 절약)
    }

    const entries = this.entries();
    const toEvict = Math.max(1, Math.floor(entries.length * evictionRatio));

    // 접근 패턴 기반 지능형 제거
    const patterns = this.getAccessPatterns();
    const sortedEntries = entries.sort(([keyA], [keyB]) => {
      const patternA = patterns.get(keyA);
      const patternB = patterns.get(keyB);
      
      const scoreA = this.calculateEvictionScore(keyA, patternA);
      const scoreB = this.calculateEvictionScore(keyB, patternB);
      
      return scoreA - scoreB; // 낮은 점수부터 제거
    });

    for (let i = 0; i < toEvict && i < sortedEntries.length; i++) {
      this.delete(sortedEntries[i][0]);
    }
  }

  /**
   * 제거 점수 계산 (낮을수록 제거 대상)
   */
  private calculateEvictionScore(key: string, pattern?: any): number {
    if (!pattern) return 0;

    const recency = Date.now() - pattern.lastAccess;
    const frequency = pattern.hitCount;
    const predictedNextAccess = this.predictNextAccess(key, pattern);

    // 최근성, 빈도, 예측된 다음 접근을 종합적으로 고려
    const recencyScore = 1 / (recency + 1);
    const frequencyScore = Math.log(frequency + 1);
    const predictionScore = predictedNextAccess > 0 ? 1 / predictedNextAccess : 0;

    return recencyScore + frequencyScore + predictionScore;
  }

  /**
   * 다음 접근 시간 예측
   */
  private predictNextAccess(key: string, pattern: any): number {
    if (pattern.accessTimes.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < pattern.accessTimes.length; i++) {
      intervals.push(pattern.accessTimes[i] - pattern.accessTimes[i - 1]);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    return avgInterval;
  }

  /**
   * 성능 모니터링 시작
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 60 * 1000); // 1분마다 성능 메트릭 수집
  }

  /**
   * 성능 메트릭 수집
   */
  private collectPerformanceMetrics(): void {
    const stats = this.getStats();
    
    const metrics: CachePerformanceMetrics = {
      hitRate: stats.hitRate,
      missRate: 1 - stats.hitRate,
      avgResponseTime: this.calculateAvgResponseTime(),
      memoryEfficiency: this.calculateMemoryEfficiency(),
      predictionAccuracy: this.calculateOverallPredictionAccuracy(),
      warmingEffectiveness: this.calculateWarmingEffectiveness()
    };

    this.performanceHistory.push(metrics);

    // 최대 100개 메트릭만 유지
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }

    // 성능 기반 자동 최적화
    this.autoOptimizePerformance(metrics);
  }

  /**
   * 평균 응답 시간 계산
   */
  private calculateAvgResponseTime(): number {
    // 실제 구현에서는 실제 응답 시간 측정
    return Math.random() * 100; // 모의 구현
  }

  /**
   * 메모리 효율성 계산
   */
  private calculateMemoryEfficiency(): number {
    const totalKeys = this.keys().length;
    const maxKeys = this.options.maxSize;
    
    return totalKeys / maxKeys;
  }

  /**
   * 전체 예측 정확도 계산
   */
  private calculateOverallPredictionAccuracy(): number {
    const accuracies = Array.from(this.predictionAccuracy.values());
    if (accuracies.length === 0) return 0.5;
    
    return accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
  }

  /**
   * 워밍 효과성 계산
   */
  private calculateWarmingEffectiveness(): number {
    // 워밍된 키의 히트율을 측정하여 효과성 계산
    // 실제 구현에서는 워밍 전후 비교 분석
    return Math.random(); // 모의 구현
  }

  /**
   * 성능 기반 자동 최적화
   */
  private autoOptimizePerformance(metrics: CachePerformanceMetrics): void {
    if (!this.config.performanceOptimization) return;

    // 히트율이 낮으면 TTL 단축
    if (metrics.hitRate < 0.6) {
      this.baselineTTL = Math.max(this.baselineTTL * 0.8, 30 * 1000);
      logger.info('Auto-optimization: Reduced TTL due to low hit rate');
    }

    // 메모리 효율성이 낮으면 캐시 크기 증가 고려
    if (metrics.memoryEfficiency < 0.7 && metrics.hitRate > 0.8) {
      // 실제 구현에서는 동적 캐시 크기 조정
      logger.info('Auto-optimization: Consider increasing cache size');
    }

    // 예측 정확도가 낮으면 ML 모델 재조정
    if (metrics.predictionAccuracy < 0.6) {
      this.recalibrateMLModel();
    }
  }

  /**
   * ML 모델 재조정
   */
  private recalibrateMLModel(): void {
    // 예측 정확도 리셋
    this.predictionAccuracy.clear();
    
    // 새로운 학습 데이터로 모델 재훈련
    logger.info('Auto-optimization: Recalibrating ML model');
  }

  /**
   * 캐시 성능 보고서 생성
   */
  generatePerformanceReport(): {
    summary: CachePerformanceMetrics;
    trends: {
      hitRate: number[];
      responseTime: number[];
      memoryUsage: number[];
    };
    recommendations: string[];
  } {
    const recent = this.performanceHistory.slice(-10);
    
    const summary: CachePerformanceMetrics = {
      hitRate: recent.reduce((sum, m) => sum + m.hitRate, 0) / recent.length,
      missRate: recent.reduce((sum, m) => sum + m.missRate, 0) / recent.length,
      avgResponseTime: recent.reduce((sum, m) => sum + m.avgResponseTime, 0) / recent.length,
      memoryEfficiency: recent.reduce((sum, m) => sum + m.memoryEfficiency, 0) / recent.length,
      predictionAccuracy: recent.reduce((sum, m) => sum + m.predictionAccuracy, 0) / recent.length,
      warmingEffectiveness: recent.reduce((sum, m) => sum + m.warmingEffectiveness, 0) / recent.length
    };

    const trends = {
      hitRate: this.performanceHistory.map(m => m.hitRate),
      responseTime: this.performanceHistory.map(m => m.avgResponseTime),
      memoryUsage: this.performanceHistory.map(m => m.memoryEfficiency)
    };

    const recommendations = this.generateRecommendations(summary);

    return { summary, trends, recommendations };
  }

  /**
   * 성능 개선 권장사항 생성
   */
  private generateRecommendations(metrics: CachePerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.hitRate < 0.7) {
      recommendations.push('캐시 히트율이 낮습니다. TTL 설정을 검토하거나 캐시 크기를 늘려보세요.');
    }

    if (metrics.avgResponseTime > 100) {
      recommendations.push('평균 응답 시간이 높습니다. 캐시 알고리즘 최적화를 고려하세요.');
    }

    if (metrics.memoryEfficiency > 0.9) {
      recommendations.push('메모리 사용률이 높습니다. 제거 정책을 조정하거나 캐시 크기를 늘려보세요.');
    }

    if (metrics.predictionAccuracy < 0.6) {
      recommendations.push('예측 정확도가 낮습니다. 더 많은 학습 데이터가 필요합니다.');
    }

    if (metrics.warmingEffectiveness < 0.4) {
      recommendations.push('예측적 워밍 효과가 낮습니다. 워밍 전략을 재검토하세요.');
    }

    return recommendations;
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<AdaptiveCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Adaptive cache configuration updated', newConfig);
  }

  /**
   * 캐시 최적화 상태 조회
   */
  getOptimizationStatus(): {
    isMLEnabled: boolean;
    isPredictiveWarmingActive: boolean;
    isDynamicTTLActive: boolean;
    isLoadBasedEvictionActive: boolean;
    currentPerformance: CachePerformanceMetrics | null;
  } {
    const latest = this.performanceHistory.length > 0 
      ? this.performanceHistory[this.performanceHistory.length - 1] 
      : null;

    return {
      isMLEnabled: this.config.mlEnabled,
      isPredictiveWarmingActive: this.config.predictiveWarming,
      isDynamicTTLActive: this.config.dynamicTTL,
      isLoadBasedEvictionActive: this.config.loadBasedEviction,
      currentPerformance: latest
    };
  }
}

// 전역 적응형 캐시 인스턴스
export const adaptiveCache = new AdaptiveIntelligentCache({
  ttl: 5 * 60 * 1000,     // 5분 기본 TTL
  maxSize: 2000,          // 확장된 캐시 크기
  mlEnabled: true,
  predictiveWarming: true,
  dynamicTTL: true,
  loadBasedEviction: true,
  performanceOptimization: true
});