/**
 * WebSocket Client for Real-time Communication
 * 통합 MCP 인프라를 위한 실시간 WebSocket 통신 클라이언트
 */

import { logger } from '../utils/logger';
import { ErrorHandler, NetworkError } from '../utils/error-handler';
import { TokenManager } from '../auth/security';
import { WebSocketMessage, ServiceUpdateData, LogEntry, ServiceMetrics } from '../../types';

// ============ WebSocket Event Types ============

export enum WSEventType {
  // Connection Events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  RECONNECT = 'reconnect',
  
  // Service Events
  SERVICE_UPDATE = 'service_update',
  SERVICE_CREATED = 'service_created',
  SERVICE_DELETED = 'service_deleted',
  
  // Metrics Events
  METRICS_UPDATE = 'metrics_update',
  METRICS_BATCH = 'metrics_batch',
  
  // Log Events
  LOG_ENTRY = 'log_entry',
  LOG_BATCH = 'log_batch',
  
  // System Events
  SYSTEM_ALERT = 'system_alert',
  SYSTEM_STATUS = 'system_status',
  
  // Custom Events
  CUSTOM = 'custom'
}

export interface WSClientOptions {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectDelay?: number;
  reconnectMaxDelay?: number;
  reconnectBackoffMultiplier?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  requestTimeout?: number;
  enableCompression?: boolean;
}

export interface WSSubscription {
  id: string;
  event: WSEventType;
  callback: (data: any) => void;
  once?: boolean;
}

// ============ WebSocket Client Class ============

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private options: Required<WSClientOptions>;
  private subscriptions: Map<string, WSSubscription> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isDestroyed = false;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(url: string, options: Partial<WSClientOptions> = {}) {
    this.url = url;
    this.options = {
      url,
      protocols: [],
      reconnect: true,
      reconnectDelay: 1000,
      reconnectMaxDelay: 30000,
      reconnectBackoffMultiplier: 1.5,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      requestTimeout: 30000,
      enableCompression: true,
      ...options
    };
  }

  /**
   * WebSocket 연결
   */
  async connect(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('WebSocket client has been destroyed');
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.debug('WebSocket already connected');
      return;
    }

    if (this.isConnecting) {
      logger.debug('WebSocket connection already in progress');
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        // 인증 토큰 추가
        const token = TokenManager.getAccessToken();
        const wsUrl = new URL(this.url);
        
        if (token) {
          wsUrl.searchParams.set('token', token);
        }

        // WebSocket 생성
        this.ws = new WebSocket(wsUrl.toString(), this.options.protocols);

        // 이벤트 핸들러 설정
        this.ws.onopen = () => {
          logger.info('WebSocket connected', { url: this.url });
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit(WSEventType.CONNECT, { timestamp: new Date().toISOString() });
          resolve();
        };

        this.ws.onclose = (event) => {
          logger.info('WebSocket disconnected', { 
            code: event.code, 
            reason: event.reason,
            wasClean: event.wasClean 
          });
          
          this.isConnecting = false;
          this.stopHeartbeat();
          this.cleanup();
          
          this.emit(WSEventType.DISCONNECT, { 
            code: event.code,
            reason: event.reason,
            timestamp: new Date().toISOString()
          });

          // 자동 재연결
          if (this.options.reconnect && !this.isDestroyed && !event.wasClean) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (event) => {
          logger.error('WebSocket error', new Error('WebSocket connection failed'));
          this.isConnecting = false;
          
          const error = new NetworkError('WebSocket connection failed');
          this.emit(WSEventType.ERROR, { error, timestamp: new Date().toISOString() });
          
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

      } catch (error) {
        this.isConnecting = false;
        logger.error('Failed to create WebSocket', error as Error);
        reject(error);
      }
    });
  }

  /**
   * WebSocket 연결 해제
   */
  disconnect(code: number = 1000, reason: string = 'Normal closure'): void {
    this.isDestroyed = true;
    this.cancelReconnect();
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }
    
    this.cleanup();
    logger.info('WebSocket client disconnected');
  }

  /**
   * 메시지 전송
   */
  send(type: string, data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket is not connected, message not sent', { type, data });
      // 연결되지 않은 경우 재연결 시도
      if (!this.isConnecting && !this.isDestroyed) {
        this.connect().catch(error => {
          logger.error('Failed to reconnect WebSocket', error);
        });
      }
      return; // 에러를 던지지 않고 조용히 실패
    }

    const message: WebSocketMessage = {
      type: type as any,
      data,
      timestamp: new Date().toISOString()
    };

    try {
      this.ws.send(JSON.stringify(message));
      logger.debug('WebSocket message sent', { type, data });
    } catch (error) {
      logger.error('Failed to send WebSocket message', error as Error);
      // 연결 문제일 수 있으므로 재연결 시도
      if (!this.isConnecting && !this.isDestroyed) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * 요청-응답 패턴
   */
  async request<T = any>(type: string, data: any): Promise<T> {
    const requestId = this.generateRequestId();
    
    return new Promise((resolve, reject) => {
      // 타임아웃 설정
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }, this.options.requestTimeout);

      // 요청 저장
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // 메시지 전송
      try {
        this.send(type, { ...data, requestId });
      } catch (error) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * 이벤트 구독
   */
  subscribe(event: WSEventType, callback: (data: any) => void, once = false): string {
    const subscription: WSSubscription = {
      id: this.generateSubscriptionId(),
      event,
      callback,
      once
    };

    this.subscriptions.set(subscription.id, subscription);
    logger.debug('WebSocket event subscribed', { event, subscriptionId: subscription.id });
    
    return subscription.id;
  }

  /**
   * 이벤트 구독 해제
   */
  unsubscribe(subscriptionId: string): void {
    if (this.subscriptions.delete(subscriptionId)) {
      logger.debug('WebSocket event unsubscribed', { subscriptionId });
    }
  }

  /**
   * 일회성 이벤트 구독
   */
  once(event: WSEventType, callback: (data: any) => void): string {
    return this.subscribe(event, callback, true);
  }

  /**
   * 이벤트 발생
   */
  private emit(event: WSEventType, data: any): void {
    const subscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.event === event);

    subscriptions.forEach(sub => {
      try {
        sub.callback(data);
        
        if (sub.once) {
          this.subscriptions.delete(sub.id);
        }
      } catch (error) {
        logger.error('Error in WebSocket event handler', error as Error, {
          event,
          subscriptionId: sub.id
        });
      }
    });
  }

  /**
   * 메시지 처리
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      logger.debug('WebSocket message received', { type: message.type });

      // 요청-응답 처리
      if (message.data?.requestId) {
        const pending = this.pendingRequests.get(message.data.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.data.requestId);
          
          if (message.data.error) {
            pending.reject(new Error(message.data.error));
          } else {
            pending.resolve(message.data);
          }
          return;
        }
      }

      // 이벤트 타입별 처리
      switch (message.type) {
        case 'service_update':
          this.emit(WSEventType.SERVICE_UPDATE, message.data);
          break;
          
        case 'metrics_update':
          this.emit(WSEventType.METRICS_UPDATE, message.data);
          break;
          
        case 'log_entry':
          this.emit(WSEventType.LOG_ENTRY, message.data);
          break;
          
        case 'system_alert':
          this.emit(WSEventType.SYSTEM_ALERT, message.data);
          break;
          
        default:
          this.emit(WSEventType.CUSTOM, message);
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', error as Error);
    }
  }

  /**
   * 하트비트 시작
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.send('ping', { timestamp: Date.now() });
        } catch (error) {
          logger.error('Heartbeat failed', error as Error);
        }
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * 하트비트 중지
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.emit(WSEventType.ERROR, { 
        error: new Error('Max reconnection attempts reached'),
        timestamp: new Date().toISOString()
      });
      return;
    }

    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(this.options.reconnectBackoffMultiplier, this.reconnectAttempts),
      this.options.reconnectMaxDelay
    );

    this.reconnectAttempts++;
    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts}`, { delayMs: delay });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.emit(WSEventType.RECONNECT, { 
          attempts: this.reconnectAttempts,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Reconnection failed', error as Error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * 재연결 취소
   */
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 정리 작업
   */
  private cleanup(): void {
    // 대기 중인 요청 정리
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('WebSocket connection closed'));
    });
    this.pendingRequests.clear();
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 구독 ID 생성
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 연결 상태 확인
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 연결 상태 조회
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// ============ Specialized WebSocket Clients ============

/**
 * 서비스 상태 WebSocket 클라이언트
 */
export class ServiceStatusWebSocket extends WebSocketClient {
  constructor(baseUrl: string) {
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/services';
    super(wsUrl);
  }

  /**
   * 서비스 상태 업데이트 구독
   */
  onServiceUpdate(callback: (data: ServiceUpdateData) => void): string {
    return this.subscribe(WSEventType.SERVICE_UPDATE, callback);
  }

  /**
   * 메트릭 업데이트 구독
   */
  onMetricsUpdate(callback: (data: { serviceId: string; metrics: ServiceMetrics }) => void): string {
    return this.subscribe(WSEventType.METRICS_UPDATE, callback);
  }
}

/**
 * 로그 스트리밍 WebSocket 클라이언트
 */
export class LogStreamWebSocket extends WebSocketClient {
  constructor(baseUrl: string) {
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/logs';
    super(wsUrl);
  }

  /**
   * 로그 엔트리 구독
   */
  onLogEntry(callback: (log: LogEntry) => void): string {
    return this.subscribe(WSEventType.LOG_ENTRY, callback);
  }

  /**
   * 특정 서비스 로그 구독
   */
  subscribeToService(serviceId: string): void {
    this.send('subscribe_service', { serviceId });
  }

  /**
   * 특정 서비스 로그 구독 해제
   */
  unsubscribeFromService(serviceId: string): void {
    this.send('unsubscribe_service', { serviceId });
  }

  /**
   * 로그 레벨 필터 설정
   */
  setLogLevelFilter(levels: string[]): void {
    this.send('set_filter', { levels });
  }
}

/**
 * 시스템 알림 WebSocket 클라이언트
 */
export class SystemAlertWebSocket extends WebSocketClient {
  constructor(baseUrl: string) {
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/alerts';
    super(wsUrl);
  }

  /**
   * 시스템 알림 구독
   */
  onSystemAlert(callback: (alert: any) => void): string {
    return this.subscribe(WSEventType.SYSTEM_ALERT, callback);
  }

  /**
   * 알림 확인
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.request('acknowledge_alert', { alertId });
  }
}

// ============ WebSocket Manager ============

export class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * 서비스 상태 WebSocket 조회
   */
  getServiceStatusWS(): ServiceStatusWebSocket {
    const key = 'service-status';
    if (!this.clients.has(key)) {
      this.clients.set(key, new ServiceStatusWebSocket(this.baseUrl));
    }
    return this.clients.get(key) as ServiceStatusWebSocket;
  }

  /**
   * 로그 스트림 WebSocket 조회
   */
  getLogStreamWS(): LogStreamWebSocket {
    const key = 'log-stream';
    if (!this.clients.has(key)) {
      this.clients.set(key, new LogStreamWebSocket(this.baseUrl));
    }
    return this.clients.get(key) as LogStreamWebSocket;
  }

  /**
   * 시스템 알림 WebSocket 조회
   */
  getSystemAlertWS(): SystemAlertWebSocket {
    const key = 'system-alert';
    if (!this.clients.has(key)) {
      this.clients.set(key, new SystemAlertWebSocket(this.baseUrl));
    }
    return this.clients.get(key) as SystemAlertWebSocket;
  }

  /**
   * 모든 WebSocket 연결
   */
  async connectAll(): Promise<void> {
    const promises = Array.from(this.clients.values())
      .map(client => client.connect());
    await Promise.all(promises);
  }

  /**
   * 모든 WebSocket 연결 해제
   */
  disconnectAll(): void {
    this.clients.forEach(client => client.disconnect());
    this.clients.clear();
  }
}

// 싱글톤 인스턴스
export const wsManager = new WebSocketManager(
  process.env.REACT_APP_API_URL || 'http://localhost:3100'
);