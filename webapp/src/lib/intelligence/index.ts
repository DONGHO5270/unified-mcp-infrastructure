/**
 * 지능형 최적화 시스템 통합 인덱스
 * Phase 4 - 지능형 최적화
 */

import { autoScaler } from './auto-scaler';
import { resourcePredictor } from './resource-predictor';
import { adaptiveCache } from './adaptive-cache';
import { predictiveMonitor } from './predictive-monitor';

export { 
  AIResourcePredictor, 
  resourcePredictor,
  type ResourceMetric,
  type ResourcePrediction,
  type AnomalyDetection,
  TimeSeriesAnalyzer
} from './resource-predictor';

export {
  AdaptiveIntelligentCache,
  adaptiveCache,
  type AdaptiveCacheConfig,
  type CachePerformanceMetrics,
  type PredictiveKey
} from './adaptive-cache';

export {
  AIAutoScaler,
  autoScaler,
  type ScalingPolicy,
  type ScaleAction,
  type ScalingConstraints,
  type ServiceMetrics,
  type ScalingEvent,
  type AutoScalerConfig
} from './auto-scaler';

export {
  AIPredictiveMonitor,
  predictiveMonitor,
  type FailurePrediction,
  type RecommendedAction,
  type PredictiveAlert,
  type HealthScore,
  type SystemInsight,
  type PredictiveMonitorConfig
} from './predictive-monitor';

// 통합 지능형 최적화 오케스트레이터
export class IntelligentOptimizationOrchestrator {
  private initialized = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  /**
   * 시스템 초기화
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('Intelligence system already initialized');
      return;
    }

    try {
      console.log('🧠 Initializing Intelligent Optimization System...');

      // 1. 기본 서비스 제약사항 설정
      this.setupDefaultConstraints();

      // 2. 예측 모델 워밍업
      await this.warmupPredictionModels();

      // 3. 캐시 시스템 초기화
      this.initializeCacheSystem();

      // 4. 통합 모니터링 시작
      this.startIntegratedMonitoring();

      this.initialized = true;
      console.log('✅ Intelligent Optimization System initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize intelligence system:', error);
      throw error;
    }
  }

  /**
   * 기본 제약사항 설정
   */
  private setupDefaultConstraints(): void {
    const defaultConstraints = {
      minReplicas: 1,
      maxReplicas: 10,
      maxScaleUpStep: 3,
      maxScaleDownStep: 2,
      cooldownPeriod: 5 * 60 * 1000, // 5분
      performanceTargets: {
        maxCpuUtilization: 70,
        maxMemoryUtilization: 80,
        maxLatency: 1000,
        minThroughput: 10
      }
    };

    // 기본 MCP 서비스들에 대한 제약사항 설정
    const services = [
      'github-mcp', 'npm-sentinel', 'vercel-mcp', 'docker-mcp',
      'taskmaster-ai', 'mem0-mcp', 'clear-thought', 'code-runner'
    ];

    services.forEach(service => {
      autoScaler.setConstraints(service, defaultConstraints);
    });

    console.log('📋 Default scaling constraints configured for', services.length, 'services');
  }

  /**
   * 예측 모델 워밍업
   */
  private async warmupPredictionModels(): Promise<void> {
    // 모의 데이터로 예측 모델 초기화
    const services = ['github-mcp', 'npm-sentinel', 'vercel-mcp'];
    
    for (const service of services) {
      // 과거 24시간 모의 데이터 생성
      for (let i = 0; i < 144; i++) { // 10분 간격으로 144개 데이터
        const timestamp = Date.now() - (144 - i) * 10 * 60 * 1000;
        const baseLoad = 50 + Math.sin(i / 24) * 20; // 일일 주기 패턴
        
        const mockMetric = {
          timestamp,
          cpu: Math.max(0, Math.min(100, baseLoad + (Math.random() - 0.5) * 20)),
          memory: Math.max(0, Math.min(100, baseLoad * 0.8 + (Math.random() - 0.5) * 15)),
          requests: Math.max(0, Math.floor(baseLoad * 2 + (Math.random() - 0.5) * 50)),
          latency: Math.max(50, baseLoad * 10 + (Math.random() - 0.5) * 200),
          errors: Math.max(0, Math.floor((Math.random() - 0.8) * 10))
        };

        resourcePredictor.addHistoricalData(service, mockMetric);
      }
    }

    console.log('🔮 Prediction models warmed up with historical data');
  }

  /**
   * 캐시 시스템 초기화
   */
  private initializeCacheSystem(): void {
    // 적응형 캐시 설정 최적화
    adaptiveCache.updateConfig({
      mlEnabled: true,
      predictiveWarming: true,
      dynamicTTL: true,
      loadBasedEviction: true,
      performanceOptimization: true
    });

    console.log('🗄️ Adaptive cache system configured');
  }

  /**
   * 통합 모니터링 시작
   */
  private startIntegratedMonitoring(): void {
    // 30초마다 시스템 상태 통합 분석
    this.monitoringInterval = setInterval(() => {
      this.performIntegratedAnalysis();
    }, 30 * 1000);

    console.log('📊 Integrated monitoring started (30s interval)');
  }

  /**
   * 통합 분석 수행
   */
  private async performIntegratedAnalysis(): Promise<void> {
    try {
      // 1. 현재 시스템 메트릭 수집
      const currentMetrics = this.collectCurrentMetrics();

      // 2. AI 예측 실행
      const predictions = resourcePredictor.predictAllServices(60);

      // 3. 캐시 성능 분석
      const cacheReport = adaptiveCache.generatePerformanceReport();

      // 4. 스케일링 성능 분석
      const scalingAnalysis = autoScaler.analyzeScalingPerformance();

      // 5. 예측적 모니터링 대시보드 데이터
      const monitoringData = predictiveMonitor.getDashboardData();

      // 6. 통합 인사이트 생성
      const insights = this.generateIntegratedInsights({
        predictions,
        cacheReport,
        scalingAnalysis,
        monitoringData
      });

      // 로그 출력 (실제로는 대시보드로 전송)
      if (insights.length > 0) {
        console.log('🔍 New insights generated:', insights.length);
      }

    } catch (error) {
      console.error('❌ Integrated analysis failed:', error);
    }
  }

  /**
   * 현재 메트릭 수집 (모의)
   */
  private collectCurrentMetrics(): Map<string, any> {
    const metrics = new Map();
    
    // 실제 구현에서는 실제 시스템 메트릭 수집
    const services = ['github-mcp', 'npm-sentinel', 'vercel-mcp'];
    
    services.forEach(service => {
      const mockMetric = {
        service,
        timestamp: Date.now(),
        replicas: 2,
        cpu: 40 + Math.random() * 30,
        memory: 35 + Math.random() * 25,
        requests: Math.floor(80 + Math.random() * 40),
        latency: 200 + Math.random() * 300,
        errors: Math.floor(Math.random() * 3),
        cost: 45 + Math.random() * 10
      };

      metrics.set(service, mockMetric);
      
      // 예측기와 스케일러에 메트릭 추가
      resourcePredictor.addHistoricalData(service, mockMetric);
      autoScaler.addMetrics(service, mockMetric);
    });

    return metrics;
  }

  /**
   * 통합 인사이트 생성
   */
  private generateIntegratedInsights(data: any): any[] {
    const insights = [];

    // 캐시 성능 기반 인사이트
    if (data.cacheReport.summary.hitRate < 0.7) {
      insights.push({
        type: 'cache_optimization',
        message: `Cache hit rate is ${(data.cacheReport.summary.hitRate * 100).toFixed(1)}%. Consider cache warming or TTL optimization.`,
        priority: 'medium',
        automated: true
      });
    }

    // 스케일링 기반 인사이트
    if (data.scalingAnalysis.successRate < 0.9) {
      insights.push({
        type: 'scaling_reliability',
        message: `Scaling success rate is ${(data.scalingAnalysis.successRate * 100).toFixed(1)}%. Review scaling constraints.`,
        priority: 'high',
        automated: false
      });
    }

    // 예측 정확도 기반 인사이트
    const avgConfidence = Array.from(data.predictions.values())
      .reduce((sum: number, p: any) => sum + p.confidence, 0) / data.predictions.size;
    
    if (avgConfidence < 0.7) {
      insights.push({
        type: 'prediction_accuracy',
        message: `Prediction confidence is ${(avgConfidence * 100).toFixed(1)}%. More historical data needed.`,
        priority: 'low',
        automated: true
      });
    }

    return insights;
  }

  /**
   * 시스템 상태 조회
   */
  getSystemStatus(): {
    initialized: boolean;
    components: {
      predictor: boolean;
      cache: boolean;
      scaler: boolean;
      monitor: boolean;
    };
    performance: {
      totalPredictions: number;
      cacheHitRate: number;
      scalingEvents: number;
      activeAlerts: number;
    };
  } {
    const cacheReport = adaptiveCache.generatePerformanceReport();
    const scalingAnalysis = autoScaler.analyzeScalingPerformance();
    const monitoringData = predictiveMonitor.getDashboardData();

    return {
      initialized: this.initialized,
      components: {
        predictor: true,
        cache: true,
        scaler: true,
        monitor: true
      },
      performance: {
        totalPredictions: resourcePredictor.predictAllServices(60).size,
        cacheHitRate: cacheReport.summary.hitRate,
        scalingEvents: scalingAnalysis.totalScalingEvents,
        activeAlerts: monitoringData.activeAlerts.length
      }
    };
  }

  /**
   * 성능 보고서 생성
   */
  generatePerformanceReport(): {
    summary: string;
    recommendations: string[];
    metrics: Record<string, number>;
  } {
    const status = this.getSystemStatus();
    const cacheReport = adaptiveCache.generatePerformanceReport();
    const scalingAnalysis = autoScaler.analyzeScalingPerformance();

    const summary = `
🧠 Intelligent Optimization System Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

System Status: ${status.initialized ? '✅ Active' : '❌ Inactive'}
Cache Hit Rate: ${(status.performance.cacheHitRate * 100).toFixed(1)}%
Scaling Success: ${(scalingAnalysis.successRate * 100).toFixed(1)}%
Active Alerts: ${status.performance.activeAlerts}

Performance Impact:
• Cost Savings: $${scalingAnalysis.costSavings.toFixed(0)}/month
• Response Time: ${cacheReport.summary.avgResponseTime.toFixed(0)}ms avg
• Automation Level: ${this.calculateAutomationLevel()}%
    `.trim();

    const recommendations = cacheReport.recommendations.concat([
      'Consider enabling auto-remediation for critical alerts',
      'Increase prediction horizon during peak hours',
      'Implement custom scaling policies for high-traffic services'
    ]);

    const metrics = {
      cacheHitRate: status.performance.cacheHitRate,
      scalingSuccessRate: scalingAnalysis.successRate,
      avgResponseTime: cacheReport.summary.avgResponseTime,
      costSavings: scalingAnalysis.costSavings,
      automationLevel: this.calculateAutomationLevel()
    };

    return { summary, recommendations, metrics };
  }

  /**
   * 자동화 수준 계산
   */
  private calculateAutomationLevel(): number {
    // 활성화된 자동화 기능들의 비율
    const features = [
      adaptiveCache.getOptimizationStatus().isMLEnabled,
      adaptiveCache.getOptimizationStatus().isPredictiveWarmingActive,
      adaptiveCache.getOptimizationStatus().isDynamicTTLActive,
      autoScaler.getStatus().enabled,
      predictiveMonitor.getDashboardData().systemOverview.totalServices > 0
    ];

    const activeFeatures = features.filter(f => f).length;
    return (activeFeatures / features.length) * 100;
  }

  /**
   * 정리
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    autoScaler.destroy();
    predictiveMonitor.destroy();

    this.initialized = false;
    console.log('🧠 Intelligence system destroyed');
  }
}

// 전역 인스턴스
export const intelligenceOrchestrator = new IntelligentOptimizationOrchestrator();