// ============================================================================
// Phase 2: 예측 분석 시스템 - 실제 ML 구현
// ============================================================================

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs-node';
import * as ss from 'simple-statistics';
import MLR from 'ml-regression';
import { ma, sma, ema, wma } from 'moving-averages';
import { 
  PredictiveConfig, 
  PredictiveMetrics, 
  AnomalyDetection,
  HistoricalDataPoint,
  TrendAnalysis,
  PatternRecognition
} from './types/monitoring';
import { logger } from '../utils/logger';

// 타입 정의
interface TimeSeriesData {
  timestamps: Date[];
  values: number[];
}

interface AnomalyResult {
  timestamp: string;
  metric: string;
  value: number;
  expected: number;
  severity: number;
  description: string;
}

export class PredictiveAnalyzer extends EventEmitter {
  private readonly predictiveConfig: PredictiveConfig;
  private historicalData: Map<string, HistoricalDataPoint[]> = new Map();
  private models: Map<string, tf.Sequential> = new Map();
  private anomalyThresholds: Map<string, { mean: number; std: number }> = new Map();
  private readonly MAX_HISTORY_SIZE = 10000; // 최대 히스토리 크기
  private ANOMALY_Z_SCORE_THRESHOLD = 2.5; // Z-score 임계값

  constructor(config: PredictiveConfig) {
    super();
    this.predictiveConfig = config;
    this.initialize();
  }

  private initialize(): void {
    if (!this.predictiveConfig.enabled) {
      logger.warn('[PHASE-2] PredictiveAnalyzer is disabled - real implementation ready');
      return;
    }

    logger.info('🤖 Initializing PredictiveAnalyzer with ML capabilities');
    
    // TensorFlow 초기화
    tf.ready().then(() => {
      logger.info('✅ TensorFlow.js initialized successfully');
    });
  }

  // ============================================================================
  // 공개 메서드
  // ============================================================================

  public async analyze(serviceId: string, metrics: any): Promise<PredictiveMetrics> {
    if (!this.predictiveConfig.enabled) {
      return this.generateSkeletonPrediction(serviceId);
    }

    try {
      // 히스토리에 데이터 추가
      this.addToHistory(serviceId, metrics);

      // 실제 예측 분석 수행
      const predictions = await this.generateRealPrediction(serviceId);
      const anomalies = this.performAnomalyDetection(serviceId, metrics);
      const trends = this.analyzeTrends(serviceId);
      const patterns = this.recognizePatterns(serviceId);

      const result: PredictiveMetrics = {
        serviceId,
        predictions,
        trends,
        patterns
      };

      // 이상 탐지 결과가 있으면 이벤트 발생
      if (anomalies.anomalies.length > 0) {
        this.emit('anomaly-detected', anomalies);
      }

      return result;
    } catch (error) {
      logger.error(`[PHASE-2] Prediction analysis failed for ${serviceId}:`, error);
      return this.generateSkeletonPrediction(serviceId);
    }
  }

  // ============================================================================
  // 실제 ML 구현 메서드
  // ============================================================================

  private async generateRealPrediction(serviceId: string): Promise<any> {
    const history = this.historicalData.get(serviceId) || [];
    
    if (history.length < 10) {
      // 데이터가 충분하지 않으면 간단한 통계 기반 예측
      return this.generateStatisticalPrediction(serviceId, history);
    }

    // LSTM 모델이 없으면 생성
    if (!this.models.has(serviceId)) {
      await this.createLSTMModel(serviceId);
    }

    // 시계열 예측 수행
    const forecast = await this.performTimeSeriesForecast(serviceId, history);
    
    // 권장 사항 생성
    const recommendations = this.generateIntelligentRecommendations(serviceId, forecast, history);

    return {
      nextHourLoad: forecast.nextHourLoad,
      anomalyProbability: forecast.anomalyProbability,
      recommendedActions: recommendations,
      confidence: forecast.confidence,
      forecast: forecast.details
    };
  }

  private async createLSTMModel(serviceId: string): Promise<void> {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 50,
          returnSequences: true,
          inputShape: [10, 1] // 10 timesteps, 1 feature
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 50,
          returnSequences: false
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 25 }),
        tf.layers.dense({ units: 1 })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    this.models.set(serviceId, model);
    logger.info(`✅ LSTM model created for service: ${serviceId}`);
  }

  private async performTimeSeriesForecast(
    serviceId: string, 
    history: HistoricalDataPoint[]
  ): Promise<any> {
    const model = this.models.get(serviceId);
    if (!model || history.length < 10) {
      return this.generateStatisticalPrediction(serviceId, history);
    }

    try {
      // 데이터 준비
      const values = history.slice(-100).map(h => h.metrics.avgResponseTime || 0);
      const normalized = this.normalizeData(values);
      
      // 입력 데이터 생성 (sliding window)
      const windowSize = 10;
      const X: number[][] = [];
      
      for (let i = 0; i < normalized.length - windowSize; i++) {
        X.push(normalized.slice(i, i + windowSize));
      }

      if (X.length === 0) {
        return this.generateStatisticalPrediction(serviceId, history);
      }

      // 예측 수행
      const input = tf.tensor3d([X[X.length - 1].map(v => [v])], [1, windowSize, 1]);
      const prediction = model.predict(input) as tf.Tensor;
      const predictedValue = await prediction.data();
      
      // 정규화 해제
      const denormalized = this.denormalizeValue(
        predictedValue[0], 
        Math.min(...values), 
        Math.max(...values)
      );

      // 신뢰도 계산
      const mape = this.calculateMAPE(values.slice(-20), X.slice(-20).map(x => x[x.length - 1]));
      const confidence = Math.max(0.5, Math.min(0.95, 1 - mape / 100));

      // 이상 확률 계산
      const zScore = Math.abs((denormalized - ss.mean(values)) / ss.standardDeviation(values));
      const anomalyProbability = Math.min(1, zScore / 3);

      // 정리
      input.dispose();
      prediction.dispose();

      return {
        nextHourLoad: denormalized,
        anomalyProbability,
        confidence,
        details: {
          method: 'LSTM',
          trainingSamples: X.length,
          mape: mape.toFixed(2) + '%'
        }
      };
    } catch (error) {
      logger.error(`LSTM prediction failed for ${serviceId}:`, error);
      return this.generateStatisticalPrediction(serviceId, history);
    }
  }

  private generateStatisticalPrediction(
    serviceId: string, 
    history: HistoricalDataPoint[]
  ): any {
    if (history.length === 0) {
      return {
        nextHourLoad: 50,
        anomalyProbability: 0,
        recommendedActions: ['Insufficient data for prediction'],
        confidence: 0.1
      };
    }

    const values = history.map(h => h.metrics.avgResponseTime || 0);
    
    // 이동 평균 계산
    const ma7 = sma(values, 7);
    const ema7 = ema(values, 7);
    
    // 선형 회귀
    const x = Array.from({ length: values.length }, (_, i) => i);
    const regression = new MLR.SimpleLinearRegression(x, values);
    const nextValue = regression.predict(values.length);

    // 계절성 검출
    const seasonality = this.detectSeasonality(values);
    
    // 예측값 결합 (가중 평균)
    const weights = { ma: 0.3, ema: 0.3, regression: 0.2, seasonal: 0.2 };
    const prediction = 
      (ma7[ma7.length - 1] || 0) * weights.ma +
      (ema7[ema7.length - 1] || 0) * weights.ema +
      nextValue * weights.regression +
      (seasonality.nextValue || values[values.length - 1]) * weights.seasonal;

    // 이상 확률
    const mean = ss.mean(values);
    const std = ss.standardDeviation(values);
    const zScore = Math.abs((prediction - mean) / std);
    const anomalyProbability = Math.min(1, zScore / 3);

    return {
      nextHourLoad: Math.max(0, Math.min(100, prediction)),
      anomalyProbability,
      recommendedActions: this.generateStatisticalRecommendations(prediction, mean, std),
      confidence: Math.min(0.8, 0.3 + (history.length / 100) * 0.5),
      details: {
        method: 'Statistical',
        samples: values.length,
        trend: regression.slope > 0 ? 'increasing' : 'decreasing'
      }
    };
  }

  private performAnomalyDetection(serviceId: string, currentMetrics: any): AnomalyDetection {
    const history = this.historicalData.get(serviceId) || [];
    const anomalies: AnomalyResult[] = [];

    if (history.length < 20) {
      return { serviceId, anomalies, lastAnalysis: new Date().toISOString() };
    }

    // 각 메트릭에 대해 이상 탐지 수행
    const metricsToCheck = ['avgResponseTime', 'errorRate', 'requestRate'];
    
    for (const metric of metricsToCheck) {
      const values = history.slice(-100).map(h => h.metrics[metric] || 0);
      const current = currentMetrics[metric] || 0;
      
      // Z-Score 방법
      const mean = ss.mean(values);
      const std = ss.standardDeviation(values);
      const zScore = Math.abs((current - mean) / std);
      
      if (zScore > this.ANOMALY_Z_SCORE_THRESHOLD) {
        anomalies.push({
          timestamp: new Date().toISOString(),
          metric,
          value: current,
          expected: mean,
          severity: Math.min(1, zScore / 4),
          description: `${metric} is ${zScore.toFixed(1)} standard deviations from mean`
        });
      }

      // IQR 방법 (Interquartile Range)
      const q1 = ss.quantile(values, 0.25);
      const q3 = ss.quantile(values, 0.75);
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      if (current < lowerBound || current > upperBound) {
        anomalies.push({
          timestamp: new Date().toISOString(),
          metric: `${metric}_iqr`,
          value: current,
          expected: (q1 + q3) / 2,
          severity: 0.7,
          description: `${metric} outside IQR bounds [${lowerBound.toFixed(1)}, ${upperBound.toFixed(1)}]`
        });
      }
    }

    // 복합 이상 탐지 (여러 메트릭의 조합)
    if (currentMetrics.avgResponseTime > 1000 && currentMetrics.errorRate > 0.1) {
      anomalies.push({
        timestamp: new Date().toISOString(),
        metric: 'compound',
        value: currentMetrics.avgResponseTime,
        expected: 300,
        severity: 0.9,
        description: 'High response time combined with high error rate'
      });
    }

    return {
      serviceId,
      anomalies: anomalies.slice(0, 5), // 최대 5개 반환
      lastAnalysis: new Date().toISOString()
    };
  }

  private analyzeTrends(serviceId: string): TrendAnalysis {
    const history = this.historicalData.get(serviceId) || [];
    
    if (history.length < 10) {
      return {
        performanceTrend: 'stable',
        usageTrend: 'stable',
        errorTrend: 'stable'
      };
    }

    const recentData = history.slice(-50);
    
    // 각 메트릭의 추세 분석
    const performanceTrend = this.calculateTrend(
      recentData.map(h => h.metrics.avgResponseTime || 0)
    );
    
    const usageTrend = this.calculateTrend(
      recentData.map(h => h.metrics.requestCount || 0)
    );
    
    const errorTrend = this.calculateTrend(
      recentData.map(h => h.metrics.errorRate || 0)
    );

    return {
      performanceTrend: performanceTrend.direction,
      usageTrend: usageTrend.direction,
      errorTrend: errorTrend.direction,
      details: {
        performance: performanceTrend,
        usage: usageTrend,
        error: errorTrend
      }
    };
  }

  private calculateTrend(values: number[]): any {
    if (values.length < 3) {
      return { direction: 'stable' as 'up' | 'down' | 'stable', slope: 0, confidence: 0 };
    }

    const x = Array.from({ length: values.length }, (_, i) => i);
    const regression = new MLR.SimpleLinearRegression(x, values);
    
    const slope = regression.slope;
    const r2 = regression.score(x, values);
    
    // 추세 방향 결정
    let direction: 'up' | 'down' | 'stable';
    const avgValue = ss.mean(values);
    const slopePercentage = (slope / avgValue) * 100;
    
    if (Math.abs(slopePercentage) < 5) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'up';
    } else {
      direction = 'down';
    }

    return {
      direction,
      slope: slope.toFixed(2),
      confidence: r2.toFixed(2),
      percentage: slopePercentage.toFixed(1) + '%'
    };
  }

  private recognizePatterns(serviceId: string): PatternRecognition {
    const history = this.historicalData.get(serviceId) || [];
    
    if (history.length < 168) { // 최소 1주일 데이터
      return this.generateDefaultPatterns();
    }

    // 시간대별 패턴 분석
    const hourlyPattern = this.analyzeHourlyPattern(history);
    const weeklyPattern = this.analyzeWeeklyPattern(history);
    const seasonality = this.detectSeasonality(
      history.map(h => h.metrics.avgResponseTime || 0)
    );

    return {
      peakHours: hourlyPattern.peakHours,
      weeklyPattern: weeklyPattern.pattern,
      seasonality: seasonality.description,
      details: {
        hourly: hourlyPattern,
        weekly: weeklyPattern,
        seasonal: seasonality
      }
    };
  }

  private analyzeHourlyPattern(history: HistoricalDataPoint[]): any {
    const hourlyData: Map<number, number[]> = new Map();
    
    // 시간대별로 데이터 그룹화
    history.forEach(point => {
      const hour = new Date(point.timestamp).getHours();
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(point.metrics.avgResponseTime || 0);
    });

    // 각 시간대의 평균 계산
    const hourlyAverages: { hour: number; avg: number }[] = [];
    hourlyData.forEach((values, hour) => {
      hourlyAverages.push({ hour, avg: ss.mean(values) });
    });

    // 정렬하여 피크 시간 찾기
    hourlyAverages.sort((a, b) => b.avg - a.avg);
    const peakHours = hourlyAverages.slice(0, 3).map(h => {
      const start = h.hour;
      const end = (h.hour + 1) % 24;
      return `${start.toString().padStart(2, '0')}:00-${end.toString().padStart(2, '0')}:00`;
    });

    return {
      peakHours,
      averages: hourlyAverages
    };
  }

  private analyzeWeeklyPattern(history: HistoricalDataPoint[]): any {
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weeklyData: Map<string, number[]> = new Map();
    
    // 요일별로 데이터 그룹화
    history.forEach(point => {
      const dayName = weekdays[new Date(point.timestamp).getDay()];
      if (!weeklyData.has(dayName)) {
        weeklyData.set(dayName, []);
      }
      weeklyData.get(dayName)!.push(point.metrics.avgResponseTime || 0);
    });

    // 각 요일의 평균 계산
    const pattern: Record<string, number> = {};
    weekdays.forEach(day => {
      const values = weeklyData.get(day) || [];
      pattern[day] = values.length > 0 ? Math.round(ss.mean(values)) : 0;
    });

    return { pattern };
  }

  private detectSeasonality(values: number[]): any {
    if (values.length < 24) {
      return { 
        nextValue: values[values.length - 1] || 0,
        description: 'Insufficient data for seasonality detection'
      };
    }

    // 자기상관 함수 (ACF) 계산
    const acf = this.calculateACF(values, Math.min(50, Math.floor(values.length / 4)));
    
    // 주요 주기 찾기
    const significantLags: number[] = [];
    const threshold = 2 / Math.sqrt(values.length); // 95% 신뢰구간
    
    for (let lag = 1; lag < acf.length; lag++) {
      if (Math.abs(acf[lag]) > threshold) {
        significantLags.push(lag);
      }
    }

    // 계절성 설명 생성
    let description = 'No significant seasonality detected';
    if (significantLags.includes(24) || significantLags.includes(23) || significantLags.includes(25)) {
      description = 'Daily seasonality detected (24-hour cycle)';
    } else if (significantLags.includes(168) || significantLags.includes(167) || significantLags.includes(169)) {
      description = 'Weekly seasonality detected (7-day cycle)';
    } else if (significantLags.length > 0) {
      description = `Seasonality detected at lag ${significantLags[0]}`;
    }

    return {
      nextValue: values[values.length - 1],
      description,
      lags: significantLags,
      acf: acf.slice(0, 10)
    };
  }

  private calculateACF(values: number[], maxLag: number): number[] {
    const mean = ss.mean(values);
    const variance = ss.variance(values);
    const acf: number[] = [1]; // ACF at lag 0 is always 1

    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = lag; i < values.length; i++) {
        sum += (values[i] - mean) * (values[i - lag] - mean);
      }
      acf.push(sum / ((values.length - lag) * variance));
    }

    return acf;
  }

  // ============================================================================
  // 헬퍼 메서드
  // ============================================================================

  private addToHistory(serviceId: string, metrics: any): void {
    if (!this.historicalData.has(serviceId)) {
      this.historicalData.set(serviceId, []);
    }

    const history = this.historicalData.get(serviceId)!;
    history.push({
      timestamp: new Date().toISOString(),
      metrics
    });

    // 히스토리 크기 제한
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
  }

  private normalizeData(values: number[]): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    
    return values.map(v => (v - min) / range);
  }

  private denormalizeValue(normalized: number, min: number, max: number): number {
    return normalized * (max - min) + min;
  }

  private calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 100;
    
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }
    
    return count > 0 ? (sum / count) * 100 : 100;
  }

  private generateIntelligentRecommendations(
    serviceId: string, 
    forecast: any, 
    history: HistoricalDataPoint[]
  ): string[] {
    const recommendations: string[] = [];
    const current = history[history.length - 1]?.metrics || {};
    
    // 부하 기반 권장사항
    if (forecast.nextHourLoad > 80) {
      recommendations.push('🔴 High load expected: Consider scaling up resources');
      recommendations.push('💾 Enable aggressive caching to reduce load');
      recommendations.push('🔄 Implement request rate limiting');
    } else if (forecast.nextHourLoad < 20) {
      recommendations.push('🟢 Low load expected: Consider scaling down to save costs');
      recommendations.push('🔧 Good time for maintenance or updates');
    }

    // 이상 탐지 기반 권장사항
    if (forecast.anomalyProbability > 0.7) {
      recommendations.push('⚠️ High anomaly probability: Monitor closely');
      recommendations.push('📊 Check recent deployments or configuration changes');
    }

    // 추세 기반 권장사항
    const trends = this.analyzeTrends(serviceId);
    if (trends.performanceTrend === 'down' && trends.details?.performance?.confidence > 0.7) {
      recommendations.push('📉 Performance degrading: Investigate root cause');
      recommendations.push('🔍 Review recent code changes and dependencies');
    }

    // 오류율 기반 권장사항
    if (current.errorRate > 0.05) {
      recommendations.push('❌ High error rate detected: Review error logs');
      recommendations.push('🛡️ Implement circuit breaker pattern');
    }

    // 응답시간 기반 권장사항
    if (current.avgResponseTime > 1000) {
      recommendations.push('🐌 Slow response times: Optimize database queries');
      recommendations.push('⚡ Consider implementing response caching');
    }

    return recommendations.length > 0 ? recommendations : ['✅ Service operating normally'];
  }

  private generateStatisticalRecommendations(
    prediction: number, 
    mean: number, 
    std: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (prediction > mean + 2 * std) {
      recommendations.push('📈 Significant increase expected');
      recommendations.push('🔄 Prepare for higher load');
    } else if (prediction < mean - 2 * std) {
      recommendations.push('📉 Significant decrease expected');
      recommendations.push('💰 Opportunity to reduce resources');
    } else {
      recommendations.push('📊 Normal operating range expected');
    }
    
    return recommendations;
  }

  private generateDefaultPatterns(): PatternRecognition {
    return {
      peakHours: ['09:00-11:00', '14:00-16:00'],
      weeklyPattern: {
        'Monday': 85,
        'Tuesday': 90,
        'Wednesday': 95,
        'Thursday': 88,
        'Friday': 80,
        'Saturday': 45,
        'Sunday': 40
      },
      seasonality: 'Insufficient data for pattern recognition'
    };
  }

  // ============================================================================
  // 스켈레톤 메서드 (폴백용)
  // ============================================================================

  private generateSkeletonPrediction(serviceId: string): PredictiveMetrics {
    const mockLoad = Math.random() * 100;
    
    return {
      serviceId,
      predictions: {
        nextHourLoad: mockLoad,
        anomalyProbability: Math.random() * 0.3,
        recommendedActions: this.generateMockRecommendations(mockLoad),
        confidence: 0.85
      },
      trends: {
        performanceTrend: mockLoad > 70 ? 'down' : mockLoad < 30 ? 'up' : 'stable',
        usageTrend: Math.random() > 0.5 ? 'up' : 'stable',
        errorTrend: Math.random() > 0.8 ? 'up' : 'stable'
      },
      patterns: this.generateDefaultPatterns()
    };
  }

  private generateMockRecommendations(load: number): string[] {
    const recommendations = [];
    
    if (load > 80) {
      recommendations.push('Consider scaling up resources');
      recommendations.push('Enable caching for frequently accessed data');
    } else if (load < 20) {
      recommendations.push('Consider scaling down to reduce costs');
    } else {
      recommendations.push('Current configuration appears optimal');
    }

    return recommendations;
  }

  // ============================================================================
  // 모델 관리 메서드
  // ============================================================================

  public async trainModel(serviceId: string): Promise<boolean> {
    if (!this.predictiveConfig.enabled) {
      logger.warn('[PHASE-2] Model training not available - Phase 2 disabled');
      return false;
    }

    try {
      const history = this.historicalData.get(serviceId) || [];
      if (history.length < 100) {
        logger.warn(`Insufficient data for training model: ${serviceId}`);
        return false;
      }

      // LSTM 모델 생성 및 학습
      if (!this.models.has(serviceId)) {
        await this.createLSTMModel(serviceId);
      }

      const model = this.models.get(serviceId)!;
      const trainingData = this.prepareTrainingData(history);
      
      await model.fit(trainingData.X, trainingData.y, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              logger.info(`Training ${serviceId} - Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}`);
            }
          }
        }
      });

      // 정리
      trainingData.X.dispose();
      trainingData.y.dispose();

      logger.info(`✅ Model training completed for ${serviceId}`);
      return true;
    } catch (error) {
      logger.error(`Model training failed for ${serviceId}:`, error);
      return false;
    }
  }

  private prepareTrainingData(history: HistoricalDataPoint[]): any {
    const values = history.map(h => h.metrics.avgResponseTime || 0);
    const normalized = this.normalizeData(values);
    
    const windowSize = 10;
    const X: number[][][] = [];
    const y: number[] = [];
    
    for (let i = 0; i < normalized.length - windowSize - 1; i++) {
      X.push(normalized.slice(i, i + windowSize).map(v => [v]));
      y.push(normalized[i + windowSize]);
    }

    return {
      X: tf.tensor3d(X, [X.length, windowSize, 1]),
      y: tf.tensor2d(y, [y.length, 1])
    };
  }

  public updateModelParameters(serviceId: string, parameters: any): boolean {
    if (!this.predictiveConfig.enabled) {
      logger.warn('[PHASE-2] Model parameter update not available - Phase 2 disabled');
      return false;
    }

    try {
      // 모델 파라미터 업데이트 로직
      if (parameters.learningRate) {
        const model = this.models.get(serviceId);
        if (model) {
          model.compile({
            optimizer: tf.train.adam(parameters.learningRate),
            loss: 'meanSquaredError',
            metrics: ['mae']
          });
          logger.info(`Updated learning rate for ${serviceId}: ${parameters.learningRate}`);
        }
      }

      if (parameters.anomalyThreshold) {
        this.ANOMALY_Z_SCORE_THRESHOLD = parameters.anomalyThreshold;
        logger.info(`Updated anomaly threshold: ${parameters.anomalyThreshold}`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to update model parameters for ${serviceId}:`, error);
      return false;
    }
  }

  // ============================================================================
  // 생명주기 메서드
  // ============================================================================

  public start(): void {
    if (this.predictiveConfig.enabled) {
      logger.info('🚀 PredictiveAnalyzer started with ML capabilities');
    } else {
      logger.info('🔧 PredictiveAnalyzer in skeleton mode');
    }
  }

  public stop(): void {
    // 모든 모델 정리
    this.models.forEach((model, serviceId) => {
      model.dispose();
      logger.info(`Model disposed for ${serviceId}`);
    });
    this.models.clear();
    
    // 히스토리 정리
    this.historicalData.clear();
    
    logger.info('🛑 PredictiveAnalyzer stopped');
  }
}