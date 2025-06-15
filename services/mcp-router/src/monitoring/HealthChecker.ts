// ============================================================================
// Phase 1: 서비스 헬스 체커 - 핵심 구현
// ============================================================================

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { 
  Alert, 
  ServiceHealthStatus,
  MonitoringConfig,
  DEFAULT_MONITORING_CONFIG 
} from './types/monitoring';

export interface HealthCheckResult {
  serviceId: string;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: string;
}

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  retries: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    consecutiveFailures: number;
  };
}

export class HealthChecker extends EventEmitter {
  private healthStatus: Map<string, ServiceHealthStatus> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private alerts: Map<string, Alert[]> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config: MonitoringConfig;
  private healthCheckConfig: HealthCheckConfig;

  // 서비스 검사 함수 저장소
  private serviceCheckers: Map<string, () => Promise<HealthCheckResult>> = new Map();

  constructor(
    config: Partial<MonitoringConfig> = {},
    healthConfig: Partial<HealthCheckConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
    this.healthCheckConfig = {
      interval: 30000, // 30초
      timeout: 5000,   // 5초
      retries: 2,
      alertThresholds: {
        responseTime: 1000,
        errorRate: 5,
        consecutiveFailures: 3
      },
      ...healthConfig
    };

    logger.info('🏥 HealthChecker initialized - Phase 1 Active');
  }

  // ============================================================================
  // Phase 1: 핵심 헬스 체크 구현
  // ============================================================================

  public start(): void {
    if (this.isRunning) {
      logger.warn('HealthChecker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting HealthChecker with Phase 1 implementation');

    // 즉시 첫 번째 체크 수행
    this.performHealthChecks();

    // 정기적인 헬스 체크 시작
    this.checkInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckConfig.interval);
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    logger.info('🛑 HealthChecker stopped');
  }

  // ============================================================================
  // 서비스 등록 및 체크 함수 관리
  // ============================================================================

  public registerService(
    serviceId: string, 
    checker: () => Promise<HealthCheckResult>
  ): void {
    const sanitizedServiceId = this.sanitizeServiceId(serviceId);
    this.serviceCheckers.set(sanitizedServiceId, checker);
    
    // 초기 상태 설정
    this.healthStatus.set(sanitizedServiceId, {
      status: 'healthy',
      responseTime: 0,
      errorRate: 0,
      trend: 'stable',
      uptime: 0
    });

    this.consecutiveFailures.set(sanitizedServiceId, 0);
    
    logger.info(`📋 Service registered for health checking: ${sanitizedServiceId}`);
  }

  public unregisterService(serviceId: string): void {
    const sanitizedServiceId = this.sanitizeServiceId(serviceId);
    this.serviceCheckers.delete(sanitizedServiceId);
    this.healthStatus.delete(sanitizedServiceId);
    this.consecutiveFailures.delete(sanitizedServiceId);
    this.alerts.delete(sanitizedServiceId);
    
    logger.info(`🗑️ Service unregistered from health checking: ${sanitizedServiceId}`);
  }

  // ============================================================================
  // 헬스 체크 실행
  // ============================================================================

  private async performHealthChecks(): Promise<void> {
    try {
      const checkPromises = Array.from(this.serviceCheckers.entries()).map(
        ([serviceId, checker]) => this.performSingleHealthCheck(serviceId, checker)
      );

      const results = await Promise.allSettled(checkPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const serviceId = Array.from(this.serviceCheckers.keys())[index];
          logger.error(`Health check failed for ${serviceId}:`, result.reason);
        }
      });

      logger.debug(`Completed health checks for ${this.serviceCheckers.size} services`);
    } catch (error) {
      logger.error('Failed to perform health checks:', error);
    }
  }

  private async performSingleHealthCheck(
    serviceId: string,
    checker: () => Promise<HealthCheckResult>
  ): Promise<void> {
    let result: HealthCheckResult;
    let attempts = 0;
    const maxAttempts = this.healthCheckConfig.retries + 1;

    // 재시도 로직
    while (attempts < maxAttempts) {
      try {
        const startTime = Date.now();
        
        // 타임아웃 설정
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), this.healthCheckConfig.timeout);
        });

        result = await Promise.race([checker(), timeoutPromise]);
        result.responseTime = Date.now() - startTime;
        
        break; // 성공시 루프 종료
      } catch (error) {
        attempts++;
        result = {
          serviceId,
          isHealthy: false,
          responseTime: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        };

        if (attempts < maxAttempts) {
          // 재시도 전 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // 결과 처리
    this.processHealthCheckResult(result!);
  }

  private processHealthCheckResult(result: HealthCheckResult): void {
    const { serviceId, isHealthy, responseTime, error } = result;
    
    // 연속 실패 횟수 업데이트
    if (!isHealthy) {
      const failures = this.consecutiveFailures.get(serviceId) || 0;
      this.consecutiveFailures.set(serviceId, failures + 1);
    } else {
      this.consecutiveFailures.set(serviceId, 0);
    }

    // 헬스 상태 업데이트
    const healthStatus = this.calculateHealthStatus(serviceId, isHealthy, responseTime, error);
    this.healthStatus.set(serviceId, healthStatus);

    // 알림 검사
    this.checkForAlerts(serviceId, healthStatus, result);

    // 이벤트 발송
    this.emit('healthCheckCompleted', {
      serviceId,
      result,
      healthStatus,
      timestamp: new Date().toISOString()
    });

    logger.debug(`Health check completed for ${serviceId}: ${healthStatus.status} (${responseTime}ms)`);
  }

  // ============================================================================
  // 헬스 상태 계산
  // ============================================================================

  private calculateHealthStatus(
    serviceId: string,
    isHealthy: boolean,
    responseTime: number,
    error?: string
  ): ServiceHealthStatus {
    const failures = this.consecutiveFailures.get(serviceId) || 0;
    const previousStatus = this.healthStatus.get(serviceId);
    
    let status: ServiceHealthStatus['status'] = 'healthy';
    let trend: ServiceHealthStatus['trend'] = 'stable';

    // 상태 결정
    if (!isHealthy || failures >= this.healthCheckConfig.alertThresholds.consecutiveFailures) {
      status = 'dead';
    } else if (responseTime > this.healthCheckConfig.alertThresholds.responseTime * 2) {
      status = 'failing';
    } else if (responseTime > this.healthCheckConfig.alertThresholds.responseTime) {
      status = 'degraded';
    }

    // 트렌드 분석
    if (previousStatus) {
      const previousResponseTime = previousStatus.responseTime;
      if (responseTime > previousResponseTime * 1.5) {
        trend = 'worsening';
      } else if (responseTime < previousResponseTime * 0.8) {
        trend = 'improving';
      }
    }

    return {
      status,
      responseTime,
      errorRate: failures > 0 ? (failures / (failures + 1)) * 100 : 0,
      trend,
      uptime: status === 'healthy' ? (previousStatus?.uptime || 0) + this.healthCheckConfig.interval / 1000 : 0,
      lastIncident: !isHealthy ? new Date().toISOString() : previousStatus?.lastIncident
    };
  }

  // ============================================================================
  // 알림 시스템
  // ============================================================================

  private checkForAlerts(
    serviceId: string,
    healthStatus: ServiceHealthStatus,
    result: HealthCheckResult
  ): void {
    const alerts: Alert[] = [];

    // 응답 시간 알림
    if (healthStatus.responseTime > this.healthCheckConfig.alertThresholds.responseTime) {
      alerts.push(this.createAlert(
        serviceId,
        'performance',
        healthStatus.responseTime > this.healthCheckConfig.alertThresholds.responseTime * 2 ? 'error' : 'warning',
        `High response time: ${healthStatus.responseTime}ms (threshold: ${this.healthCheckConfig.alertThresholds.responseTime}ms)`
      ));
    }

    // 연속 실패 알림
    const failures = this.consecutiveFailures.get(serviceId) || 0;
    if (failures >= this.healthCheckConfig.alertThresholds.consecutiveFailures) {
      alerts.push(this.createAlert(
        serviceId,
        'availability',
        'critical',
        `Service unavailable: ${failures} consecutive failures`
      ));
    }

    // 상태 변화 알림
    const previousStatus = this.healthStatus.get(serviceId);
    if (previousStatus && previousStatus.status !== healthStatus.status) {
      alerts.push(this.createAlert(
        serviceId,
        'availability',
        healthStatus.status === 'healthy' ? 'info' : 'warning',
        `Service status changed: ${previousStatus.status} → ${healthStatus.status}`
      ));
    }

    // 알림 저장 및 발송
    if (alerts.length > 0) {
      const existingAlerts = this.alerts.get(serviceId) || [];
      this.alerts.set(serviceId, [...existingAlerts, ...alerts]);

      alerts.forEach(alert => {
        this.emit('alertGenerated', alert);
        logger.warn(`🚨 Alert generated for ${serviceId}: ${alert.message}`);
      });
    }
  }

  private createAlert(
    serviceId: string,
    type: Alert['type'],
    severity: Alert['severity'],
    message: string
  ): Alert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      serviceId,
      type,
      severity,
      message,
      timestamp: new Date().toISOString(),
      resolved: false
    };
  }

  // ============================================================================
  // Phase 2 & 3: 스켈레톤 메서드
  // ============================================================================

  public enablePredictiveHealthChecks(): void {
    if (!this.config.phases.PHASE_2.enabled) {
      logger.warn('[PHASE-2] Predictive health checks not enabled yet');
      console.log('🔧 Phase 2: Predictive Health Analysis - Implementation needed');
      return;
    }
    // TODO: Phase 2 구현 시 예측적 헬스 체크 로직 추가
  }

  public enableAdaptiveThresholds(): void {
    if (!this.config.phases.PHASE_3.enabled) {
      logger.warn('[PHASE-3] Adaptive thresholds not enabled yet');
      console.log('🔧 Phase 3: Adaptive Threshold Management - Implementation needed');
      return;
    }
    // TODO: Phase 3 구현 시 적응형 임계값 로직 추가
  }

  // ============================================================================
  // 조회 메서드
  // ============================================================================

  public getServiceHealth(serviceId: string): ServiceHealthStatus | null {
    const sanitizedServiceId = this.sanitizeServiceId(serviceId);
    return this.healthStatus.get(sanitizedServiceId) || null;
  }

  public getAllHealthStatus(): Map<string, ServiceHealthStatus> {
    return new Map(this.healthStatus);
  }

  public getServiceAlerts(serviceId: string): Alert[] {
    const sanitizedServiceId = this.sanitizeServiceId(serviceId);
    return this.alerts.get(sanitizedServiceId) || [];
  }

  public getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values()).flat();
  }

  public getActiveAlerts(): Alert[] {
    return this.getAllAlerts().filter(alert => !alert.resolved);
  }

  public resolveAlert(alertId: string): boolean {
    for (const [serviceId, serviceAlerts] of this.alerts.entries()) {
      const alert = serviceAlerts.find(a => a.id === alertId);
      if (alert) {
        alert.resolved = true;
        alert.resolvedAt = new Date().toISOString();
        
        this.emit('alertResolved', alert);
        logger.info(`✅ Alert resolved: ${alertId}`);
        return true;
      }
    }
    return false;
  }

  public getHealthSummary() {
    const allStatus = Array.from(this.healthStatus.values());
    const healthy = allStatus.filter(s => s.status === 'healthy').length;
    const degraded = allStatus.filter(s => s.status === 'degraded').length;
    const failing = allStatus.filter(s => s.status === 'failing').length;
    const dead = allStatus.filter(s => s.status === 'dead').length;

    return {
      total: allStatus.length,
      healthy,
      degraded,
      failing,
      dead,
      healthyPercentage: allStatus.length > 0 ? (healthy / allStatus.length) * 100 : 0,
      activeAlerts: this.getActiveAlerts().length
    };
  }

  // ============================================================================
  // 유틸리티 메서드
  // ============================================================================

  private sanitizeServiceId(serviceId: string): string {
    return serviceId.replace(/[^\w\-_.]/g, '_').toLowerCase();
  }

  private validateUtf8(text: string): boolean {
    if (!this.config.encoding.validateUtf8) return true;
    
    try {
      const buffer = Buffer.from(text, 'utf8');
      return buffer.toString('utf8') === text;
    } catch {
      return false;
    }
  }
}