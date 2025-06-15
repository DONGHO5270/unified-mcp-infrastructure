// ============================================================================
// 프론트엔드 모니터링 타입 정의 - 3 Phase 통합 스켈레톤
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
  serviceId: string;
  priority: number; // 0.0 - 1.0
  allocation: number; // Resource allocation percentage
  factors: {
    toolCount: number;
    usageFrequency: number;
    errorHistory: number;
    resourceImpact: number;
  };
  autoAdjust: boolean;
  lastAdjusted: string;
}

export interface OptimizationRecommendation {
  serviceId: string;
  type: 'scale_up' | 'scale_down' | 'redistribute' | 'cache' | 'optimize';
  priority: 'low' | 'medium' | 'high' | 'critical';
  expectedImprovement: number;
  confidence: number;
  description: string;
  implementation: {
    automated: boolean;
    steps: string[];
    estimatedTime: number;
  };
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

// Enhanced metrics for user-centric dashboard
export interface EnhancedMetrics {
  responseTime: {
    current: number;
    trend: Array<{ timestamp: string; value: number }>;
    percentile95: number;
    change24h: number;
  };
  throughput: {
    current: number;
    rateOfChange: number;
    peak24h: number;
    unit: string;
  };
  errorRate: {
    current: number;
    problemServices: Array<{
      serviceId: string;
      errorRate: number;
      lastError?: string;
    }>;
    trend: 'improving' | 'stable' | 'worsening';
  };
  resourceUsage: {
    cpu: {
      current: number;
      threshold: number;
      status: 'normal' | 'warning' | 'critical';
    };
    memory: {
      current: number;
      threshold: number;
      status: 'normal' | 'warning' | 'critical';
    };
    activeConnections: number;
  };
}

export interface MonitoringSummary {
  system: {
    uptime: number;
    isRunning: boolean;
    phases: Record<string, any>;
  };
  health: {
    total: number;
    healthy: number;
    degraded: number;
    failing: number;
    dead: number;
    healthyPercentage: number;
    activeAlerts: number;
  };
  metrics: {
    total: number;
    healthy: number;
    degraded: number;
    failing: number;
    dead: number;
    healthyPercentage: number;
    servicesMonitored: number;
  };
  enhanced?: EnhancedMetrics;
  recentEvents: Array<{
    type: string;
    serviceId?: string;
    data: any;
    timestamp: string;
    phase: number;
  }>;
}