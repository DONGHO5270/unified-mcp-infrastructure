/**
 * 자동 스케일링 시스템
 * Phase 4 - 지능형 최적화
 */

import { resourcePredictor, ResourcePrediction } from './resource-predictor';
import { logger } from '../utils/logger';

// 스케일링 정책 타입
export type ScalingPolicy = 'reactive' | 'predictive' | 'scheduled' | 'cost-aware' | 'hybrid';

// 스케일링 액션
export interface ScaleAction {
  service: string;
  action: 'scale-up' | 'scale-down' | 'maintain';
  currentReplicas: number;
  targetReplicas: number;
  reason: string;
  confidence: number;
  estimatedCost: number;
  estimatedBenefit: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  scheduledTime?: number; // 예약된 실행 시간
}

// 스케일링 제약사항
export interface ScalingConstraints {
  minReplicas: number;
  maxReplicas: number;
  maxScaleUpStep: number;    // 한 번에 증가할 수 있는 최대 replica 수
  maxScaleDownStep: number;  // 한 번에 감소할 수 있는 최대 replica 수
  cooldownPeriod: number;    // 스케일링 후 대기 시간 (ms)
  costBudget?: number;       // 비용 예산 (월별)
  performanceTargets: {
    maxCpuUtilization: number;
    maxMemoryUtilization: number;
    maxLatency: number;
    minThroughput: number;
  };
}

// 서비스 메트릭
export interface ServiceMetrics {
  service: string;
  timestamp: number;
  replicas: number;
  cpu: number;
  memory: number;
  requests: number;
  latency: number;
  errors: number;
  cost: number;
}

// 스케일링 이벤트
export interface ScalingEvent {
  id: string;
  service: string;
  timestamp: number;
  action: ScaleAction;
  result: 'success' | 'failed' | 'partial';
  duration: number;
  beforeMetrics: ServiceMetrics;
  afterMetrics?: ServiceMetrics;
  costImpact: number;
}

// 자동 스케일러 설정
export interface AutoScalerConfig {
  enabled: boolean;
  policy: ScalingPolicy;
  evaluationInterval: number;  // 평가 주기 (ms)
  dryRun: boolean;            // 실제 실행하지 않고 로그만
  constraints: Map<string, ScalingConstraints>;
  costOptimization: boolean;
  predictiveHorizon: number;  // 예측 시간 범위 (분)
}

// AI 기반 자동 스케일러
export class AIAutoScaler {
  private config: AutoScalerConfig;
  private serviceMetrics: Map<string, ServiceMetrics[]> = new Map();
  private scalingHistory: ScalingEvent[] = [];
  private lastScalingTime: Map<string, number> = new Map();
  private evaluationTimer: NodeJS.Timeout | null = null;
  private predictiveModels: Map<string, any> = new Map();

  constructor(config: Partial<AutoScalerConfig> = {}) {
    this.config = {
      enabled: true,
      policy: 'hybrid',
      evaluationInterval: 60 * 1000, // 1분마다 평가
      dryRun: false,
      constraints: new Map(),
      costOptimization: true,
      predictiveHorizon: 30, // 30분 예측
      ...config
    };

    if (this.config.enabled) {
      this.startEvaluation();
    }
  }

  /**
   * 스케일링 평가 시작
   */
  private startEvaluation(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }

    this.evaluationTimer = setInterval(() => {
      this.evaluateAllServices();
    }, this.config.evaluationInterval);

    logger.info('Auto-scaler evaluation started', {
      policy: this.config.policy,
      interval: this.config.evaluationInterval,
      dryRun: this.config.dryRun
    });
  }

  /**
   * 모든 서비스 스케일링 평가
   */
  private async evaluateAllServices(): Promise<void> {
    try {
      const services = Array.from(this.serviceMetrics.keys());
      const scaleActions: ScaleAction[] = [];

      for (const service of services) {
        const action = await this.evaluateService(service);
        if (action) {
          scaleActions.push(action);
        }
      }

      // 비용 최적화가 활성화된 경우 액션 우선순위 조정
      if (this.config.costOptimization) {
        this.optimizeActionsForCost(scaleActions);
      }

      // 스케일링 액션 실행
      for (const action of scaleActions) {
        await this.executeScaleAction(action);
      }

    } catch (error) {
      logger.error('Auto-scaling evaluation failed', error as Error);
    }
  }

  /**
   * 단일 서비스 스케일링 평가
   */
  private async evaluateService(service: string): Promise<ScaleAction | null> {
    const constraints = this.config.constraints.get(service);
    if (!constraints) {
      logger.warn(`No scaling constraints defined for service: ${service}`);
      return null;
    }

    const currentMetrics = this.getCurrentMetrics(service);
    if (!currentMetrics) {
      logger.warn(`No metrics available for service: ${service}`);
      return null;
    }

    // 쿨다운 체크
    const lastScaling = this.lastScalingTime.get(service) || 0;
    if (Date.now() - lastScaling < constraints.cooldownPeriod) {
      logger.debug(`Service ${service} is in cooldown period`);
      return null;
    }

    let scaleAction: ScaleAction | null = null;

    switch (this.config.policy) {
      case 'reactive':
        scaleAction = this.evaluateReactiveScaling(service, currentMetrics, constraints);
        break;
      case 'predictive':
        scaleAction = await this.evaluatePredictiveScaling(service, currentMetrics, constraints);
        break;
      case 'scheduled':
        scaleAction = this.evaluateScheduledScaling(service, currentMetrics, constraints);
        break;
      case 'cost-aware':
        scaleAction = this.evaluateCostAwareScaling(service, currentMetrics, constraints);
        break;
      case 'hybrid':
        scaleAction = await this.evaluateHybridScaling(service, currentMetrics, constraints);
        break;
    }

    return scaleAction;
  }

  /**
   * 반응적 스케일링 평가
   */
  private evaluateReactiveScaling(
    service: string,
    metrics: ServiceMetrics,
    constraints: ScalingConstraints
  ): ScaleAction | null {
    const { cpu, memory, latency } = metrics;
    const { maxCpuUtilization, maxMemoryUtilization, maxLatency } = constraints.performanceTargets;

    // 스케일 업 조건
    if (cpu > maxCpuUtilization || memory > maxMemoryUtilization || latency > maxLatency) {
      const urgency = this.calculateUrgency(cpu, memory, latency, constraints);
      const targetReplicas = this.calculateTargetReplicas(metrics, constraints, 'up');

      return {
        service,
        action: 'scale-up',
        currentReplicas: metrics.replicas,
        targetReplicas,
        reason: `High resource utilization: CPU=${cpu.toFixed(1)}%, Memory=${memory.toFixed(1)}%, Latency=${latency.toFixed(1)}ms`,
        confidence: 0.9,
        estimatedCost: this.estimateScalingCost(service, targetReplicas - metrics.replicas),
        estimatedBenefit: this.estimateScalingBenefit(service, targetReplicas - metrics.replicas),
        urgency
      };
    }

    // 스케일 다운 조건
    if (cpu < maxCpuUtilization * 0.5 && memory < maxMemoryUtilization * 0.5 && latency < maxLatency * 0.7) {
      const targetReplicas = this.calculateTargetReplicas(metrics, constraints, 'down');

      if (targetReplicas < metrics.replicas) {
        return {
          service,
          action: 'scale-down',
          currentReplicas: metrics.replicas,
          targetReplicas,
          reason: `Low resource utilization: CPU=${cpu.toFixed(1)}%, Memory=${memory.toFixed(1)}%`,
          confidence: 0.8,
          estimatedCost: this.estimateScalingCost(service, targetReplicas - metrics.replicas),
          estimatedBenefit: this.estimateScalingBenefit(service, targetReplicas - metrics.replicas),
          urgency: 'low'
        };
      }
    }

    return null;
  }

  /**
   * 예측적 스케일링 평가
   */
  private async evaluatePredictiveScaling(
    service: string,
    metrics: ServiceMetrics,
    constraints: ScalingConstraints
  ): Promise<ScaleAction | null> {
    const prediction = resourcePredictor.predictUsage(service, this.config.predictiveHorizon);
    if (!prediction) {
      logger.warn(`No prediction available for service: ${service}`);
      return this.evaluateReactiveScaling(service, metrics, constraints);
    }

    // 예측된 메트릭에서 최대값 찾기
    const maxPredictedCpu = Math.max(...prediction.predictions.cpu);
    const maxPredictedMemory = Math.max(...prediction.predictions.memory);
    const maxPredictedLatency = Math.max(...prediction.predictions.latency);

    const { maxCpuUtilization, maxMemoryUtilization, maxLatency } = constraints.performanceTargets;

    // 예측된 부하가 임계값을 초과할 것으로 예상되는 경우
    if (maxPredictedCpu > maxCpuUtilization || 
        maxPredictedMemory > maxMemoryUtilization || 
        maxPredictedLatency > maxLatency) {

      // 스파이크 발생 시점 예측
      const spikeIndex = prediction.predictions.cpu.findIndex(cpu => cpu > maxCpuUtilization);
      const estimatedSpikeTime = Date.now() + (spikeIndex * 60 * 1000); // 분 단위

      const targetReplicas = this.calculatePredictiveTargetReplicas(prediction, constraints);

      return {
        service,
        action: 'scale-up',
        currentReplicas: metrics.replicas,
        targetReplicas,
        reason: `Predicted load spike: Max CPU=${maxPredictedCpu.toFixed(1)}% in ${spikeIndex} minutes`,
        confidence: prediction.confidence,
        estimatedCost: this.estimateScalingCost(service, targetReplicas - metrics.replicas),
        estimatedBenefit: this.estimateScalingBenefit(service, targetReplicas - metrics.replicas),
        urgency: 'medium',
        scheduledTime: estimatedSpikeTime - 5 * 60 * 1000 // 5분 전 미리 스케일링
      };
    }

    return null;
  }

  /**
   * 스케줄 기반 스케일링 평가
   */
  private evaluateScheduledScaling(
    service: string,
    metrics: ServiceMetrics,
    constraints: ScalingConstraints
  ): ScaleAction | null {
    // 일정 패턴 기반 스케일링 (예: 주중/주말, 시간대별)
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    let targetReplicas = metrics.replicas;

    // 비즈니스 시간 (월-금, 9-18시)
    const isBusinessHours = dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour <= 18;
    
    if (isBusinessHours) {
      // 비즈니스 시간에는 더 많은 리플리카
      targetReplicas = Math.max(constraints.minReplicas * 2, metrics.replicas);
    } else {
      // 비즈니스 시간 외에는 최소 리플리카
      targetReplicas = constraints.minReplicas;
    }

    if (targetReplicas !== metrics.replicas) {
      return {
        service,
        action: targetReplicas > metrics.replicas ? 'scale-up' : 'scale-down',
        currentReplicas: metrics.replicas,
        targetReplicas,
        reason: `Scheduled scaling: ${isBusinessHours ? 'Business hours' : 'Off hours'}`,
        confidence: 0.7,
        estimatedCost: this.estimateScalingCost(service, targetReplicas - metrics.replicas),
        estimatedBenefit: this.estimateScalingBenefit(service, targetReplicas - metrics.replicas),
        urgency: 'low'
      };
    }

    return null;
  }

  /**
   * 비용 인식 스케일링 평가
   */
  private evaluateCostAwareScaling(
    service: string,
    metrics: ServiceMetrics,
    constraints: ScalingConstraints
  ): ScaleAction | null {
    const reactiveAction = this.evaluateReactiveScaling(service, metrics, constraints);
    if (!reactiveAction) return null;

    // 비용 대비 효과 분석
    const costEfficiency = reactiveAction.estimatedBenefit / reactiveAction.estimatedCost;
    
    // 비용 효율성이 임계값 이하인 경우 스케일링 연기
    if (costEfficiency < 2.0 && reactiveAction.urgency !== 'critical') {
      logger.info(`Scaling postponed for cost efficiency: ${service}`, {
        costEfficiency,
        estimatedCost: reactiveAction.estimatedCost,
        estimatedBenefit: reactiveAction.estimatedBenefit
      });
      return null;
    }

    return reactiveAction;
  }

  /**
   * 하이브리드 스케일링 평가
   */
  private async evaluateHybridScaling(
    service: string,
    metrics: ServiceMetrics,
    constraints: ScalingConstraints
  ): Promise<ScaleAction | null> {
    // 1. 긴급 상황 체크 (반응적)
    const reactiveAction = this.evaluateReactiveScaling(service, metrics, constraints);
    if (reactiveAction && reactiveAction.urgency === 'critical') {
      return reactiveAction;
    }

    // 2. 예측적 스케일링 체크
    const predictiveAction = await this.evaluatePredictiveScaling(service, metrics, constraints);
    if (predictiveAction && predictiveAction.confidence > 0.8) {
      return predictiveAction;
    }

    // 3. 스케줄 기반 스케일링 체크
    const scheduledAction = this.evaluateScheduledScaling(service, metrics, constraints);
    if (scheduledAction) {
      return scheduledAction;
    }

    // 4. 비용 효율성 체크된 반응적 스케일링
    if (reactiveAction) {
      return this.evaluateCostAwareScaling(service, metrics, constraints);
    }

    return null;
  }

  /**
   * 긴급도 계산
   */
  private calculateUrgency(
    cpu: number,
    memory: number,
    latency: number,
    constraints: ScalingConstraints
  ): 'low' | 'medium' | 'high' | 'critical' {
    const { maxCpuUtilization, maxMemoryUtilization, maxLatency } = constraints.performanceTargets;

    const cpuRatio = cpu / maxCpuUtilization;
    const memoryRatio = memory / maxMemoryUtilization;
    const latencyRatio = latency / maxLatency;

    const maxRatio = Math.max(cpuRatio, memoryRatio, latencyRatio);

    if (maxRatio > 1.5) return 'critical';
    if (maxRatio > 1.2) return 'high';
    if (maxRatio > 1.0) return 'medium';
    return 'low';
  }

  /**
   * 목표 리플리카 수 계산
   */
  private calculateTargetReplicas(
    metrics: ServiceMetrics,
    constraints: ScalingConstraints,
    direction: 'up' | 'down'
  ): number {
    const { cpu, memory, replicas } = metrics;
    const { maxCpuUtilization, maxMemoryUtilization } = constraints.performanceTargets;

    let targetReplicas = replicas;

    if (direction === 'up') {
      // CPU 기반 계산
      const cpuBasedReplicas = Math.ceil(replicas * (cpu / (maxCpuUtilization * 0.8)));
      
      // 메모리 기반 계산
      const memoryBasedReplicas = Math.ceil(replicas * (memory / (maxMemoryUtilization * 0.8)));
      
      // 더 큰 값 선택
      targetReplicas = Math.max(cpuBasedReplicas, memoryBasedReplicas);
      
      // 최대 증가량 제한
      targetReplicas = Math.min(targetReplicas, replicas + constraints.maxScaleUpStep);
    } else {
      // 안전한 스케일 다운
      const utilizationFactor = Math.max(cpu, memory) / 100;
      targetReplicas = Math.max(
        constraints.minReplicas,
        Math.floor(replicas * utilizationFactor * 1.3) // 30% 여유 확보
      );
      
      // 최대 감소량 제한
      targetReplicas = Math.max(targetReplicas, replicas - constraints.maxScaleDownStep);
    }

    // 제약사항 적용
    return Math.min(constraints.maxReplicas, Math.max(constraints.minReplicas, targetReplicas));
  }

  /**
   * 예측 기반 목표 리플리카 수 계산
   */
  private calculatePredictiveTargetReplicas(
    prediction: ResourcePrediction,
    constraints: ScalingConstraints
  ): number {
    const maxCpu = Math.max(...prediction.predictions.cpu);
    const maxMemory = Math.max(...prediction.predictions.memory);
    
    const { maxCpuUtilization, maxMemoryUtilization } = constraints.performanceTargets;
    
    // 예측된 최대 부하를 처리할 수 있는 리플리카 수 계산
    const cpuBasedReplicas = Math.ceil(maxCpu / (maxCpuUtilization * 0.8));
    const memoryBasedReplicas = Math.ceil(maxMemory / (maxMemoryUtilization * 0.8));
    
    const targetReplicas = Math.max(cpuBasedReplicas, memoryBasedReplicas);
    
    return Math.min(constraints.maxReplicas, Math.max(constraints.minReplicas, targetReplicas));
  }

  /**
   * 스케일링 비용 추정
   */
  private estimateScalingCost(service: string, replicaDelta: number): number {
    // 실제 구현에서는 클라우드 제공업체의 가격 정보 사용
    const costPerReplica = 50; // $50/월 per replica (예시)
    return Math.abs(replicaDelta) * costPerReplica;
  }

  /**
   * 스케일링 이익 추정
   */
  private estimateScalingBenefit(service: string, replicaDelta: number): number {
    if (replicaDelta > 0) {
      // 스케일 업: 성능 향상 이익
      return replicaDelta * 100; // $100/월 per replica (성능 향상 가치)
    } else {
      // 스케일 다운: 비용 절약 이익
      return Math.abs(replicaDelta) * 50; // $50/월 per replica 절약
    }
  }

  /**
   * 비용 최적화된 액션 우선순위 조정
   */
  private optimizeActionsForCost(actions: ScaleAction[]): void {
    // ROI 기준으로 정렬
    actions.sort((a, b) => {
      const roiA = a.estimatedBenefit / a.estimatedCost;
      const roiB = b.estimatedBenefit / b.estimatedCost;
      
      // 긴급도도 고려
      const urgencyWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const scoreA = roiA * urgencyWeight[a.urgency];
      const scoreB = roiB * urgencyWeight[b.urgency];
      
      return scoreB - scoreA;
    });

    // 예산 제한 체크 (실제 구현에서 필요시)
    logger.info(`Optimized ${actions.length} scaling actions for cost efficiency`);
  }

  /**
   * 스케일링 액션 실행
   */
  private async executeScaleAction(action: ScaleAction): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing scaling action for ${action.service}`, {
        action: action.action,
        from: action.currentReplicas,
        to: action.targetReplicas,
        reason: action.reason,
        dryRun: this.config.dryRun
      });

      if (this.config.dryRun) {
        logger.info(`[DRY RUN] Would execute scaling action: ${action.service}`);
        return;
      }

      // 실제 스케일링 실행 (구현 필요)
      await this.performActualScaling(action);

      // 성공 이벤트 기록
      const event: ScalingEvent = {
        id: this.generateEventId(),
        service: action.service,
        timestamp: startTime,
        action,
        result: 'success',
        duration: Date.now() - startTime,
        beforeMetrics: this.getCurrentMetrics(action.service)!,
        costImpact: action.estimatedCost
      };

      this.scalingHistory.push(event);
      this.lastScalingTime.set(action.service, Date.now());

      logger.info(`Scaling action completed successfully: ${action.service}`);

    } catch (error) {
      logger.error(`Scaling action failed: ${action.service}`, error as Error);
      
      // 실패 이벤트 기록
      const event: ScalingEvent = {
        id: this.generateEventId(),
        service: action.service,
        timestamp: startTime,
        action,
        result: 'failed',
        duration: Date.now() - startTime,
        beforeMetrics: this.getCurrentMetrics(action.service)!,
        costImpact: 0
      };

      this.scalingHistory.push(event);
    }
  }

  /**
   * 실제 스케일링 수행
   */
  private async performActualScaling(action: ScaleAction): Promise<void> {
    // 실제 구현에서는 Docker Compose, Kubernetes, 또는 클라우드 API 호출
    // 여기서는 모의 구현
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.info(`Scaled ${action.service} to ${action.targetReplicas} replicas`);
  }

  /**
   * 현재 메트릭 조회
   */
  private getCurrentMetrics(service: string): ServiceMetrics | null {
    const metrics = this.serviceMetrics.get(service);
    if (!metrics || metrics.length === 0) return null;
    
    return metrics[metrics.length - 1];
  }

  /**
   * 이벤트 ID 생성
   */
  private generateEventId(): string {
    return `scale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 서비스 메트릭 추가
   */
  addMetrics(service: string, metrics: ServiceMetrics): void {
    if (!this.serviceMetrics.has(service)) {
      this.serviceMetrics.set(service, []);
    }

    const serviceMetrics = this.serviceMetrics.get(service)!;
    serviceMetrics.push(metrics);

    // 최대 1000개 메트릭만 유지
    if (serviceMetrics.length > 1000) {
      serviceMetrics.shift();
    }
  }

  /**
   * 스케일링 제약사항 설정
   */
  setConstraints(service: string, constraints: ScalingConstraints): void {
    this.config.constraints.set(service, constraints);
    logger.info(`Scaling constraints set for service: ${service}`, constraints);
  }

  /**
   * 스케일링 이력 조회
   */
  getScalingHistory(service?: string, limit: number = 50): ScalingEvent[] {
    let history = this.scalingHistory;
    
    if (service) {
      history = history.filter(event => event.service === service);
    }

    return history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 스케일링 성능 분석
   */
  analyzeScalingPerformance(): {
    totalScalingEvents: number;
    successRate: number;
    avgScalingDuration: number;
    costSavings: number;
    performanceImprovement: number;
    topScaledServices: Array<{ service: string; events: number }>;
  } {
    const events = this.scalingHistory;
    const successfulEvents = events.filter(e => e.result === 'success');
    
    const successRate = events.length > 0 ? successfulEvents.length / events.length : 0;
    const avgDuration = events.length > 0 
      ? events.reduce((sum, e) => sum + e.duration, 0) / events.length 
      : 0;

    const costSavings = events
      .filter(e => e.action.action === 'scale-down')
      .reduce((sum, e) => sum + e.costImpact, 0);

    // 서비스별 이벤트 수 집계
    const serviceEvents = new Map<string, number>();
    events.forEach(event => {
      const count = serviceEvents.get(event.service) || 0;
      serviceEvents.set(event.service, count + 1);
    });

    const topScaledServices = Array.from(serviceEvents.entries())
      .map(([service, events]) => ({ service, events }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 5);

    return {
      totalScalingEvents: events.length,
      successRate,
      avgScalingDuration: avgDuration,
      costSavings,
      performanceImprovement: 0.85, // 모의 값
      topScaledServices
    };
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<AutoScalerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.enabled !== undefined) {
      if (newConfig.enabled && !this.evaluationTimer) {
        this.startEvaluation();
      } else if (!newConfig.enabled && this.evaluationTimer) {
        clearInterval(this.evaluationTimer);
        this.evaluationTimer = null;
      }
    }

    logger.info('Auto-scaler configuration updated', newConfig);
  }

  /**
   * 상태 조회
   */
  getStatus(): {
    enabled: boolean;
    policy: ScalingPolicy;
    totalServices: number;
    activeServices: number;
    lastEvaluation: number;
    nextEvaluation: number;
  } {
    return {
      enabled: this.config.enabled,
      policy: this.config.policy,
      totalServices: this.config.constraints.size,
      activeServices: this.serviceMetrics.size,
      lastEvaluation: Date.now() - this.config.evaluationInterval,
      nextEvaluation: Date.now() + this.config.evaluationInterval
    };
  }

  /**
   * 정리
   */
  destroy(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }
    
    logger.info('Auto-scaler destroyed');
  }
}

// 전역 자동 스케일러 인스턴스
export const autoScaler = new AIAutoScaler({
  enabled: true,
  policy: 'hybrid',
  evaluationInterval: 60 * 1000, // 1분
  dryRun: false,
  costOptimization: true,
  predictiveHorizon: 30
});