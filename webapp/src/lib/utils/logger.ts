/**
 * Logging System
 * 통합 MCP 인프라를 위한 클라이언트 사이드 로깅 시스템
 */

import { LogEntry } from '../../types';

// ============ Log Levels ============

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.CRITICAL]: 'critical'
};

// ============ Log Interfaces ============

export interface LogContext {
  service?: string;
  component?: string;
  function?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  [key: string]: any;
}

export interface LogMetadata {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  extra?: Record<string, any>;
}

export interface LogTransport {
  name: string;
  level: LogLevel;
  enabled: boolean;
  log(metadata: LogMetadata): Promise<void> | void;
}

// ============ Log Transports ============

/**
 * 콘솔 로그 전송자
 */
export class ConsoleTransport implements LogTransport {
  name = 'console';
  level: LogLevel;
  enabled: boolean;

  constructor(level: LogLevel = LogLevel.INFO, enabled: boolean = true) {
    this.level = level;
    this.enabled = enabled;
  }

  log(metadata: LogMetadata): void {
    if (!this.enabled || metadata.level < this.level) {
      return;
    }

    const levelName = LOG_LEVEL_NAMES[metadata.level];
    const timestamp = new Date(metadata.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] [${levelName.toUpperCase()}]`;
    
    let contextInfo = '';
    if (metadata.context) {
      const contextParts = [];
      if (metadata.context.service) contextParts.push(`service:${metadata.context.service}`);
      if (metadata.context.component) contextParts.push(`component:${metadata.context.component}`);
      if (metadata.context.function) contextParts.push(`fn:${metadata.context.function}`);
      if (contextParts.length > 0) {
        contextInfo = ` [${contextParts.join(', ')}]`;
      }
    }

    const message = `${prefix}${contextInfo} ${metadata.message}`;

    switch (metadata.level) {
      case LogLevel.DEBUG:
        console.debug(message, metadata.extra, metadata.error);
        break;
      case LogLevel.INFO:
        console.info(message, metadata.extra, metadata.error);
        break;
      case LogLevel.WARN:
        console.warn(message, metadata.extra, metadata.error);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message, metadata.extra, metadata.error);
        break;
    }
  }
}

/**
 * 로컬 스토리지 로그 전송자
 */
export class LocalStorageTransport implements LogTransport {
  name = 'localStorage';
  level: LogLevel;
  enabled: boolean;
  private maxEntries: number;
  private storageKey: string;

  constructor(
    level: LogLevel = LogLevel.WARN,
    enabled: boolean = true,
    maxEntries: number = 1000,
    storageKey: string = 'mcp-infrastructure-logs'
  ) {
    this.level = level;
    this.enabled = enabled;
    this.maxEntries = maxEntries;
    this.storageKey = storageKey;
  }

  log(metadata: LogMetadata): void {
    if (!this.enabled || metadata.level < this.level || typeof window === 'undefined') {
      return;
    }

    try {
      const logs = this.getLogs();
      
      const logEntry: LogEntry = {
        id: this.generateId(),
        timestamp: metadata.timestamp,
        level: LOG_LEVEL_NAMES[metadata.level] as any,
        service: metadata.context?.service || 'frontend',
        message: metadata.message,
        metadata: {
          context: metadata.context,
          extra: metadata.extra,
          error: metadata.error ? {
            name: metadata.error.name,
            message: metadata.error.message,
            stack: metadata.error.stack
          } : undefined
        }
      };

      logs.push(logEntry);

      // 최대 개수 제한
      if (logs.length > this.maxEntries) {
        logs.splice(0, logs.length - this.maxEntries);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to save log to localStorage:', error);
    }
  }

  private getLogs(): LogEntry[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load logs from localStorage:', error);
      return [];
    }
  }

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 저장된 로그 조회
   */
  getStoredLogs(): LogEntry[] {
    return this.getLogs();
  }

  /**
   * 저장된 로그 삭제
   */
  clearLogs(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear logs from localStorage:', error);
    }
  }
}

/**
 * 원격 서버 로그 전송자
 */
export class RemoteTransport implements LogTransport {
  name = 'remote';
  level: LogLevel;
  enabled: boolean;
  private endpoint: string;
  private apiKey?: string;
  private batchSize: number;
  private flushInterval: number;
  private batch: LogMetadata[] = [];
  private timer?: NodeJS.Timeout;

  constructor(
    endpoint: string,
    level: LogLevel = LogLevel.ERROR,
    enabled: boolean = true,
    apiKey?: string,
    batchSize: number = 10,
    flushInterval: number = 5000
  ) {
    this.endpoint = endpoint;
    this.level = level;
    this.enabled = enabled;
    this.apiKey = apiKey;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;

    this.startFlushTimer();
  }

  log(metadata: LogMetadata): void {
    if (!this.enabled || metadata.level < this.level) {
      return;
    }

    this.batch.push(metadata);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  private startFlushTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      if (this.batch.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) {
      return;
    }

    const logsToSend = [...this.batch];
    this.batch = [];

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          logs: logsToSend.map(log => ({
            timestamp: log.timestamp,
            level: LOG_LEVEL_NAMES[log.level],
            message: log.message,
            context: log.context,
            extra: log.extra,
            error: log.error ? {
              name: log.error.name,
              message: log.error.message,
              stack: log.error.stack
            } : undefined
          }))
        })
      });
    } catch (error) {
      console.error('Failed to send logs to remote server:', error);
      // 실패한 로그를 다시 배치에 추가
      this.batch.unshift(...logsToSend);
    }
  }

  /**
   * 남은 로그 강제 전송
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * 전송자 종료
   */
  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.flush(); // 마지막 로그들 전송
  }
}

// ============ Logger Class ============

export class Logger {
  private transports: LogTransport[] = [];
  private defaultContext: LogContext = {};

  constructor(defaultContext?: LogContext) {
    if (defaultContext) {
      this.defaultContext = defaultContext;
    }
  }

  /**
   * 전송자 추가
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * 전송자 제거
   */
  removeTransport(name: string): void {
    this.transports = this.transports.filter(t => t.name !== name);
  }

  /**
   * 기본 컨텍스트 설정
   */
  setDefaultContext(context: LogContext): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  /**
   * 로그 메시지 기록
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    extra?: Record<string, any>,
    error?: Error
  ): void {
    const metadata: LogMetadata = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.defaultContext, ...context },
      extra,
      error
    };

    this.transports.forEach(transport => {
      try {
        transport.log(metadata);
      } catch (error) {
        console.error(`Error in transport ${transport.name}:`, error);
      }
    });
  }

  /**
   * 디버그 로그
   */
  debug(message: string, context?: LogContext, extra?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context, extra);
  }

  /**
   * 정보 로그
   */
  info(message: string, context?: LogContext, extra?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context, extra);
  }

  /**
   * 경고 로그
   */
  warn(message: string, context?: LogContext, extra?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context, extra);
  }

  /**
   * 에러 로그
   */
  error(message: string, error?: Error, context?: LogContext, extra?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, extra, error);
  }

  /**
   * 크리티컬 로그
   */
  critical(message: string, error?: Error, context?: LogContext, extra?: Record<string, any>): void {
    this.log(LogLevel.CRITICAL, message, context, extra, error);
  }

  /**
   * 자식 로거 생성
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger({ ...this.defaultContext, ...context });
    childLogger.transports = this.transports; // 동일한 전송자 사용
    return childLogger;
  }

  /**
   * 모든 전송자 정리
   */
  destroy(): void {
    this.transports.forEach(transport => {
      if ('destroy' in transport && typeof transport.destroy === 'function') {
        transport.destroy();
      }
    });
    this.transports = [];
  }
}

// ============ Performance Logging Utilities ============

export class PerformanceLogger {
  private logger: Logger;
  private marks: Map<string, number> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 성능 측정 시작
   */
  start(operation: string): void {
    this.marks.set(operation, performance.now());
  }

  /**
   * 성능 측정 종료 및 로깅
   */
  end(operation: string, context?: LogContext): void {
    const startTime = this.marks.get(operation);
    if (startTime === undefined) {
      this.logger.warn(`Performance mark not found for operation: ${operation}`);
      return;
    }

    const duration = performance.now() - startTime;
    this.marks.delete(operation);

    this.logger.info(`Performance: ${operation}`, context, {
      operation,
      duration: Math.round(duration * 100) / 100, // 소수점 2자리까지
      unit: 'ms'
    });
  }

  /**
   * 함수 실행 시간 측정
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    this.start(operation);
    try {
      const result = await fn();
      this.end(operation, context);
      return result;
    } catch (error) {
      this.end(operation, context);
      throw error;
    }
  }
}

// ============ Default Logger Setup ============

// 기본 로거 인스턴스 생성
export const logger = new Logger({
  component: 'frontend',
  service: 'mcp-infrastructure'
});

// 기본 전송자 설정
logger.addTransport(new ConsoleTransport(
  process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
));

logger.addTransport(new LocalStorageTransport(LogLevel.WARN));

// 프로덕션 환경에서 원격 로깅 활성화 (환경 변수로 제어)
if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_LOG_ENDPOINT) {
  logger.addTransport(new RemoteTransport(
    process.env.REACT_APP_LOG_ENDPOINT,
    LogLevel.ERROR,
    true,
    process.env.REACT_APP_LOG_API_KEY
  ));
}

// 성능 로거
export const performanceLogger = new PerformanceLogger(logger);

// 서비스별 로거 팩토리
export const createServiceLogger = (serviceName: string): Logger => {
  return logger.child({ service: serviceName });
};

// 컴포넌트별 로거 팩토리
export const createComponentLogger = (componentName: string): Logger => {
  return logger.child({ component: componentName });
};

// 브라우저 언로드 시 로그 정리
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    logger.destroy();
  });
}