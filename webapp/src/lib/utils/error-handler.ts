/**
 * Error Handling Utilities
 * 통합 MCP 인프라를 위한 에러 처리 유틸리티
 */

import { ApiError } from '../../types';

// ============ Error Types ============

export enum ErrorCode {
  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  
  // Authentication Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // MCP Service Errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_ERROR = 'SERVICE_ERROR',
  MCP_PROTOCOL_ERROR = 'MCP_PROTOCOL_ERROR',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  
  // System Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ErrorContext {
  service?: string;
  method?: string;
  endpoint?: string;
  requestId?: string;
  userId?: string;
  timestamp: string;
  userAgent?: string;
  ip?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorDetails {
  field?: string;
  value?: any;
  constraint?: string;
  message?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: ErrorContext;
  public readonly details?: ErrorDetails[];
  public readonly timestamp: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: ErrorContext,
    details?: ErrorDetails[]
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: {
        statusCode: this.statusCode,
        isOperational: this.isOperational,
        context: this.context,
        details: this.details,
        stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
      },
      timestamp: this.timestamp,
      requestId: this.context?.requestId
    };
  }
}

// ============ Specific Error Classes ============

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails[], context?: ErrorContext) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, true, context, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', context?: ErrorContext) {
    super(message, ErrorCode.UNAUTHORIZED, 401, true, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', context?: ErrorContext) {
    super(message, ErrorCode.FORBIDDEN, 403, true, context);
  }
}

export class NetworkError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, ErrorCode.NETWORK_ERROR, 503, true, context);
  }
}

export class ServiceError extends AppError {
  constructor(message: string, service: string, context?: ErrorContext) {
    const enhancedContext: ErrorContext = { 
      ...context, 
      service,
      timestamp: context?.timestamp || new Date().toISOString()
    };
    super(message, ErrorCode.SERVICE_ERROR, 502, true, enhancedContext);
  }
}

export class MCPProtocolError extends AppError {
  constructor(message: string, service: string, method?: string, context?: ErrorContext) {
    const enhancedContext: ErrorContext = { 
      ...context, 
      service, 
      method,
      timestamp: context?.timestamp || new Date().toISOString()
    };
    super(message, ErrorCode.MCP_PROTOCOL_ERROR, 502, true, enhancedContext);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', context?: ErrorContext) {
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429, true, context);
  }
}

// ============ Error Handler Class ============

export class ErrorHandler {
  private static errorCallbacks: Map<ErrorCode, ((error: AppError) => void)[]> = new Map();
  private static globalCallback?: (error: AppError) => void;

  /**
   * 글로벌 에러 콜백 설정
   */
  static setGlobalErrorCallback(callback: (error: AppError) => void): void {
    this.globalCallback = callback;
  }

  /**
   * 특정 에러 코드에 대한 콜백 등록
   */
  static onError(code: ErrorCode, callback: (error: AppError) => void): void {
    if (!this.errorCallbacks.has(code)) {
      this.errorCallbacks.set(code, []);
    }
    this.errorCallbacks.get(code)!.push(callback);
  }

  /**
   * 에러 처리
   */
  static handle(error: unknown, context?: Partial<ErrorContext>): AppError {
    const appError = this.normalizeError(error, context);
    
    // 콜백 실행
    this.executeCallbacks(appError);
    
    // 로깅
    this.logError(appError);
    
    return appError;
  }

  /**
   * 에러 정규화
   */
  private static normalizeError(error: unknown, context?: Partial<ErrorContext>): AppError {
    const errorContext: ErrorContext = {
      timestamp: new Date().toISOString(),
      ...context
    };

    if (error instanceof AppError) {
      return new AppError(
        error.message,
        error.code,
        error.statusCode,
        error.isOperational,
        { ...error.context, ...errorContext },
        error.details
      );
    }

    if (error instanceof Error) {
      // 특정 에러 타입 감지
      if (error.name === 'ValidationError') {
        return new ValidationError(error.message, undefined, errorContext);
      }
      
      if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
        return new AuthenticationError(error.message, errorContext);
      }
      
      if (error.name === 'ForbiddenError' || error.message.includes('forbidden')) {
        return new AuthorizationError(error.message, errorContext);
      }
      
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return new NetworkError(`Request timeout: ${error.message}`, errorContext);
      }
      
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return new NetworkError(error.message, errorContext);
      }

      return new AppError(error.message, ErrorCode.UNKNOWN_ERROR, 500, false, errorContext);
    }

    if (typeof error === 'string') {
      return new AppError(error, ErrorCode.UNKNOWN_ERROR, 500, true, errorContext);
    }

    return new AppError(
      'An unknown error occurred',
      ErrorCode.UNKNOWN_ERROR,
      500,
      false,
      errorContext
    );
  }

  /**
   * 에러 콜백 실행
   */
  private static executeCallbacks(error: AppError): void {
    // 특정 에러 코드 콜백
    const callbacks = this.errorCallbacks.get(error.code);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(error);
        } catch (callbackError) {
          console.error('Error in error callback:', callbackError);
        }
      });
    }

    // 글로벌 콜백
    if (this.globalCallback) {
      try {
        this.globalCallback(error);
      } catch (callbackError) {
        console.error('Error in global error callback:', callbackError);
      }
    }
  }

  /**
   * 에러 로깅
   */
  private static logError(error: AppError): void {
    const logData = {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      context: error.context,
      details: error.details,
      stack: error.stack,
      timestamp: error.timestamp
    };

    if (error.statusCode >= 500) {
      console.error('Server Error:', logData);
    } else if (error.statusCode >= 400) {
      console.warn('Client Error:', logData);
    } else {
      console.info('Error:', logData);
    }
  }

  /**
   * Promise 거부 처리
   */
  static wrapPromise<T>(promise: Promise<T>, context?: Partial<ErrorContext>): Promise<T> {
    return promise.catch(error => {
      throw this.handle(error, context);
    });
  }

  /**
   * 비동기 함수 래핑
   */
  static wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: Partial<ErrorContext>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        throw this.handle(error, context);
      }
    };
  }
}

// ============ Utility Functions ============

/**
 * 안전한 JSON 파싱
 */
export function safeJsonParse<T = any>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return defaultValue;
  }
}

/**
 * 안전한 함수 실행
 */
export function safeExecute<T>(
  fn: () => T,
  defaultValue: T,
  context?: Partial<ErrorContext>
): T {
  try {
    return fn();
  } catch (error) {
    ErrorHandler.handle(error, context);
    return defaultValue;
  }
}

/**
 * 안전한 비동기 함수 실행
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  context?: Partial<ErrorContext>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    ErrorHandler.handle(error, context);
    return defaultValue;
  }
}

/**
 * 재시도 로직
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    delay: number;
    backoffMultiplier?: number;
    retryCondition?: (error: any) => boolean;
  }
): Promise<T> {
  const { maxRetries, delay, backoffMultiplier = 2, retryCondition } = options;
  
  let currentDelay = delay;
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      if (retryCondition && !retryCondition(error)) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
    }
  }
  
  throw lastError;
}

/**
 * 에러 메시지 포맷팅
 */
export function formatErrorMessage(error: AppError): string {
  const parts = [error.message];
  
  if (error.context?.service) {
    parts.push(`(Service: ${error.context.service})`);
  }
  
  if (error.context?.method) {
    parts.push(`(Method: ${error.context.method})`);
  }
  
  return parts.join(' ');
}

/**
 * 사용자 친화적 에러 메시지
 */
export function getUserFriendlyMessage(error: AppError): string {
  switch (error.code) {
    case ErrorCode.NETWORK_ERROR:
      return '네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.';
    case ErrorCode.UNAUTHORIZED:
      return '인증이 필요합니다. 다시 로그인해주세요.';
    case ErrorCode.FORBIDDEN:
      return '이 작업을 수행할 권한이 없습니다.';
    case ErrorCode.SERVICE_UNAVAILABLE:
      return '서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
    case ErrorCode.VALIDATION_ERROR:
      return '입력한 정보를 확인해주세요.';
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    default:
      return '예상치 못한 오류가 발생했습니다. 관리자에게 문의해주세요.';
  }
}

// ============ Development Helpers ============

if (process.env.NODE_ENV === 'development') {
  // 개발 환경에서만 활성화
  ErrorHandler.setGlobalErrorCallback((error) => {
    console.group(`🚨 Error: ${error.code}`);
    console.error('Message:', error.message);
    console.error('Context:', error.context);
    console.error('Details:', error.details);
    console.error('Stack:', error.stack);
    console.groupEnd();
  });
}

// 전역 에러 핸들러 설정
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    ErrorHandler.handle(event.error, {
      endpoint: window.location.pathname,
      userAgent: navigator.userAgent,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    ErrorHandler.handle(event.reason, {
      endpoint: window.location.pathname,
      userAgent: navigator.userAgent,
    });
  });
}