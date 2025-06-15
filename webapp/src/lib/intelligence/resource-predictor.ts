/**
 * AI 기반 리소스 예측 시스템
 * Phase 4 - 지능형 최적화
 */

import { logger } from '../utils/logger';

// 리소스 메트릭 타입 정의
export interface ResourceMetric {
  timestamp: number;
  cpu: number;        // CPU 사용률 (0-100)
  memory: number;     // 메모리 사용률 (0-100)
  requests: number;   // 요청 수/분
  latency: number;    // 평균 응답 시간 (ms)
  errors: number;     // 오류 수/분
}

export interface ResourcePrediction {
  service: string;
  predictions: {
    cpu: number[];
    memory: number[];
    requests: number[];
    latency: number[];
  };
  confidence: number;
  horizon: number; // 예측 시간 범위 (분)
  anomalies: AnomalyDetection[];
}

export interface AnomalyDetection {
  type: 'spike' | 'drop' | 'trend' | 'pattern';
  metric: string;
  severity: 'low' | 'medium' | 'high';
  probability: number;
  expectedTime: number; // 예상 발생 시간 (timestamp)
  recommendation: string;
}

// 시계열 분석을 위한 기본 알고리즘
export class TimeSeriesAnalyzer {
  /**
   * 이동 평균 계산
   */
  static movingAverage(data: number[], window: number): number[] {
    const result: number[] = [];
    for (let i = window - 1; i < data.length; i++) {
      const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
    return result;
  }

  /**
   * 지수 평활법 (Exponential Smoothing)
   */
  static exponentialSmoothing(data: number[], alpha: number = 0.3): number[] {
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      const smoothed = alpha * data[i] + (1 - alpha) * result[i - 1];
      result.push(smoothed);
    }
    return result;
  }

  /**
   * 계절성 분해 (단순 버전)
   */
  static decompose(data: number[], period: number = 24): {
    trend: number[];
    seasonal: number[];
    residual: number[];
  } {
    const trend = this.movingAverage(data, period);
    const seasonal: number[] = [];
    const residual: number[] = [];

    // 계절성 패턴 추출
    const seasonalPattern = new Array(period).fill(0);
    const counts = new Array(period).fill(0);

    for (let i = 0; i < data.length; i++) {
      const seasonalIndex = i % period;
      const trendIndex = Math.floor(i / period);
      
      if (trendIndex < trend.length) {
        const detrended = data[i] - trend[trendIndex];
        seasonalPattern[seasonalIndex] += detrended;
        counts[seasonalIndex]++;
      }
    }

    // 평균 계절성 계산
    for (let i = 0; i < period; i++) {
      if (counts[i] > 0) {
        seasonalPattern[i] /= counts[i];
      }
    }

    // 전체 데이터에 계절성 적용
    for (let i = 0; i < data.length; i++) {
      seasonal.push(seasonalPattern[i % period]);
      
      const trendIndex = Math.floor(i / period);
      const trendValue = trendIndex < trend.length ? trend[trendIndex] : trend[trend.length - 1];
      residual.push(data[i] - trendValue - seasonal[i]);
    }

    return { trend, seasonal, residual };
  }

  /**
   * 이상치 탐지
   */
  static detectAnomalies(data: number[], threshold: number = 2): number[] {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    return data.map((value, index) => {
      const zScore = Math.abs(value - mean) / stdDev;
      return zScore > threshold ? index : -1;
    }).filter(index => index !== -1);
  }
}

// AI 기반 리소스 예측기
export class AIResourcePredictor {
  private historicalData: Map<string, ResourceMetric[]> = new Map();
  private models: Map<string, any> = new Map();
  private readonly maxHistorySize = 1000; // 최대 1000개 데이터 포인트 유지

  /**
   * 과거 데이터 추가
   */
  addHistoricalData(service: string, metric: ResourceMetric): void {
    if (!this.historicalData.has(service)) {
      this.historicalData.set(service, []);
    }

    const data = this.historicalData.get(service)!;
    data.push(metric);

    // 데이터 크기 제한
    if (data.length > this.maxHistorySize) {
      data.shift();
    }

    // 데이터가 충분히 쌓이면 모델 재훈련
    if (data.length % 50 === 0) {
      this.trainModel(service);
    }
  }

  /**
   * 예측 모델 훈련
   */
  private trainModel(service: string): void {
    const data = this.historicalData.get(service);
    if (!data || data.length < 50) {
      logger.warn(`Insufficient data for training model: ${service}`);
      return;
    }

    try {
      // 각 메트릭별 시계열 분석
      const cpuData = data.map(d => d.cpu);
      const memoryData = data.map(d => d.memory);
      const requestsData = data.map(d => d.requests);
      const latencyData = data.map(d => d.latency);

      const model = {
        cpu: {
          trend: TimeSeriesAnalyzer.movingAverage(cpuData, 10),
          smoothed: TimeSeriesAnalyzer.exponentialSmoothing(cpuData),
          seasonal: TimeSeriesAnalyzer.decompose(cpuData, 24)
        },
        memory: {
          trend: TimeSeriesAnalyzer.movingAverage(memoryData, 10),
          smoothed: TimeSeriesAnalyzer.exponentialSmoothing(memoryData),
          seasonal: TimeSeriesAnalyzer.decompose(memoryData, 24)
        },
        requests: {
          trend: TimeSeriesAnalyzer.movingAverage(requestsData, 10),
          smoothed: TimeSeriesAnalyzer.exponentialSmoothing(requestsData),
          seasonal: TimeSeriesAnalyzer.decompose(requestsData, 24)
        },
        latency: {
          trend: TimeSeriesAnalyzer.movingAverage(latencyData, 10),
          smoothed: TimeSeriesAnalyzer.exponentialSmoothing(latencyData),
          seasonal: TimeSeriesAnalyzer.decompose(latencyData, 24)
        }
      };

      this.models.set(service, model);
      logger.info(`Model trained for service: ${service}`);
    } catch (error) {
      logger.error(`Failed to train model for ${service}`, error as Error);
    }
  }

  /**
   * 리소스 사용량 예측
   */
  predictUsage(service: string, horizonMinutes: number = 60): ResourcePrediction | null {
    const model = this.models.get(service);
    const data = this.historicalData.get(service);

    if (!model || !data || data.length < 10) {
      logger.warn(`Cannot predict for ${service}: insufficient data or model`);
      return null;
    }

    try {
      const predictions = this.generatePredictions(model, horizonMinutes);
      const anomalies = this.detectUpcomingAnomalies(service, predictions);
      const confidence = this.calculateConfidence(data, predictions);

      return {
        service,
        predictions,
        confidence,
        horizon: horizonMinutes,
        anomalies
      };
    } catch (error) {
      logger.error(`Prediction failed for ${service}`, error as Error);
      return null;
    }
  }

  /**
   * 예측값 생성
   */
  private generatePredictions(model: any, horizon: number): {
    cpu: number[];
    memory: number[];
    requests: number[];
    latency: number[];
  } {
    const predictions = {
      cpu: [] as number[],
      memory: [] as number[],
      requests: [] as number[],
      latency: [] as number[]
    };

    for (let i = 0; i < horizon; i++) {
      // 트렌드 + 계절성 + 잡음을 결합한 예측
      for (const metric of ['cpu', 'memory', 'requests', 'latency'] as const) {
        const smoothed = model[metric].smoothed;
        const seasonal = model[metric].seasonal;
        
        if (smoothed.length > 0 && seasonal.seasonal.length > 0) {
          const lastSmoothed = smoothed[smoothed.length - 1];
          const seasonalComponent = seasonal.seasonal[i % seasonal.seasonal.length];
          const predicted = Math.max(0, lastSmoothed + seasonalComponent);
          predictions[metric].push(predicted);
        } else {
          predictions[metric].push(0);
        }
      }
    }

    return predictions;
  }

  /**
   * 이상 상황 감지
   */
  private detectUpcomingAnomalies(service: string, predictions: any): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];
    const currentTime = Date.now();

    // CPU 스파이크 감지
    const cpuSpikes = predictions.cpu.map((value: number, index: number) => ({ value, index }))
      .filter((item: any) => item.value > 80);

    if (cpuSpikes.length > 0) {
      anomalies.push({
        type: 'spike',
        metric: 'cpu',
        severity: cpuSpikes[0].value > 95 ? 'high' : 'medium',
        probability: 0.85,
        expectedTime: currentTime + cpuSpikes[0].index * 60 * 1000,
        recommendation: 'Consider auto-scaling or load balancing'
      });
    }

    // 메모리 누수 패턴 감지
    const memoryTrend = this.calculateTrend(predictions.memory);
    if (memoryTrend > 0.5) { // 지속적인 증가 패턴
      anomalies.push({
        type: 'trend',
        metric: 'memory',
        severity: 'medium',
        probability: 0.75,
        expectedTime: currentTime + 30 * 60 * 1000, // 30분 후
        recommendation: 'Monitor for memory leaks and consider restart'
      });
    }

    // 응답 시간 악화 감지
    const latencySpikes = predictions.latency.filter((value: number) => value > 1000);
    if (latencySpikes.length > predictions.latency.length * 0.3) {
      anomalies.push({
        type: 'pattern',
        metric: 'latency',
        severity: 'high',
        probability: 0.9,
        expectedTime: currentTime + 15 * 60 * 1000, // 15분 후
        recommendation: 'Immediate attention required - performance degradation'
      });
    }

    return anomalies;
  }

  /**
   * 트렌드 계산 (기울기)
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
   * 예측 신뢰도 계산
   */
  private calculateConfidence(data: ResourceMetric[], predictions: any): number {
    if (data.length < 10) return 0.5;

    // 과거 예측 정확도를 기반으로 신뢰도 계산
    const recentData = data.slice(-10);
    const variance = this.calculateVariance(recentData.map(d => d.cpu));
    
    // 변동성이 낮을수록 높은 신뢰도
    const confidence = Math.max(0.4, Math.min(0.95, 1 - variance / 100));
    return confidence;
  }

  /**
   * 분산 계산
   */
  private calculateVariance(data: number[]): number {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    return variance;
  }

  /**
   * 모든 서비스에 대한 예측
   */
  predictAllServices(horizonMinutes: number = 60): Map<string, ResourcePrediction> {
    const predictions = new Map<string, ResourcePrediction>();

    for (const service of Array.from(this.historicalData.keys())) {
      const prediction = this.predictUsage(service, horizonMinutes);
      if (prediction) {
        predictions.set(service, prediction);
      }
    }

    return predictions;
  }

  /**
   * 시스템 전체 부하 예측
   */
  predictSystemLoad(horizonMinutes: number = 60): {
    totalCpu: number[];
    totalMemory: number[];
    totalRequests: number[];
    avgLatency: number[];
    confidence: number;
  } {
    const allPredictions = this.predictAllServices(horizonMinutes);
    const systemLoad = {
      totalCpu: new Array(horizonMinutes).fill(0),
      totalMemory: new Array(horizonMinutes).fill(0),
      totalRequests: new Array(horizonMinutes).fill(0),
      avgLatency: new Array(horizonMinutes).fill(0),
      confidence: 0
    };

    let serviceCount = 0;
    let totalConfidence = 0;

    for (const prediction of Array.from(allPredictions.values())) {
      serviceCount++;
      totalConfidence += prediction.confidence;

      for (let i = 0; i < horizonMinutes; i++) {
        if (i < prediction.predictions.cpu.length) {
          systemLoad.totalCpu[i] += prediction.predictions.cpu[i];
          systemLoad.totalMemory[i] += prediction.predictions.memory[i];
          systemLoad.totalRequests[i] += prediction.predictions.requests[i];
          systemLoad.avgLatency[i] += prediction.predictions.latency[i];
        }
      }
    }

    // 평균 계산
    if (serviceCount > 0) {
      systemLoad.confidence = totalConfidence / serviceCount;
      for (let i = 0; i < horizonMinutes; i++) {
        systemLoad.avgLatency[i] /= serviceCount;
      }
    }

    return systemLoad;
  }

  /**
   * 데이터 내보내기 (디버깅 및 분석용)
   */
  exportData(service?: string): any {
    if (service) {
      return {
        historical: this.historicalData.get(service) || [],
        model: this.models.get(service) || null
      };
    }

    const exportData: any = {};
    for (const [serviceName, data] of Array.from(this.historicalData.entries())) {
      exportData[serviceName] = {
        historical: data,
        model: this.models.get(serviceName) || null
      };
    }

    return exportData;
  }
}

// 싱글톤 인스턴스
export const resourcePredictor = new AIResourcePredictor();