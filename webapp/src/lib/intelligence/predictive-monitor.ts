/**
 * 예측적 모니터링 시스템
 * Phase 4 - 지능형 최적화
 */

import { resourcePredictor, ResourcePrediction, AnomalyDetection } from './resource-predictor';
import { autoScaler, ScaleAction } from './auto-scaler';
import { logger } from '../utils/logger';

// 장애 예측 타입
export interface FailurePrediction {
  service: string;
  failureType: 'crash' | 'performance' | 'resource' | 'network' | 'dependency';
  probability: number;
  confidence: number;
  estimatedTimeToFailure: number; // ms
  severity: 'low' | 'medium' | 'high' | 'critical';
  rootCauses: string[];
  recommendations: RecommendedAction[];
  historicalSimilarity: number; // 과거 유사 사례와의 유사도
}

// 권장 조치
export interface RecommendedAction {
  type: 'restart' | 'scale' | 'config' | 'alert' | 'investigate';
  priority: number;
  description: string;
  estimatedEffectiveness: number;
  estimatedDuration: number; // ms
  automatable: boolean;
  costImpact: number;
}

// 모니터링 알람
export interface PredictiveAlert {
  id: string;
  service: string;
  type: 'prediction' | 'anomaly' | 'trend' | 'threshold';
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  prediction?: FailurePrediction;
  anomaly?: AnomalyDetection;
  acknowledged: boolean;
  resolvedAt?: number;
  metadata: Record<string, any>;
}

// 건강성 지표
export interface HealthScore {
  service: string;
  overall: number; // 0-100
  components: {
    performance: number;
    reliability: number;
    availability: number;
    scalability: number;
    security: number;
  };
  trend: 'improving' | 'stable' | 'degrading';
  riskFactors: string[];
  timestamp: number;
}

// 시스템 인사이트
export interface SystemInsight {
  id: string;
  type: 'optimization' | 'risk' | 'opportunity' | 'trend';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  actionable: boolean;
  estimatedValue: number; // 예상 가치 ($)
  implementationEffort: 'low' | 'medium' | 'high';
  timestamp: number;
}

// 예측적 모니터링 설정
export interface PredictiveMonitorConfig {
  enabled: boolean;
  monitoringInterval: number;
  predictionHorizon: number; // 예측 범위 (분)
  anomalyThreshold: number;
  failurePredictionThreshold: number;
  autoRemediation: boolean;
  alertChannels: string[];
  mlModelUpdateInterval: number;
}

// AI 기반 예측적 모니터링 시스템
export class AIPredictiveMonitor {
  private config: PredictiveMonitorConfig;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private healthScores: Map<string, HealthScore[]> = new Map();
  private alerts: PredictiveAlert[] = [];
  private insights: SystemInsight[] = [];
  private failureHistory: Map<string, FailurePrediction[]> = new Map();
  private remediationHistory: Map<string, any[]> = new Map();

  constructor(config: Partial<PredictiveMonitorConfig> = {}) {
    this.config = {
      enabled: true,
      monitoringInterval: 30 * 1000, // 30초
      predictionHorizon: 60, // 1시간 예측
      anomalyThreshold: 0.7,
      failurePredictionThreshold: 0.8,
      autoRemediation: false,
      alertChannels: ['email', 'slack'],
      mlModelUpdateInterval: 24 * 60 * 60 * 1000, // 24시간
      ...config
    };

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * 모니터링 시작
   */
  private startMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(() => {
      this.performPredictiveAnalysis();
    }, this.config.monitoringInterval);

    logger.info('Predictive monitoring started', {
      interval: this.config.monitoringInterval,
      horizon: this.config.predictionHorizon,
      autoRemediation: this.config.autoRemediation
    });
  }

  /**
   * 예측적 분석 수행
   */
  private async performPredictiveAnalysis(): Promise<void> {
    try {
      // 1. 모든 서비스에 대한 예측 수행
      const predictions = resourcePredictor.predictAllServices(this.config.predictionHorizon);
      
      // 2. 장애 예측 분석
      const failurePredictions = await this.analyzeFailurePredictions(predictions);
      
      // 3. 이상 탐지
      const anomalies = this.detectAnomalies(predictions);
      
      // 4. 건강성 점수 계산
      const healthScores = this.calculateHealthScores(predictions);
      
      // 5. 시스템 인사이트 생성
      const insights = this.generateSystemInsights(predictions, failurePredictions);
      
      // 6. 알림 생성
      await this.generateAlerts(failurePredictions, anomalies);
      
      // 7. 자동 복구 실행 (활성화된 경우)
      if (this.config.autoRemediation) {
        await this.executeAutoRemediation(failurePredictions);
      }

      logger.debug('Predictive analysis completed', {
        predictions: predictions.size,
        failures: failurePredictions.length,
        anomalies: anomalies.length,
        insights: insights.length
      });

    } catch (error) {
      logger.error('Predictive analysis failed', error as Error);
    }
  }

  /**
   * 장애 예측 분석
   */
  private async analyzeFailurePredictions(
    predictions: Map<string, ResourcePrediction>
  ): Promise<FailurePrediction[]> {
    const failurePredictions: FailurePrediction[] = [];

    for (const [service, prediction] of Array.from(predictions.entries())) {
      if (prediction.confidence < 0.5) continue;

      const failures = await this.predictServiceFailures(service, prediction);
      failurePredictions.push(...failures);
    }

    return failurePredictions;
  }

  /**
   * 개별 서비스 장애 예측
   */
  private async predictServiceFailures(
    service: string,
    prediction: ResourcePrediction
  ): Promise<FailurePrediction[]> {
    const failures: FailurePrediction[] = [];

    // CPU 기반 장애 예측
    const cpuFailure = this.predictCpuBasedFailure(service, prediction);
    if (cpuFailure) failures.push(cpuFailure);

    // 메모리 기반 장애 예측
    const memoryFailure = this.predictMemoryBasedFailure(service, prediction);
    if (memoryFailure) failures.push(memoryFailure);

    // 응답 시간 기반 장애 예측
    const latencyFailure = this.predictLatencyBasedFailure(service, prediction);
    if (latencyFailure) failures.push(latencyFailure);

    // 패턴 기반 장애 예측
    const patternFailure = await this.predictPatternBasedFailure(service, prediction);
    if (patternFailure) failures.push(patternFailure);

    return failures;
  }

  /**
   * CPU 기반 장애 예측
   */
  private predictCpuBasedFailure(
    service: string,
    prediction: ResourcePrediction
  ): FailurePrediction | null {
    const maxCpu = Math.max(...prediction.predictions.cpu);
    const sustainedHighCpu = prediction.predictions.cpu.filter(cpu => cpu > 90).length;

    if (maxCpu > 95 || sustainedHighCpu > prediction.predictions.cpu.length * 0.3) {
      const timeToFailure = this.estimateTimeToFailure(prediction.predictions.cpu, 95);
      
      return {
        service,
        failureType: 'resource',
        probability: Math.min(0.95, maxCpu / 100),
        confidence: prediction.confidence,
        estimatedTimeToFailure: timeToFailure,
        severity: maxCpu > 98 ? 'critical' : 'high',
        rootCauses: ['High CPU utilization', 'Insufficient compute resources'],
        recommendations: [
          {
            type: 'scale',
            priority: 1,
            description: 'Scale up service replicas',
            estimatedEffectiveness: 0.9,
            estimatedDuration: 120 * 1000,
            automatable: true,
            costImpact: 50
          },
          {
            type: 'investigate',
            priority: 2,
            description: 'Investigate CPU-intensive processes',
            estimatedEffectiveness: 0.7,
            estimatedDuration: 30 * 60 * 1000,
            automatable: false,
            costImpact: 0
          }
        ],
        historicalSimilarity: this.calculateHistoricalSimilarity(service, 'cpu')
      };
    }

    return null;
  }

  /**
   * 메모리 기반 장애 예측
   */
  private predictMemoryBasedFailure(
    service: string,
    prediction: ResourcePrediction
  ): FailurePrediction | null {
    const memoryTrend = this.calculateTrend(prediction.predictions.memory);
    const maxMemory = Math.max(...prediction.predictions.memory);

    // 메모리 누수 패턴 감지
    if (memoryTrend > 0.5 && maxMemory > 80) {
      const timeToFailure = this.estimateTimeToFailure(prediction.predictions.memory, 95);
      
      return {
        service,
        failureType: 'resource',
        probability: Math.min(0.9, memoryTrend + maxMemory / 100),
        confidence: prediction.confidence * 0.9,
        estimatedTimeToFailure: timeToFailure,
        severity: memoryTrend > 1.0 ? 'critical' : 'high',
        rootCauses: ['Memory leak detected', 'Insufficient memory allocation'],
        recommendations: [
          {
            type: 'restart',
            priority: 1,
            description: 'Restart service to clear memory leak',
            estimatedEffectiveness: 0.95,
            estimatedDuration: 60 * 1000,
            automatable: true,
            costImpact: 10
          },
          {
            type: 'scale',
            priority: 2,
            description: 'Increase memory allocation',
            estimatedEffectiveness: 0.8,
            estimatedDuration: 300 * 1000,
            automatable: true,
            costImpact: 30
          }
        ],
        historicalSimilarity: this.calculateHistoricalSimilarity(service, 'memory')
      };
    }

    return null;
  }

  /**
   * 응답 시간 기반 장애 예측
   */
  private predictLatencyBasedFailure(
    service: string,
    prediction: ResourcePrediction
  ): FailurePrediction | null {
    const maxLatency = Math.max(...prediction.predictions.latency);
    const latencySpikes = prediction.predictions.latency.filter(lat => lat > 1000).length;

    if (maxLatency > 2000 || latencySpikes > prediction.predictions.latency.length * 0.2) {
      return {
        service,
        failureType: 'performance',
        probability: Math.min(0.85, maxLatency / 3000),
        confidence: prediction.confidence,
        estimatedTimeToFailure: this.estimateTimeToFailure(prediction.predictions.latency, 3000),
        severity: maxLatency > 5000 ? 'critical' : 'high',
        rootCauses: ['Performance degradation', 'Increased response time'],
        recommendations: [
          {
            type: 'scale',
            priority: 1,
            description: 'Scale horizontally to distribute load',
            estimatedEffectiveness: 0.8,
            estimatedDuration: 180 * 1000,
            automatable: true,
            costImpact: 40
          },
          {
            type: 'investigate',
            priority: 2,
            description: 'Profile application performance',
            estimatedEffectiveness: 0.9,
            estimatedDuration: 60 * 60 * 1000,
            automatable: false,
            costImpact: 0
          }
        ],
        historicalSimilarity: this.calculateHistoricalSimilarity(service, 'latency')
      };
    }

    return null;
  }

  /**
   * 패턴 기반 장애 예측
   */
  private async predictPatternBasedFailure(
    service: string,
    prediction: ResourcePrediction
  ): Promise<FailurePrediction | null> {
    // 과거 장애 패턴과의 유사성 분석
    const history = this.failureHistory.get(service) || [];
    if (history.length < 3) return null;

    const currentPattern = this.extractPattern(prediction);
    const similarPatterns = history.filter(h => 
      this.calculatePatternSimilarity(currentPattern, this.extractPattern(h)) > 0.8
    );

    if (similarPatterns.length > 0) {
      const avgProbability = similarPatterns.reduce((sum, p) => sum + p.probability, 0) / similarPatterns.length;
      
      return {
        service,
        failureType: 'dependency',
        probability: avgProbability * 0.8, // 약간 낮춤
        confidence: 0.7,
        estimatedTimeToFailure: 30 * 60 * 1000, // 30분
        severity: 'medium',
        rootCauses: ['Historical pattern similarity detected'],
        recommendations: [
          {
            type: 'alert',
            priority: 1,
            description: 'Monitor closely based on historical patterns',
            estimatedEffectiveness: 0.6,
            estimatedDuration: 0,
            automatable: true,
            costImpact: 0
          }
        ],
        historicalSimilarity: 0.8
      };
    }

    return null;
  }

  /**
   * 트렌드 계산
   */
  private calculateTrend(data: number[]): number {
    if (data.length < 2) return 0;

    const n = data.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = data.reduce((sum, val) => sum + val, 0);
    const sumXY = data.reduce((sum, val, index) => sum + val * (index + 1), 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * 장애까지 예상 시간 계산
   */
  private estimateTimeToFailure(data: number[], threshold: number): number {
    const currentValue = data[0];
    const trend = this.calculateTrend(data);
    
    if (trend <= 0) return Infinity;
    
    const timeToThreshold = (threshold - currentValue) / trend;
    return Math.max(0, timeToThreshold * 60 * 1000); // 분을 밀리초로 변환
  }

  /**
   * 과거 유사성 계산
   */
  private calculateHistoricalSimilarity(service: string, metric: string): number {
    // 실제 구현에서는 과거 데이터와의 유사성 계산
    return Math.random() * 0.5 + 0.3; // 0.3-0.8 범위의 모의 값
  }

  /**
   * 패턴 추출
   */
  private extractPattern(data: any): number[] {
    // 실제 구현에서는 더 정교한 패턴 추출
    if (data.predictions) {
      return data.predictions.cpu.slice(0, 10); // 처음 10개 데이터 포인트
    }
    return [];
  }

  /**
   * 패턴 유사성 계산
   */
  private calculatePatternSimilarity(pattern1: number[], pattern2: number[]): number {
    if (pattern1.length !== pattern2.length) return 0;
    
    const correlation = this.calculateCorrelation(pattern1, pattern2);
    return Math.abs(correlation);
  }

  /**
   * 상관관계 계산
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * 이상 탐지
   */
  private detectAnomalies(predictions: Map<string, ResourcePrediction>): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];

    for (const [service, prediction] of Array.from(predictions.entries())) {
      anomalies.push(...prediction.anomalies);
    }

    return anomalies.filter(anomaly => anomaly.probability > this.config.anomalyThreshold);
  }

  /**
   * 건강성 점수 계산
   */
  private calculateHealthScores(predictions: Map<string, ResourcePrediction>): HealthScore[] {
    const healthScores: HealthScore[] = [];

    for (const [service, prediction] of Array.from(predictions.entries())) {
      const score = this.calculateServiceHealthScore(service, prediction);
      healthScores.push(score);
      
      // 기록 저장
      if (!this.healthScores.has(service)) {
        this.healthScores.set(service, []);
      }
      
      const serviceScores = this.healthScores.get(service)!;
      serviceScores.push(score);
      
      // 최대 100개만 유지
      if (serviceScores.length > 100) {
        serviceScores.shift();
      }
    }

    return healthScores;
  }

  /**
   * 개별 서비스 건강성 점수 계산
   */
  private calculateServiceHealthScore(service: string, prediction: ResourcePrediction): HealthScore {
    const maxCpu = Math.max(...prediction.predictions.cpu);
    const maxMemory = Math.max(...prediction.predictions.memory);
    const maxLatency = Math.max(...prediction.predictions.latency);
    
    // 성능 점수 (0-100)
    const performance = Math.max(0, 100 - Math.max(maxCpu - 70, maxMemory - 70, (maxLatency - 500) / 10));
    
    // 신뢰성 점수
    const reliability = prediction.confidence * 100;
    
    // 가용성 점수 (오류율 기반)
    const availability = Math.max(0, 100 - prediction.anomalies.length * 10);
    
    // 확장성 점수
    const scalability = Math.max(0, 100 - (maxCpu > 80 ? 30 : 0) - (maxMemory > 80 ? 30 : 0));
    
    // 보안 점수 (기본값)
    const security = 85; // 모의 값
    
    const overall = (performance + reliability + availability + scalability + security) / 5;
    
    // 트렌드 계산
    const previousScores = this.healthScores.get(service) || [];
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    
    if (previousScores.length > 0) {
      const lastScore = previousScores[previousScores.length - 1].overall;
      const diff = overall - lastScore;
      
      if (diff > 5) trend = 'improving';
      else if (diff < -5) trend = 'degrading';
    }

    // 위험 요소 식별
    const riskFactors: string[] = [];
    if (maxCpu > 80) riskFactors.push('High CPU utilization');
    if (maxMemory > 80) riskFactors.push('High memory usage');
    if (maxLatency > 1000) riskFactors.push('High latency');
    if (prediction.anomalies.length > 0) riskFactors.push('Anomalies detected');

    return {
      service,
      overall,
      components: {
        performance,
        reliability,
        availability,
        scalability,
        security
      },
      trend,
      riskFactors,
      timestamp: Date.now()
    };
  }

  /**
   * 시스템 인사이트 생성
   */
  private generateSystemInsights(
    predictions: Map<string, ResourcePrediction>,
    failures: FailurePrediction[]
  ): SystemInsight[] {
    const insights: SystemInsight[] = [];

    // 최적화 기회 식별
    insights.push(...this.identifyOptimizationOpportunities(predictions));
    
    // 위험 요소 분석
    insights.push(...this.analyzeRiskFactors(failures));
    
    // 트렌드 분석
    insights.push(...this.analyzeTrends(predictions));

    this.insights.push(...insights);
    
    // 최대 500개 인사이트만 유지
    if (this.insights.length > 500) {
      this.insights = this.insights.slice(-500);
    }

    return insights;
  }

  /**
   * 최적화 기회 식별
   */
  private identifyOptimizationOpportunities(
    predictions: Map<string, ResourcePrediction>
  ): SystemInsight[] {
    const insights: SystemInsight[] = [];

    for (const [service, prediction] of Array.from(predictions.entries())) {
      const avgCpu = prediction.predictions.cpu.reduce((sum, val) => sum + val, 0) / prediction.predictions.cpu.length;
      const avgMemory = prediction.predictions.memory.reduce((sum, val) => sum + val, 0) / prediction.predictions.memory.length;

      // 과도한 리소스 할당 감지
      if (avgCpu < 30 && avgMemory < 40) {
        insights.push({
          id: `opt_${service}_${Date.now()}`,
          type: 'optimization',
          title: `Resource over-allocation detected: ${service}`,
          description: `Service ${service} is using only ${avgCpu.toFixed(1)}% CPU and ${avgMemory.toFixed(1)}% memory on average. Consider scaling down.`,
          impact: 'medium',
          confidence: prediction.confidence,
          actionable: true,
          estimatedValue: 200, // $200/월 절약 예상
          implementationEffort: 'low',
          timestamp: Date.now()
        });
      }

      // 캐시 최적화 기회
      if (prediction.predictions.latency.some(lat => lat > 500)) {
        insights.push({
          id: `cache_${service}_${Date.now()}`,
          type: 'optimization',
          title: `Cache optimization opportunity: ${service}`,
          description: `High latency detected in ${service}. Consider implementing or optimizing caching strategy.`,
          impact: 'high',
          confidence: 0.8,
          actionable: true,
          estimatedValue: 500, // $500/월 성능 향상 가치
          implementationEffort: 'medium',
          timestamp: Date.now()
        });
      }
    }

    return insights;
  }

  /**
   * 위험 요소 분석
   */
  private analyzeRiskFactors(failures: FailurePrediction[]): SystemInsight[] {
    const insights: SystemInsight[] = [];

    const criticalFailures = failures.filter(f => f.severity === 'critical');
    if (criticalFailures.length > 0) {
      insights.push({
        id: `risk_critical_${Date.now()}`,
        type: 'risk',
        title: `Critical failure risks detected`,
        description: `${criticalFailures.length} services have critical failure risks. Immediate attention required.`,
        impact: 'high',
        confidence: 0.9,
        actionable: true,
        estimatedValue: -10000, // 잠재적 손실
        implementationEffort: 'high',
        timestamp: Date.now()
      });
    }

    return insights;
  }

  /**
   * 트렌드 분석
   */
  private analyzeTrends(predictions: Map<string, ResourcePrediction>): SystemInsight[] {
    const insights: SystemInsight[] = [];

    const services = Array.from(predictions.keys());
    const degradingServices = services.filter(service => {
      const scores = this.healthScores.get(service) || [];
      return scores.length > 0 && scores[scores.length - 1].trend === 'degrading';
    });

    if (degradingServices.length > services.length * 0.3) {
      insights.push({
        id: `trend_degrading_${Date.now()}`,
        type: 'trend',
        title: `System-wide performance degradation trend`,
        description: `${degradingServices.length} out of ${services.length} services show degrading performance trends.`,
        impact: 'high',
        confidence: 0.85,
        actionable: true,
        estimatedValue: -5000, // 잠재적 비용
        implementationEffort: 'medium',
        timestamp: Date.now()
      });
    }

    return insights;
  }

  /**
   * 알림 생성
   */
  private async generateAlerts(
    failures: FailurePrediction[],
    anomalies: AnomalyDetection[]
  ): Promise<void> {
    // 장애 예측 알림
    for (const failure of failures) {
      if (failure.probability > this.config.failurePredictionThreshold) {
        const alert: PredictiveAlert = {
          id: `failure_${failure.service}_${Date.now()}`,
          service: failure.service,
          type: 'prediction',
          level: this.mapSeverityToLevel(failure.severity),
          title: `Failure predicted: ${failure.service}`,
          message: `${failure.failureType} failure predicted with ${(failure.probability * 100).toFixed(1)}% probability in ${Math.round(failure.estimatedTimeToFailure / 60000)} minutes`,
          timestamp: Date.now(),
          prediction: failure,
          acknowledged: false,
          metadata: {
            rootCauses: failure.rootCauses,
            recommendations: failure.recommendations
          }
        };

        this.alerts.push(alert);
        await this.sendAlert(alert);
      }
    }

    // 이상 탐지 알림
    for (const anomaly of anomalies) {
      const alert: PredictiveAlert = {
        id: `anomaly_${anomaly.type}_${Date.now()}`,
        service: 'system',
        type: 'anomaly',
        level: this.mapSeverityToLevel(anomaly.severity),
        title: `Anomaly detected: ${anomaly.type}`,
        message: anomaly.recommendation,
        timestamp: Date.now(),
        anomaly,
        acknowledged: false,
        metadata: {
          metric: anomaly.metric,
          probability: anomaly.probability
        }
      };

      this.alerts.push(alert);
      await this.sendAlert(alert);
    }

    // 최대 1000개 알림만 유지
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  /**
   * 심각도를 알림 레벨로 매핑
   */
  private mapSeverityToLevel(severity: string): 'info' | 'warning' | 'error' | 'critical' {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'critical';
      default: return 'info';
    }
  }

  /**
   * 알림 전송
   */
  private async sendAlert(alert: PredictiveAlert): Promise<void> {
    try {
      logger.warn(`[PREDICTIVE ALERT] ${alert.title}`, {
        service: alert.service,
        level: alert.level,
        message: alert.message
      });

      // 실제 구현에서는 이메일, Slack 등으로 전송
      for (const channel of this.config.alertChannels) {
        await this.sendToChannel(channel, alert);
      }

    } catch (error) {
      logger.error('Failed to send alert', error as Error);
    }
  }

  /**
   * 채널별 알림 전송
   */
  private async sendToChannel(channel: string, alert: PredictiveAlert): Promise<void> {
    // 실제 구현에서는 각 채널별 API 호출
    logger.debug(`Alert sent to ${channel}: ${alert.title}`);
  }

  /**
   * 자동 복구 실행
   */
  private async executeAutoRemediation(failures: FailurePrediction[]): Promise<void> {
    for (const failure of failures) {
      if (failure.severity === 'critical' && failure.probability > 0.9) {
        const automatableActions = failure.recommendations.filter(rec => rec.automatable);
        
        for (const action of automatableActions) {
          try {
            await this.executeRemediationAction(failure.service, action);
            logger.info(`Auto-remediation executed: ${action.description}`, {
              service: failure.service,
              action: action.type
            });
          } catch (error) {
            logger.error(`Auto-remediation failed: ${failure.service}`, error as Error);
          }
        }
      }
    }
  }

  /**
   * 복구 액션 실행
   */
  private async executeRemediationAction(service: string, action: RecommendedAction): Promise<void> {
    switch (action.type) {
      case 'restart':
        await this.restartService(service);
        break;
      case 'scale':
        await this.scaleService(service, action);
        break;
      case 'config':
        await this.updateServiceConfig(service, action);
        break;
      default:
        logger.warn(`Unknown remediation action: ${action.type}`);
    }

    // 복구 이력 기록
    if (!this.remediationHistory.has(service)) {
      this.remediationHistory.set(service, []);
    }
    
    this.remediationHistory.get(service)!.push({
      timestamp: Date.now(),
      action,
      result: 'success'
    });
  }

  /**
   * 서비스 재시작
   */
  private async restartService(service: string): Promise<void> {
    // 실제 구현에서는 Docker/Kubernetes API 호출
    logger.info(`Restarting service: ${service}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * 서비스 스케일링
   */
  private async scaleService(service: string, action: RecommendedAction): Promise<void> {
    // Auto-scaler 연동
    logger.info(`Scaling service: ${service}`);
    // autoScaler.forceScale(service, action.parameters);
  }

  /**
   * 서비스 설정 업데이트
   */
  private async updateServiceConfig(service: string, action: RecommendedAction): Promise<void> {
    logger.info(`Updating config for service: ${service}`);
    // 실제 설정 업데이트 로직
  }

  /**
   * 대시보드 데이터 조회
   */
  getDashboardData(): {
    healthScores: HealthScore[];
    activeAlerts: PredictiveAlert[];
    recentInsights: SystemInsight[];
    systemOverview: {
      totalServices: number;
      healthyServices: number;
      atRiskServices: number;
      criticalServices: number;
    };
  } {
    const latestHealthScores = Array.from(this.healthScores.values())
      .map(scores => scores[scores.length - 1])
      .filter(score => score !== undefined);

    const activeAlerts = this.alerts.filter(alert => !alert.acknowledged);
    const recentInsights = this.insights
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    const systemOverview = {
      totalServices: latestHealthScores.length,
      healthyServices: latestHealthScores.filter(s => s.overall > 70).length,
      atRiskServices: latestHealthScores.filter(s => s.overall > 40 && s.overall <= 70).length,
      criticalServices: latestHealthScores.filter(s => s.overall <= 40).length
    };

    return {
      healthScores: latestHealthScores,
      activeAlerts,
      recentInsights,
      systemOverview
    };
  }

  /**
   * 알림 승인
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<PredictiveMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.enabled !== undefined) {
      if (newConfig.enabled && !this.monitoringTimer) {
        this.startMonitoring();
      } else if (!newConfig.enabled && this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
        this.monitoringTimer = null;
      }
    }

    logger.info('Predictive monitor configuration updated', newConfig);
  }

  /**
   * 정리
   */
  destroy(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    logger.info('Predictive monitor destroyed');
  }
}

// 전역 예측적 모니터링 인스턴스
export const predictiveMonitor = new AIPredictiveMonitor({
  enabled: true,
  monitoringInterval: 30 * 1000, // 30초
  predictionHorizon: 60, // 1시간
  anomalyThreshold: 0.7,
  failurePredictionThreshold: 0.8,
  autoRemediation: false, // 초기에는 비활성화
  alertChannels: ['email', 'slack']
});