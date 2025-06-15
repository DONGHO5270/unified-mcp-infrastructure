// ============================================================================
// MCP 모니터링 시스템 타입 정의 - 3 Phase 통합 스켈레톤
// ============================================================================

export interface MonitoringPhaseConfig {
  enabled: boolean;
  completed: boolean;
  features: string[];
}

export interface MonitoringConfig {
  phases: {
    PHASE_1: MonitoringPhaseConfig;
    PHASE_2: MonitoringPhaseConfig; 
    PHASE_3: MonitoringPhaseConfig;
  };
  encoding: {
    validateUtf8: boolean;
    fallbackEncoding: string;
  };
  metrics: {
    collectionInterval: number;
    retentionDays: number;
    maxMetricsPerService: number;
  };
}

// ============================================================================
// Phase 1: 기본 모니터링 타입
// ============================================================================

export interface ServiceHealthStatus {
  status: 'healthy' | 'degraded' | 'failing' | 'dead';
  responseTime: number;
  errorRate: number;
  trend: 'improving' | 'stable' | 'worsening';
  lastIncident?: string;
  uptime: number;
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  unit: string;
}

export interface ServiceMetrics {
  serviceId: string;
  health: ServiceHealthStatus;
  // Phase 2,3 추가 메트릭
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  requestsPerSecond?: number;
  errorRate?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  uptime?: number;
  performance: {
    avgResponseTime: MetricDataPoint[];
    requestsPerMinute: MetricDataPoint[];
    errorCount: MetricDataPoint[];
    cpuUsage?: MetricDataPoint[];
    memoryUsage?: MetricDataPoint[];
  };
  tools: {
    totalCount: number;
    activeCount: number;
    usageDistribution: Record<string, number>;
  };
  lastUpdated: string;
}

export interface SystemMetrics {
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  unhealthyServices: number;
  systemLoad: number;
  uptime: number;
  timestamp: string;
}

export interface Alert {
  id: string;
  serviceId: string;
  type: 'performance' | 'error' | 'availability' | 'resource';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Phase 2: 예측 분석 타입 (스켈레톤)
// ============================================================================

export interface PredictiveMetrics {
  serviceId: string;
  predictions: {
    nextHourLoad: number;
    anomalyProbability: number;
    recommendedActions: string[];
    confidence: number;
  };
  trends: {
    performanceTrend: 'up' | 'down' | 'stable';
    usageTrend: 'up' | 'down' | 'stable';
    errorTrend: 'up' | 'down' | 'stable';
  };
  patterns: {
    peakHours: string[];
    weeklyPattern: Record<string, number>;
    seasonality?: string;
  };
}

export interface AnomalyDetection {
  serviceId: string;
  anomalies: Array<{
    timestamp: string;
    metric: string;
    value: number;
    expected: number;
    severity: number;
    description: string;
  }>;
  lastAnalysis: string;
}

// ============================================================================
// Phase 3: AI 기반 가중치 조정 타입 (스켈레톤)  
// ============================================================================

export interface ServiceWeight {
  serviceId?: string;
  current: number; // 현재 가중치 (0.1 - 5.0)
  min: number;
  max: number;
  history: Array<{
    timestamp: string;
    value: number;
    reason: string;
  }>;
  priority?: number; // 0.0 - 1.0
  allocation?: number; // Resource allocation percentage
  factors?: {
    toolCount: number;
    usageFrequency: number;
    errorHistory: number;
    resourceImpact: number;
  };
  autoAdjust?: boolean;
  lastAdjusted: string;
}

export interface LoadBalancingConfig {
  strategy: 'round_robin' | 'weighted' | 'least_connections' | 'adaptive' | 'weighted-round-robin';
  weights?: Record<string, ServiceWeight>;
  healthCheckInterval?: number;
  failoverThreshold?: number;
  weightUpdateInterval?: number;
  thresholds?: {
    responseTimeThreshold: number;
    errorRateThreshold: number;
    resourceThreshold: number;
  };
}

export interface OptimizationRecommendation {
  serviceId: string;
  action?: 'scale-up' | 'scale-down' | 'health-check' | 'monitor';
  type?: 'scale_up' | 'scale_down' | 'redistribute' | 'cache' | 'optimize';
  priority: 'low' | 'medium' | 'high' | 'critical' | number;
  expectedImprovement?: number;
  confidence?: number;
  description: string;
  estimatedImpact?: string;
  autoApply?: boolean;
  implementation?: {
    automated: boolean;
    steps: string[];
    estimatedTime: number;
  };
}

// ============================================================================
// Phase 2 추가 타입들
// ============================================================================

export interface PredictiveConfig {
  enabled: boolean;
  modelUpdateInterval?: number;
  anomalyThreshold?: number;
}

export interface HistoricalDataPoint {
  timestamp: string;
  metrics: any;
}

export interface TrendAnalysis {
  performanceTrend: 'up' | 'down' | 'stable';
  usageTrend: 'up' | 'down' | 'stable';
  errorTrend: 'up' | 'down' | 'stable';
  details?: any;
}

export interface PatternRecognition {
  peakHours: string[];
  weeklyPattern: Record<string, number>;
  seasonality: string;
  details?: any;
}

// Phase 3 추가 타입들
export interface WeightConfig {
  enabled: boolean;
  adjustmentInterval?: number;
  autoAdjustEnabled?: boolean;
}

// ============================================================================
// 통합 모니터링 인터페이스
// ============================================================================

export interface MonitoringData {
  // Phase 1 - Always available
  basic: ServiceMetrics;
  systemMetrics: SystemMetrics;
  alerts: Alert[];
  
  // Phase 2 - Available when enabled
  predictive?: PredictiveMetrics;
  anomalies?: AnomalyDetection;
  
  // Phase 3 - Available when enabled
  weights?: ServiceWeight;
  recommendations?: OptimizationRecommendation[];
}

export interface MonitoringEvent {
  type: 'metric_update' | 'alert' | 'prediction' | 'optimization';
  serviceId?: string;
  data: any;
  timestamp: string;
  phase: 1 | 2 | 3;
}

// ============================================================================
// API Response 타입
// ============================================================================

export interface MonitoringApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  phase: number;
  timestamp: string;
}

export interface MonitoringStatus {
  phases: Record<string, MonitoringPhaseConfig>;
  activeServices: number;
  dataRetentionDays: number;
  lastUpdate: string;
}

// ============================================================================
// 유틸리티 타입
// ============================================================================

export type MetricSanitizer = (name: string) => string;

export interface MetricNamingConfig {
  allowUnicode: boolean;
  maxLength: number;
  sanitizeFunction: MetricSanitizer;
}

export const DEFAULT_METRIC_NAMING: MetricNamingConfig = {
  allowUnicode: false,
  maxLength: 64,
  sanitizeFunction: (name: string) => {
    return name
      .replace(/[^\w\-_.]/g, '_')
      .substring(0, 64)
      .toLowerCase();
  }
};

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  phases: {
    PHASE_1: {
      enabled: true,
      completed: true,
      features: ['metrics', 'health', 'alerts']
    },
    PHASE_2: {
      enabled: true,
      completed: true,
      features: ['prediction', 'anomaly', 'trends']
    },
    PHASE_3: {
      enabled: true,
      completed: true,
      features: ['weights', 'optimization', 'auto_scaling']
    }
  },
  encoding: {
    validateUtf8: true,
    fallbackEncoding: 'utf8'
  },
  metrics: {
    collectionInterval: 30000, // 30 seconds
    retentionDays: 7,
    maxMetricsPerService: 1000
  }
};