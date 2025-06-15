/**
 * MCP Infrastructure Library
 * 통합 MCP 인프라를 위한 공통 라이브러리 모듈
 * 
 * Phase 1: 공통 라이브러리 구축 완료
 * - API 클라이언트 라이브러리
 * - MCP 통신 프로토콜 래퍼  
 * - 에러 처리 유틸리티
 * - 로깅 시스템
 * - 인증 및 보안 모듈
 */

// ============ API Client ============
export {
  ApiClient,
  apiClient,
  type ApiResponse,
  type PaginatedResponse
} from './api/client';

// ============ MCP Protocol ============
export {
  MCPProtocolWrapper,
  MCPService,
  MCPServiceFactory,
  mcpProtocol,
  type MCPRequest,
  type MCPResponse,
  type MCPError,
  type MCPTool,
  type MCPToolCall,
  type MCPToolResult,
  type MCPResource,
  type MCPResourceContent
} from './mcp/protocol';

// ============ Error Handling ============
export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  ServiceError,
  MCPProtocolError,
  RateLimitError,
  ErrorHandler,
  ErrorCode,
  safeJsonParse,
  safeExecute,
  safeExecuteAsync,
  retry,
  formatErrorMessage,
  getUserFriendlyMessage,
  type ErrorContext,
  type ErrorDetails
} from './utils/error-handler';

// ============ Logging ============
export {
  Logger,
  PerformanceLogger,
  ConsoleTransport,
  LocalStorageTransport,
  RemoteTransport,
  LogLevel,
  LOG_LEVEL_NAMES,
  logger,
  performanceLogger,
  createServiceLogger,
  createComponentLogger,
  type LogContext,
  type LogMetadata,
  type LogTransport
} from './utils/logger';

// ============ Authentication & Security ============
export {
  TokenManager,
  AuthService,
  PermissionService,
  SecurityUtils,
  requireAuth,
  requireRole,
  startAutoTokenRefresh,
  stopAutoTokenRefresh,
  type JWTPayload,
  type LoginCredentials,
  type LoginResponse
} from './auth/security';

// ============ Utility Functions ============

/**
 * 라이브러리 버전 정보
 */
export const LIB_VERSION = '1.0.0';

/**
 * 라이브러리 초기화
 */
export interface LibraryConfig {
  apiBaseUrl?: string;
  logLevel?: string;
  enableRemoteLogging?: boolean;
  remoteLogEndpoint?: string;
  remoteLogApiKey?: string;
  autoTokenRefresh?: boolean;
  tokenRefreshInterval?: number;
}

// 초기화 상태 추적
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

export async function initializeLibrary(config: LibraryConfig = {}): Promise<void> {
  // 이미 초기화되었거나 진행 중인 경우 방지
  if (isInitialized) {
    console.debug('MCP Infrastructure Library already initialized, skipping...');
    return;
  }

  if (initializationPromise) {
    console.debug('MCP Infrastructure Library initialization in progress, waiting...');
    return initializationPromise;
  }

  // 초기화 프로미스 생성
  initializationPromise = (async () => {
    const {
      apiBaseUrl = 'http://localhost:3100',
      logLevel = 'info' as any,
      enableRemoteLogging = false,
      remoteLogEndpoint,
      remoteLogApiKey,
      autoTokenRefresh = true,
      tokenRefreshInterval = 4 * 60 * 1000 // 4분
    } = config;

    // 동적 import로 실제 모듈들 로드
    const { LogLevel, logger, ConsoleTransport, RemoteTransport, LOG_LEVEL_NAMES } = await import('./utils/logger');
    const { apiClient } = await import('./api/client');
    const { startAutoTokenRefresh } = await import('./auth/security');

    // API 클라이언트 설정
    console.info('Initializing MCP Infrastructure Library');
    
    // Track initialization for debugging
    if (typeof window !== 'undefined' && (window as any).reactInitDebugger) {
      (window as any).reactInitDebugger.trackLibraryInit('initializeLibrary');
    }

  // 로깅 설정
  if (process.env.NODE_ENV === 'development') {
    logger.addTransport(new ConsoleTransport(LogLevel.DEBUG));
  } else {
    logger.addTransport(new ConsoleTransport(LogLevel.INFO));
  }

  // 원격 로깅 설정
  if (enableRemoteLogging && remoteLogEndpoint) {
    logger.addTransport(new RemoteTransport(
      remoteLogEndpoint,
      LogLevel.ERROR,
      true,
      remoteLogApiKey
    ));
  }

  // 자동 토큰 갱신 설정
  if (autoTokenRefresh) {
    startAutoTokenRefresh(tokenRefreshInterval);
  }

    logger.info('MCP Infrastructure Library initialized', {
      version: LIB_VERSION,
      config: {
        apiBaseUrl,
        logLevel,
        enableRemoteLogging,
        autoTokenRefresh
      }
    });

    // 초기화 완료 마킹
    isInitialized = true;
  })();

  try {
    await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

/**
 * 헬스 체크 유틸리티
 */
export async function healthCheck(): Promise<{
  api: boolean;
  auth: boolean;
  timestamp: string;
}> {
  const results = {
    api: false,
    auth: false,
    timestamp: new Date().toISOString()
  };

  try {
    // 동적 import
    const { apiClient } = await import('./api/client');
    const { logger } = await import('./utils/logger');
    const { AuthService } = await import('./auth/security');

    // API 헬스 체크
    const apiHealth = await apiClient.healthCheck();
    results.api = apiHealth.success;

    // 인증 상태 확인
    results.auth = AuthService.isAuthenticated();
  } catch (error) {
    console.error('Health check failed', error);
  }

  return results;
}

/**
 * 디버그 정보 수집
 */
export async function getDebugInfo(): Promise<Record<string, any>> {
  const debugInfo = {
    library: {
      version: LIB_VERSION,
      timestamp: new Date().toISOString()
    },
    browser: typeof window !== 'undefined' ? {
      userAgent: navigator.userAgent,
      url: window.location.href,
      localStorage: !!window.localStorage,
      sessionStorage: !!window.sessionStorage
    } : null,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      platform: typeof window !== 'undefined' ? 'browser' : 'node'
    }
  };

  try {
    const { apiClient } = await import('./api/client');
    const { TokenManager, AuthService } = await import('./auth/security');

    return {
      ...debugInfo,
      api: {
        baseUrl: (apiClient as any).baseUrl,
        hasAuthToken: !!TokenManager.getAccessToken()
      },
      auth: {
        isAuthenticated: AuthService.isAuthenticated(),
        currentUser: AuthService.getCurrentUser()?.username,
        tokenExpiration: TokenManager.getAccessToken() ? 
          TokenManager.getTokenExpiration(TokenManager.getAccessToken()!) : null
      }
    };
  } catch (error) {
    return debugInfo;
  }
}

/**
 * 성능 메트릭 수집
 */
export function getPerformanceMetrics(): Record<string, any> {
  if (typeof window === 'undefined' || !window.performance) {
    return {};
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');

  return {
    navigation: {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      pageLoad: navigation.loadEventEnd - navigation.fetchStart
    },
    paint: paint.reduce((acc, entry) => {
      acc[entry.name.replace('-', '_')] = entry.startTime;
      return acc;
    }, {} as Record<string, number>),
    memory: (performance as any).memory ? {
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
    } : null
  };
}

/**
 * 라이브러리 정리
 */
export async function cleanup(): Promise<void> {
  try {
    const { stopAutoTokenRefresh } = await import('./auth/security');
    const { logger } = await import('./utils/logger');
    
    stopAutoTokenRefresh();
    logger.destroy();
    
    logger.info('MCP Infrastructure Library cleaned up');
  } catch (error) {
    console.info('MCP Infrastructure Library cleaned up');
  }
}