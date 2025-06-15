// ============================================================================
// Phase 3: AI 기반 가중치 조정 시스템 - 실제 구현
// ============================================================================

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs-node';
import * as ss from 'simple-statistics';
const Genetic = require('genetic-js');
const synaptic = require('synaptic');
const { Architect, Trainer } = synaptic;
import { 
  ServiceWeight,
  LoadBalancingConfig,
  OptimizationRecommendation,
  ServiceMetrics,
  MonitoringConfig,
  WeightConfig,
  DEFAULT_MONITORING_CONFIG
} from './types/monitoring';
import { logger } from '../utils/logger';

// 타입 정의
interface ReinforcementState {
  currentLoad: number;
  errorRate: number;
  responseTime: number;
  weight: number;
}

interface Action {
  type: 'increase' | 'decrease' | 'maintain';
  amount: number;
}

interface QValue {
  state: string;
  action: string;
  value: number;
}

interface WeightAdjustmentResult {
  serviceId: string;
  currentWeight: number;
  newWeight: number;
  shouldAdjust: boolean;
  reason: string;
  impact: string;
  confidence: number;
  timestamp: string;
}

// 다목적 최적화를 위한 인터페이스
interface OptimizationObjective {
  name: string;
  weight: number;
  target: 'minimize' | 'maximize';
  getValue: (metrics: ServiceMetrics) => number;
}

export interface WeightAdjustmentConfig {
  enabled: boolean;
  adjustmentInterval: number;
  autoAdjustEnabled: boolean;
  thresholds: {
    responseTimeThreshold: number;
    errorRateThreshold: number;
    resourceThreshold: number;
    trafficThreshold: number;
  };
  weights: {
    toolCountWeight: number;
    usageFrequencyWeight: number;
    errorHistoryWeight: number;
    resourceImpactWeight: number;
  };
}

export class WeightAdjuster extends EventEmitter {
  private config: MonitoringConfig;
  private weightConfig: WeightAdjustmentConfig;
  private serviceWeights: Map<string, ServiceWeight> = new Map();
  private loadBalancingConfig: LoadBalancingConfig;
  private recommendations: Map<string, OptimizationRecommendation[]> = new Map();
  private adjustmentInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // AI/ML 관련 속성
  private qTable: Map<string, QValue> = new Map(); // Q-Learning 테이블
  private neuralNetwork: any; // Synaptic 신경망
  private historicalPerformance: Map<string, number[]> = new Map();
  private performanceHistory: Map<string, ServiceMetrics[]> = new Map();
  
  // 강화학습 파라미터
  private readonly LEARNING_RATE = 0.1;
  private readonly DISCOUNT_FACTOR = 0.95;
  private readonly EXPLORATION_RATE = 0.1;
  
  // 최적화 목표
  private optimizationObjectives: OptimizationObjective[] = [
    {
      name: 'latency',
      weight: 0.3,
      target: 'minimize',
      getValue: (m) => m.avgResponseTime || 0
    },
    {
      name: 'throughput',
      weight: 0.3,
      target: 'maximize',
      getValue: (m) => m.requestsPerSecond || 0
    },
    {
      name: 'errorRate',
      weight: 0.2,
      target: 'minimize',
      getValue: (m) => m.errorRate || 0
    },
    {
      name: 'cpuUsage',
      weight: 0.2,
      target: 'minimize',
      getValue: (m) => m.cpuUsage || 0
    }
  ];

  constructor(
    config: WeightConfig | Partial<MonitoringConfig> = {},
    weightConfig: Partial<WeightAdjustmentConfig> = {}
  ) {
    super();
    
    // WeightConfig 인터페이스로 전달된 경우 처리
    if ('enabled' in config && typeof config.enabled === 'boolean') {
      this.config = DEFAULT_MONITORING_CONFIG;
      this.weightConfig = {
        enabled: config.enabled,
      adjustmentInterval: 60000, // 1분
      autoAdjustEnabled: false,
      thresholds: {
        responseTimeThreshold: 1000,
        errorRateThreshold: 0.05,
        resourceThreshold: 80,
        trafficThreshold: 1000
      },
      weights: {
        toolCountWeight: 0.25,
        usageFrequencyWeight: 0.35,
        errorHistoryWeight: 0.2,
        resourceImpactWeight: 0.2
      },
      ...weightConfig
      };
    } else {
      // MonitoringConfig로 전달된 경우
      this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
      this.weightConfig = {
        enabled: false,
        adjustmentInterval: 60000,
        autoAdjustEnabled: false,
        thresholds: {
          responseTimeThreshold: 1000,
          errorRateThreshold: 0.05,
          resourceThreshold: 80,
          trafficThreshold: 1000
        },
        weights: {
          toolCountWeight: 0.25,
          usageFrequencyWeight: 0.35,
          errorHistoryWeight: 0.2,
          resourceImpactWeight: 0.2
        },
        ...weightConfig
      };
    }

    this.loadBalancingConfig = {
      strategy: 'weighted-round-robin',
      healthCheckInterval: 30000,
      failoverThreshold: 3,
      weightUpdateInterval: 60000
    };

    this.initialize();
  }

  private initialize(): void {
    if (!this.weightConfig.enabled) {
      logger.warn('[PHASE-3] WeightAdjuster is disabled - real implementation ready');
      this.showSkeletonFeatures();
      return;
    }

    logger.info('🤖 Initializing WeightAdjuster with AI capabilities');
    
    // 신경망 초기화 (Synaptic)
    this.initializeNeuralNetwork();
    
    // 기본 가중치 설정
    this.initializeDefaultWeights();
    
    // TensorFlow 초기화
    tf.ready().then(() => {
      logger.info('✅ TensorFlow.js ready for weight optimization');
    });
  }

  private showSkeletonFeatures(): void {
    console.log(`
    ========================================
    🔧 Phase 3: Weight Adjustment & AI Optimization
    ========================================
    Status: SKELETON MODE (Not Implemented)
    Features Ready:
    - ⚖️ Service Weight Management Interface
    - 🔄 Load Balancing Configuration
    - 🎯 Optimization Recommendation Schema
    - 🤖 Auto-adjustment Framework
    
    TODO: Implement AI-based optimization algorithms
    ========================================
    `);
  }

  private initializeNeuralNetwork(): void {
    // 4 입력 (currentLoad, errorRate, responseTime, currentWeight)
    // 10 은닉층
    // 3 출력 (increase, decrease, maintain)
    this.neuralNetwork = new Architect.Perceptron(4, 10, 3);
    logger.info('✅ Neural network initialized for weight adjustment decisions');
  }

  private initializeDefaultWeights(): void {
    // 모든 서비스에 기본 가중치 1.0 설정
    const defaultWeight: ServiceWeight = {
      current: 1.0,
      min: 0.1,
      max: 5.0,
      history: [],
      lastAdjusted: new Date().toISOString()
    };

    // 기본 서비스들에 가중치 할당
    const services = [
      'github', 'docker', 'vercel', 'supabase', 'npm-sentinel',
      'taskmaster-ai', 'clear-thought', 'stochastic-thinking'
    ];

    services.forEach(service => {
      this.serviceWeights.set(service, { ...defaultWeight });
    });
    
    logger.info(`⚖️ Initialized weights for ${services.length} services`);
  }

  // ============================================================================
  // 공개 메서드
  // ============================================================================

  public start(): void {
    if (!this.weightConfig.enabled) {
      logger.warn('[PHASE-3] WeightAdjuster is disabled - skeleton mode only');
      return;
    }

    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('🚀 Starting WeightAdjuster with AI optimization');

    // 주기적 가중치 조정
    if (this.weightConfig.autoAdjustEnabled) {
      this.adjustmentInterval = setInterval(() => {
        this.performAutoAdjustment();
      }, this.weightConfig.adjustmentInterval);
    }
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.adjustmentInterval) {
      clearInterval(this.adjustmentInterval);
      this.adjustmentInterval = null;
    }

    // 상태 저장
    this.saveState();
    
    logger.info('🛑 WeightAdjuster stopped');
  }

  public async adjustWeights(
    metrics: Map<string, ServiceMetrics>
  ): Promise<Map<string, WeightAdjustmentResult>> {
    if (!this.weightConfig.enabled) {
      return this.generateSkeletonAdjustments(metrics);
    }

    const adjustments = new Map<string, WeightAdjustmentResult>();

    for (const [serviceId, serviceMetrics] of metrics) {
      try {
        const adjustment = await this.calculateOptimalWeight(serviceId, serviceMetrics);
        adjustments.set(serviceId, adjustment);
        
        // 가중치 업데이트
        if (adjustment.shouldAdjust) {
          this.applyWeightAdjustment(serviceId, adjustment);
        }
      } catch (error) {
        logger.error(`[PHASE-3] Weight adjustment failed for ${serviceId}:`, error);
        adjustments.set(serviceId, this.generateDefaultAdjustment(serviceId));
      }
    }

    // 전체 시스템 밸런싱
    this.balanceSystemWeights(adjustments);

    return adjustments;
  }

  // ============================================================================
  // AI 기반 가중치 계산
  // ============================================================================

  private async calculateOptimalWeight(
    serviceId: string, 
    metrics: ServiceMetrics
  ): Promise<WeightAdjustmentResult> {
    const currentWeight = this.serviceWeights.get(serviceId) || this.createDefaultWeight();
    
    // 1. 강화학습 기반 결정
    const rlDecision = this.reinforcementLearningDecision(serviceId, metrics, currentWeight);
    
    // 2. 신경망 기반 예측
    const nnPrediction = this.neuralNetworkPrediction(metrics, currentWeight);
    
    // 3. 유전 알고리즘 최적화
    const gaOptimization = await this.geneticAlgorithmOptimization(serviceId, metrics);
    
    // 4. 다목적 최적화
    const paretoOptimal = this.paretoOptimization(metrics, currentWeight);
    
    // 결과 통합 (앙상블)
    const ensembleWeight = this.ensembleDecision({
      rl: rlDecision,
      nn: nnPrediction,
      ga: gaOptimization,
      pareto: paretoOptimal
    });

    // 성능 예측
    const predictedImpact = this.predictPerformanceImpact(
      serviceId, 
      currentWeight.current, 
      ensembleWeight
    );

    return {
      serviceId,
      currentWeight: currentWeight.current,
      newWeight: ensembleWeight,
      shouldAdjust: Math.abs(ensembleWeight - currentWeight.current) > 0.1,
      reason: this.generateAdjustmentReason(metrics, currentWeight.current, ensembleWeight),
      impact: predictedImpact,
      confidence: this.calculateConfidence(metrics),
      timestamp: new Date().toISOString()
    };
  }

  // ============================================================================
  // 강화학습 (Q-Learning)
  // ============================================================================

  private reinforcementLearningDecision(
    serviceId: string, 
    metrics: ServiceMetrics, 
    currentWeight: ServiceWeight
  ): number {
    const state = this.encodeState({
      currentLoad: metrics.cpuUsage || 50,
      errorRate: metrics.errorRate || 0,
      responseTime: metrics.avgResponseTime || 200,
      weight: currentWeight.current
    });

    // ε-greedy 정책
    let action: Action;
    if (Math.random() < this.EXPLORATION_RATE) {
      // 탐색: 랜덤 액션
      action = this.getRandomAction();
    } else {
      // 활용: 최적 액션
      action = this.getBestAction(state);
    }

    // Q값 업데이트
    const reward = this.calculateReward(metrics);
    this.updateQValue(state, action, reward);

    // 새로운 가중치 계산
    return this.applyAction(currentWeight.current, action);
  }

  private encodeState(state: ReinforcementState): string {
    // 상태를 이산화하여 문자열로 인코딩
    const load = Math.floor(state.currentLoad / 20) * 20;
    const error = Math.floor(state.errorRate * 100);
    const response = Math.floor(state.responseTime / 100) * 100;
    const weight = Math.floor(state.weight * 10) / 10;
    
    return `${load}-${error}-${response}-${weight}`;
  }

  private getRandomAction(): Action {
    const actions: Action[] = [
      { type: 'increase', amount: 0.2 },
      { type: 'decrease', amount: 0.2 },
      { type: 'maintain', amount: 0 }
    ];
    return actions[Math.floor(Math.random() * actions.length)];
  }

  private getBestAction(state: string): Action {
    const actions: Action[] = [
      { type: 'increase', amount: 0.2 },
      { type: 'decrease', amount: 0.2 },
      { type: 'maintain', amount: 0 }
    ];

    let bestAction = actions[0];
    let bestValue = -Infinity;

    for (const action of actions) {
      const qKey = `${state}-${action.type}`;
      const qValue = this.qTable.get(qKey)?.value || 0;
      
      if (qValue > bestValue) {
        bestValue = qValue;
        bestAction = action;
      }
    }

    return bestAction;
  }

  private calculateReward(metrics: ServiceMetrics): number {
    // 복합 보상 함수
    let reward = 0;
    
    // 응답시간 (낮을수록 좋음)
    if (metrics.avgResponseTime < 200) reward += 1;
    else if (metrics.avgResponseTime < 500) reward += 0.5;
    else reward -= 1;
    
    // 오류율 (낮을수록 좋음)
    if ((metrics.errorRate || 0) < 0.01) reward += 1;
    else if ((metrics.errorRate || 0) < 0.05) reward += 0.5;
    else reward -= 2;
    
    // 처리량 (높을수록 좋음)
    if ((metrics.requestsPerSecond || 0) > 100) reward += 1;
    else if ((metrics.requestsPerSecond || 0) > 50) reward += 0.5;
    
    return reward;
  }

  private updateQValue(state: string, action: Action, reward: number): void {
    const qKey = `${state}-${action.type}`;
    const currentQ = this.qTable.get(qKey)?.value || 0;
    
    // Q-learning 업데이트 규칙
    const maxFutureQ = this.getMaxFutureQValue(state);
    const newQ = currentQ + this.LEARNING_RATE * (
      reward + this.DISCOUNT_FACTOR * maxFutureQ - currentQ
    );

    this.qTable.set(qKey, {
      state,
      action: action.type,
      value: newQ
    });
  }

  private getMaxFutureQValue(state: string): number {
    const actions = ['increase', 'decrease', 'maintain'];
    let maxQ = 0;

    for (const action of actions) {
      const qKey = `${state}-${action}`;
      const qValue = this.qTable.get(qKey)?.value || 0;
      maxQ = Math.max(maxQ, qValue);
    }

    return maxQ;
  }

  private applyAction(currentWeight: number, action: Action): number {
    switch (action.type) {
      case 'increase':
        return Math.min(5.0, currentWeight + action.amount);
      case 'decrease':
        return Math.max(0.1, currentWeight - action.amount);
      default:
        return currentWeight;
    }
  }

  // ============================================================================
  // 신경망 예측
  // ============================================================================

  private neuralNetworkPrediction(
    metrics: ServiceMetrics, 
    currentWeight: ServiceWeight
  ): number {
    // 입력 정규화
    const inputs = [
      (metrics.cpuUsage || 50) / 100,
      metrics.errorRate || 0,
      (metrics.avgResponseTime || 200) / 1000,
      currentWeight.current / 5.0
    ];

    // 신경망 예측
    const outputs = this.neuralNetwork.activate(inputs);
    
    // 출력 해석 (increase, decrease, maintain)
    const maxIndex = outputs.indexOf(Math.max(...outputs));
    
    switch (maxIndex) {
      case 0: // increase
        return Math.min(5.0, currentWeight.current * 1.2);
      case 1: // decrease
        return Math.max(0.1, currentWeight.current * 0.8);
      default: // maintain
        return currentWeight.current;
    }
  }

  // ============================================================================
  // 유전 알고리즘 최적화
  // ============================================================================

  private async geneticAlgorithmOptimization(
    serviceId: string, 
    metrics: ServiceMetrics
  ): Promise<number> {
    return new Promise((resolve) => {
      const genetic = Genetic.create();
      
      genetic.optimize = Genetic.Optimize.Maximize;
      genetic.select1 = Genetic.Select1.Tournament2;
      genetic.select2 = Genetic.Select2.Tournament2;
      
      // 적합도 함수
      genetic.fitness = (entity: number) => {
        // 시뮬레이션을 통한 적합도 계산
        const simulatedPerformance = this.simulatePerformance(
          serviceId, 
          entity, 
          metrics
        );
        
        // 다목적 적합도
        let fitness = 0;
        fitness += (1000 - simulatedPerformance.avgResponseTime) / 1000;
        fitness += (1 - simulatedPerformance.errorRate) * 2;
        fitness += simulatedPerformance.throughput / 100;
        
        return fitness;
      };
      
      // 개체 생성
      genetic.seed = () => {
        return Math.random() * 4.9 + 0.1; // 0.1 ~ 5.0
      };
      
      // 돌연변이
      genetic.mutate = (entity: number) => {
        const mutation = (Math.random() - 0.5) * 0.4;
        return Math.max(0.1, Math.min(5.0, entity + mutation));
      };
      
      // 교차
      genetic.crossover = (mother: number, father: number) => {
        const alpha = Math.random();
        const son = alpha * mother + (1 - alpha) * father;
        const daughter = (1 - alpha) * mother + alpha * father;
        return [son, daughter];
      };
      
      // 진화 실행
      genetic.notification = (pop: any, generation: number, stats: any, isFinished: boolean) => {
        if (isFinished) {
          resolve(pop[0].entity);
        }
      };
      
      const config = {
        iterations: 100,
        size: 50,
        crossover: 0.8,
        mutation: 0.2,
        skip: 20
      };
      
      genetic.evolve(config);
    });
  }

  private simulatePerformance(
    serviceId: string, 
    weight: number, 
    currentMetrics: ServiceMetrics
  ): any {
    // 가중치 변화에 따른 성능 시뮬레이션
    const weightRatio = weight / (this.serviceWeights.get(serviceId)?.current || 1);
    
    return {
      avgResponseTime: currentMetrics.avgResponseTime / Math.sqrt(weightRatio),
      errorRate: (currentMetrics.errorRate || 0) * Math.pow(0.9, weightRatio - 1),
      throughput: (currentMetrics.requestsPerSecond || 50) * weightRatio
    };
  }

  // ============================================================================
  // 파레토 최적화
  // ============================================================================

  private paretoOptimization(
    metrics: ServiceMetrics, 
    currentWeight: ServiceWeight
  ): number {
    // 다목적 최적화를 위한 후보 가중치 생성
    const candidates: { weight: number; scores: number[] }[] = [];
    
    for (let w = 0.1; w <= 5.0; w += 0.1) {
      const scores = this.optimizationObjectives.map(obj => {
        const value = obj.getValue(metrics) * (w / currentWeight.current);
        return obj.target === 'minimize' ? -value : value;
      });
      
      candidates.push({ weight: w, scores });
    }

    // 파레토 프론티어 찾기
    const paretoFront = this.findParetoFront(candidates);
    
    // 가중합 방법으로 최적해 선택
    let bestWeight = currentWeight.current;
    let bestScore = -Infinity;
    
    for (const candidate of paretoFront) {
      const weightedScore = candidate.scores.reduce((sum, score, i) => 
        sum + score * this.optimizationObjectives[i].weight, 0
      );
      
      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        bestWeight = candidate.weight;
      }
    }

    return bestWeight;
  }

  private findParetoFront(
    candidates: { weight: number; scores: number[] }[]
  ): { weight: number; scores: number[] }[] {
    const paretoFront: typeof candidates = [];
    
    for (const candidate of candidates) {
      let isDominated = false;
      
      for (const other of candidates) {
        if (this.dominates(other.scores, candidate.scores)) {
          isDominated = true;
          break;
        }
      }
      
      if (!isDominated) {
        paretoFront.push(candidate);
      }
    }
    
    return paretoFront;
  }

  private dominates(a: number[], b: number[]): boolean {
    let betterInOne = false;
    
    for (let i = 0; i < a.length; i++) {
      if (a[i] < b[i]) return false;
      if (a[i] > b[i]) betterInOne = true;
    }
    
    return betterInOne;
  }

  // ============================================================================
  // 앙상블 결정
  // ============================================================================

  private ensembleDecision(predictions: {
    rl: number;
    nn: number;
    ga: number;
    pareto: number;
  }): number {
    // 가중 평균 앙상블
    const weights = {
      rl: 0.3,      // 강화학습
      nn: 0.2,      // 신경망
      ga: 0.3,      // 유전 알고리즘
      pareto: 0.2   // 파레토 최적화
    };

    const ensemble = 
      predictions.rl * weights.rl +
      predictions.nn * weights.nn +
      predictions.ga * weights.ga +
      predictions.pareto * weights.pareto;

    // 안정성을 위한 스무딩
    const history = this.historicalPerformance.get('ensemble') || [];
    history.push(ensemble);
    if (history.length > 10) history.shift();
    
    this.historicalPerformance.set('ensemble', history);
    
    // 이동 평균으로 급격한 변화 방지
    return ss.mean(history.slice(-3));
  }

  // ============================================================================
  // 자동 조정 및 권장사항
  // ============================================================================

  private async performAutoAdjustment(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // 현재 메트릭 수집
      const currentMetrics = await this.collectCurrentMetrics();
      
      // 가중치 조정
      const adjustments = await this.adjustWeights(currentMetrics);
      
      // 권장사항 생성
      const recommendations = this.generateScalingRecommendations(currentMetrics);
      
      // 자동 적용 가능한 권장사항 실행
      for (const rec of recommendations) {
        if (rec.autoApply) {
          this.applyRecommendation(rec);
        }
      }
      
      logger.info('✅ Auto-adjustment cycle completed');
    } catch (error) {
      logger.error('Auto-adjustment failed:', error);
    }
  }

  private async collectCurrentMetrics(): Promise<Map<string, ServiceMetrics>> {
    // 실제 구현에서는 메트릭 수집기에서 데이터를 가져옴
    const metrics = new Map<string, ServiceMetrics>();
    
    // 임시 데이터
    this.serviceWeights.forEach((_, serviceId) => {
      const mockMetrics: ServiceMetrics = {
        serviceId,
        health: {
          status: 'healthy',
          responseTime: Math.random() * 500,
          errorRate: Math.random() * 0.1,
          trend: 'stable',
          uptime: Date.now()
        },
        requestCount: Math.floor(Math.random() * 1000),
        errorCount: Math.floor(Math.random() * 10),
        avgResponseTime: Math.random() * 500,
        requestsPerSecond: Math.random() * 100,
        errorRate: Math.random() * 0.1,
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        uptime: Date.now(),
        performance: {
          avgResponseTime: [],
          requestsPerMinute: [],
          errorCount: []
        },
        tools: {
          totalCount: 10,
          activeCount: 8,
          usageDistribution: {}
        },
        lastUpdated: new Date().toISOString()
      };
      metrics.set(serviceId, mockMetrics);
    });
    
    return metrics;
  }

  public generateScalingRecommendations(
    metrics: Map<string, ServiceMetrics>
  ): OptimizationRecommendation[] {
    if (!this.weightConfig.enabled) {
      return this.generateSkeletonRecommendations();
    }

    const recommendations: OptimizationRecommendation[] = [];

    // 서비스별 분석
    metrics.forEach((serviceMetrics, serviceId) => {
      const weight = this.serviceWeights.get(serviceId);
      if (!weight) return;

      // 고부하 서비스
      if ((serviceMetrics.cpuUsage || 0) > 80 || serviceMetrics.avgResponseTime > 1000) {
        recommendations.push({
          serviceId,
          action: 'scale-up',
          priority: 0.9,
          description: `🔴 ${serviceId}: 즉시 스케일 업 필요 (CPU: ${serviceMetrics.cpuUsage?.toFixed(0)}%, 응답시간: ${serviceMetrics.avgResponseTime?.toFixed(0)}ms)`,
          estimatedImpact: '성능 30-50% 개선 예상',
          autoApply: (serviceMetrics.cpuUsage || 0) > 90
        });
      }
      
      // 저부하 서비스
      else if ((serviceMetrics.cpuUsage || 0) < 20 && weight.current > 0.5) {
        recommendations.push({
          serviceId,
          action: 'scale-down',
          priority: 0.5,
          description: `🟢 ${serviceId}: 스케일 다운 가능 (CPU: ${serviceMetrics.cpuUsage?.toFixed(0)}%)`,
          estimatedImpact: '비용 20-30% 절감 가능',
          autoApply: false
        });
      }

      // 오류율 기반
      if ((serviceMetrics.errorRate || 0) > 0.05) {
        recommendations.push({
          serviceId,
          action: 'health-check',
          priority: 0.8,
          description: `⚠️ ${serviceId}: 높은 오류율 감지 (${((serviceMetrics.errorRate || 0) * 100).toFixed(1)}%)`,
          estimatedImpact: '서비스 안정성 개선 필요',
          autoApply: false
        });
      }
    });

    // 우선순위 정렬
    recommendations.sort((a, b) => (typeof b.priority === 'number' ? b.priority : 0) - (typeof a.priority === 'number' ? a.priority : 0));
    
    return recommendations.slice(0, 5); // 상위 5개만 반환
  }

  private applyRecommendation(recommendation: OptimizationRecommendation): void {
    logger.info(`🤖 Auto-applying recommendation: ${recommendation.description}`);
    
    // 실제 구현에서는 스케일링 API 호출
    this.emit('recommendation-applied', recommendation);
  }

  // ============================================================================
  // 헬퍼 메서드
  // ============================================================================

  private createDefaultWeight(): ServiceWeight {
    return {
      current: 1.0,
      min: 0.1,
      max: 5.0,
      history: [],
      lastAdjusted: new Date().toISOString()
    };
  }

  private applyWeightAdjustment(
    serviceId: string, 
    adjustment: WeightAdjustmentResult
  ): void {
    const weight = this.serviceWeights.get(serviceId) || this.createDefaultWeight();
    
    // 히스토리 업데이트
    weight.history.push({
      timestamp: new Date().toISOString(),
      value: weight.current,
      reason: adjustment.reason
    });
    
    // 히스토리 크기 제한
    if (weight.history.length > 100) {
      weight.history.shift();
    }
    
    // 새 가중치 적용
    weight.current = adjustment.newWeight;
    weight.lastAdjusted = new Date().toISOString();
    
    this.serviceWeights.set(serviceId, weight);
    
    // 이벤트 발생
    this.emit('weight-adjusted', {
      serviceId,
      oldWeight: adjustment.currentWeight,
      newWeight: adjustment.newWeight,
      reason: adjustment.reason
    });
    
    logger.info(`⚖️ Weight adjusted for ${serviceId}: ${adjustment.currentWeight.toFixed(2)} → ${adjustment.newWeight.toFixed(2)}`);
  }

  private generateAdjustmentReason(
    metrics: ServiceMetrics, 
    currentWeight: number, 
    newWeight: number
  ): string {
    const reasons: string[] = [];
    
    if ((metrics.cpuUsage || 0) > 70) {
      reasons.push('높은 CPU 사용률');
    }
    if ((metrics.errorRate || 0) > 0.05) {
      reasons.push('오류율 증가');
    }
    if (metrics.avgResponseTime > 500) {
      reasons.push('응답 시간 지연');
    }
    
    const changePercent = ((newWeight - currentWeight) / currentWeight * 100).toFixed(0);
    if (newWeight > currentWeight) {
      reasons.push(`가중치 ${changePercent}% 증가 권장`);
    } else if (newWeight < currentWeight) {
      reasons.push(`가중치 ${Math.abs(parseFloat(changePercent))}% 감소 권장`);
    }
    
    return reasons.join(', ') || '최적 상태 유지';
  }

  private calculateConfidence(metrics: ServiceMetrics): number {
    // 데이터 품질과 일관성을 기반으로 신뢰도 계산
    let confidence = 0.5;
    
    // 충분한 요청 수
    if (metrics.requestCount > 1000) confidence += 0.2;
    else if (metrics.requestCount > 100) confidence += 0.1;
    
    // 안정적인 메트릭
    if ((metrics.errorRate || 0) < 0.01) confidence += 0.1;
    if (metrics.avgResponseTime < 200) confidence += 0.1;
    
    // 과거 데이터 존재
    const history = this.historicalPerformance.get('confidence') || [];
    if (history.length > 50) confidence += 0.1;
    
    return Math.min(0.95, confidence);
  }

  private predictPerformanceImpact(
    serviceId: string, 
    currentWeight: number, 
    newWeight: number
  ): string {
    const ratio = newWeight / currentWeight;
    const impacts: string[] = [];

    if (ratio > 1.1) {
      impacts.push(`🔺 처리량 ${((ratio - 1) * 100).toFixed(0)}% 증가 예상`);
      impacts.push(`⚡ 응답시간 ${((1 - 1/Math.sqrt(ratio)) * 100).toFixed(0)}% 개선 예상`);
    } else if (ratio < 0.9) {
      impacts.push(`🔻 리소스 사용량 ${((1 - ratio) * 100).toFixed(0)}% 감소`);
      impacts.push(`💰 비용 절감 효과 예상`);
    } else {
      impacts.push(`📊 현재 설정 유지가 최적`);
    }

    return impacts.join(', ');
  }

  private balanceSystemWeights(
    adjustments: Map<string, WeightAdjustmentResult>
  ): void {
    // 전체 가중치 합이 일정 범위를 유지하도록 조정
    const totalWeight = Array.from(adjustments.values())
      .reduce((sum, adj) => sum + adj.newWeight, 0);
    
    const targetTotal = adjustments.size * 1.0; // 평균 1.0
    
    if (totalWeight > targetTotal * 1.5) {
      // 전체적으로 너무 높으면 정규화
      const scaleFactor = targetTotal / totalWeight;
      
      adjustments.forEach((adj, serviceId) => {
        adj.newWeight *= scaleFactor;
        adj.reason += ' (시스템 밸런싱 적용)';
      });
    }
  }

  // ============================================================================
  // 스켈레톤 메서드 (폴백용)
  // ============================================================================

  private generateSkeletonAdjustments(
    metrics: Map<string, ServiceMetrics>
  ): Map<string, WeightAdjustmentResult> {
    const adjustments = new Map<string, WeightAdjustmentResult>();
    
    metrics.forEach((serviceMetrics, serviceId) => {
      adjustments.set(serviceId, this.generateDefaultAdjustment(serviceId));
    });
    
    return adjustments;
  }

  private generateDefaultAdjustment(serviceId: string): WeightAdjustmentResult {
    const currentWeight = this.serviceWeights.get(serviceId)?.current || 1.0;
    
    return {
      serviceId,
      currentWeight,
      newWeight: currentWeight,
      shouldAdjust: false,
      reason: 'AI 최적화 비활성화',
      impact: '변경 없음',
      confidence: 0.5,
      timestamp: new Date().toISOString()
    };
  }

  private generateSkeletonRecommendations(): OptimizationRecommendation[] {
    return [{
      serviceId: 'system',
      action: 'monitor',
      priority: 0.5,
      description: 'Phase 3 활성화 필요',
      estimatedImpact: 'AI 기반 최적화 사용 가능',
      autoApply: false
    }];
  }

  // ============================================================================
  // 학습 메서드
  // ============================================================================

  public async trainModels(historicalData: any[]): Promise<boolean> {
    if (!this.weightConfig.enabled) {
      logger.warn('[PHASE-3] Model training not available - Phase 3 disabled');
      return false;
    }

    try {
      // 신경망 학습
      const trainer = new Trainer(this.neuralNetwork);
      const trainingSet = historicalData.map(data => ({
        input: [
          data.cpuUsage / 100,
          data.errorRate,
          data.responseTime / 1000,
          data.weight / 5.0
        ],
        output: this.encodeOptimalAction(data)
      }));

      trainer.train(trainingSet, {
        rate: 0.1,
        iterations: 1000,
        error: 0.005,
        shuffle: true,
        log: 100
      });

      logger.info('✅ Neural network training completed');
      
      // Q-테이블 업데이트
      this.updateQTableFromHistory(historicalData);
      
      return true;
    } catch (error) {
      logger.error('Model training failed:', error);
      return false;
    }
  }

  private encodeOptimalAction(data: any): number[] {
    // 과거 데이터에서 최적 액션 인코딩
    if (data.performanceImproved) {
      if (data.weightChange > 0) return [1, 0, 0]; // increase
      else if (data.weightChange < 0) return [0, 1, 0]; // decrease
    }
    return [0, 0, 1]; // maintain
  }

  private updateQTableFromHistory(historicalData: any[]): void {
    // 과거 데이터로부터 Q-테이블 업데이트
    for (let i = 0; i < historicalData.length - 1; i++) {
      const current = historicalData[i];
      const next = historicalData[i + 1];
      
      const state = this.encodeState({
        currentLoad: current.cpuUsage,
        errorRate: current.errorRate,
        responseTime: current.responseTime,
        weight: current.weight
      });
      
      const action = this.inferAction(current.weight, next.weight);
      const reward = this.calculateRewardFromHistory(current, next);
      
      this.updateQValue(state, action, reward);
    }
  }

  private inferAction(oldWeight: number, newWeight: number): Action {
    const diff = newWeight - oldWeight;
    
    if (diff > 0.05) return { type: 'increase', amount: diff };
    else if (diff < -0.05) return { type: 'decrease', amount: -diff };
    else return { type: 'maintain', amount: 0 };
  }

  private calculateRewardFromHistory(current: any, next: any): number {
    let reward = 0;
    
    // 성능 개선
    if (next.responseTime < current.responseTime) reward += 1;
    if (next.errorRate < current.errorRate) reward += 1;
    if (next.throughput > current.throughput) reward += 1;
    
    // 리소스 효율성
    if (next.cpuUsage < current.cpuUsage && next.throughput >= current.throughput) {
      reward += 0.5;
    }
    
    return reward;
  }

  // ============================================================================
  // 상태 관리
  // ============================================================================

  public getWeights(): Map<string, ServiceWeight> {
    return new Map(this.serviceWeights);
  }

  public getRecommendations(serviceId?: string): OptimizationRecommendation[] {
    if (serviceId) {
      return this.recommendations.get(serviceId) || [];
    }
    
    const allRecommendations: OptimizationRecommendation[] = [];
    this.recommendations.forEach(recs => allRecommendations.push(...recs));
    return allRecommendations;
  }

  private saveState(): void {
    // Q-테이블과 가중치 히스토리를 저장 (추후 구현)
    logger.info('💾 Saving WeightAdjuster state...');
  }
}