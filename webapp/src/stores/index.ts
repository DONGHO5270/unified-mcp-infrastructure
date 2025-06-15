/**
 * Zustand Store - Central State Management
 * 통합 MCP 인프라를 위한 중앙 상태 관리
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { 
  MCPService, 
  ServiceMetrics, 
  LogEntry, 
  SystemEvent, 
  Notification,
  User,
  ServiceStatus
} from '../types';
import { apiClient } from '../lib/api/client';
import { logger } from '../lib/utils/logger';
import { wsManager } from '../lib/websocket/client';

// ============ Store Types ============

export interface ServiceState {
  services: MCPService[];
  metrics: Record<string, ServiceMetrics>;
  selectedServiceId: string | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export interface LogState {
  logs: LogEntry[];
  filters: {
    services: string[];
    levels: string[];
    searchQuery: string;
    timeRange: string;
  };
  isStreaming: boolean;
  maxLogs: number;
}

export interface SystemState {
  events: SystemEvent[];
  notifications: Notification[];
  systemStatus: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    systemLoad: number;
    uptime: number;
  } | null;
  alertsEnabled: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface UIState {
  theme: 'light' | 'dark' | 'auto';
  sidebarCollapsed: boolean;
  selectedView: 'dashboard' | 'services' | 'logs' | 'metrics' | 'settings';
  modals: {
    serviceDetails: boolean;
    cliPrompt: boolean;
    settings: boolean;
  };
}

export interface AppState {
  services: ServiceState;
  logs: LogState;
  system: SystemState;
  auth: AuthState;
  ui: UIState;
}

// ============ Service Store ============

interface ServiceActions {
  // 데이터 페칭
  fetchServices: (signal?: AbortSignal) => Promise<void>;
  fetchMetrics: () => Promise<void>;
  fetchServiceDetails: (serviceId: string) => Promise<void>;
  
  // 서비스 액션
  restartService: (serviceId: string) => Promise<void>;
  updateServiceStatus: (serviceId: string, status: ServiceStatus) => void;
  
  // 실시간 업데이트
  handleServiceUpdate: (data: any) => void;
  handleMetricsUpdate: (data: any) => void;
  
  // 선택 관리
  selectService: (serviceId: string | null) => void;
  
  // 에러 처리
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useServiceStore = create<ServiceState & ServiceActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // 초기 상태
        services: [],
        metrics: {},
        selectedServiceId: null,
        loading: false,
        error: null,
        lastUpdated: null,

        // 서비스 목록 조회
        fetchServices: async (signal?: AbortSignal) => {
          set((state) => {
            state.loading = true;
            state.error = null;
          });

          try {
            const response = await apiClient.getServices(signal);
            if (response.success && response.data) {
              set((state) => {
                state.services = response.data!;
                state.lastUpdated = new Date().toISOString();
              });
            } else {
              throw new Error(response.error || 'Failed to fetch services');
            }
          } catch (error) {
            // AbortError는 무시
            if (error instanceof Error && error.name === 'AbortError') {
              console.log('fetchServices aborted');
              return;
            }
            logger.error('Failed to fetch services', error as Error);
            set((state) => {
              state.error = (error as Error).message;
            });
          } finally {
            set((state) => {
              state.loading = false;
            });
          }
        },

        // 메트릭 조회
        fetchMetrics: async () => {
          try {
            const response = await apiClient.getMetrics();
            if (response.success && response.data) {
              set((state) => {
                state.metrics = response.data!;
              });
            }
          } catch (error) {
            logger.error('Failed to fetch metrics', error as Error);
          }
        },

        // 서비스 상세 정보 조회
        fetchServiceDetails: async (serviceId: string) => {
          try {
            const response = await apiClient.getService(serviceId);
            if (response.success && response.data) {
              set((state) => {
                const index = state.services.findIndex(s => s.id === serviceId);
                if (index !== -1) {
                  state.services[index] = response.data!;
                }
              });
            }
          } catch (error) {
            logger.error('Failed to fetch service details', error as Error);
          }
        },

        // 서비스 재시작
        restartService: async (serviceId: string) => {
          try {
            const response = await apiClient.restartService(serviceId);
            if (response.success) {
              logger.info('Service restart initiated', { serviceId });
              // 상태 업데이트는 WebSocket 이벤트로 처리
            } else {
              throw new Error(response.error || 'Failed to restart service');
            }
          } catch (error) {
            logger.error('Failed to restart service', error as Error);
            throw error;
          }
        },

        // 서비스 상태 업데이트
        updateServiceStatus: (serviceId: string, status: ServiceStatus) => {
          set((state) => {
            const service = state.services.find(s => s.id === serviceId);
            if (service) {
              service.status = status;
              service.lastUpdated = new Date().toISOString();
            }
          });
        },

        // WebSocket 서비스 업데이트 처리
        handleServiceUpdate: (data: any) => {
          set((state) => {
            const { serviceId, status } = data;
            const service = state.services.find(s => s.id === serviceId);
            if (service) {
              service.status = status;
              service.lastUpdated = new Date().toISOString();
            }
          });
        },

        // WebSocket 메트릭 업데이트 처리
        handleMetricsUpdate: (data: any) => {
          set((state) => {
            const { serviceId, metrics } = data;
            state.metrics[serviceId] = metrics;
          });
        },

        // 서비스 선택
        selectService: (serviceId: string | null) => {
          set((state) => {
            state.selectedServiceId = serviceId;
          });
        },

        // 에러 설정
        setError: (error: string | null) => {
          set((state) => {
            state.error = error;
          });
        },

        // 에러 초기화
        clearError: () => {
          set((state) => {
            state.error = null;
          });
        }
      }))
    ),
    { name: 'service-store' }
  )
);

// ============ Log Store ============

interface LogActions {
  // 로그 관리
  addLog: (log: LogEntry) => void;
  addLogs: (logs: LogEntry[]) => void;
  clearLogs: () => void;
  
  // 필터 관리
  setFilters: (filters: Partial<LogState['filters']>) => void;
  resetFilters: () => void;
  
  // 스트리밍 제어
  startStreaming: () => void;
  stopStreaming: () => void;
  
  // 설정
  setMaxLogs: (max: number) => void;
}

export const useLogStore = create<LogState & LogActions>()(
  devtools(
    persist(
      immer((set) => ({
        // 초기 상태
        logs: [],
        filters: {
          services: [],
          levels: [],
          searchQuery: '',
          timeRange: '1h'
        },
        isStreaming: false,
        maxLogs: 1000,

        // 단일 로그 추가
        addLog: (log: LogEntry) => {
          set((state) => {
            state.logs.unshift(log);
            
            // 최대 개수 유지
            if (state.logs.length > state.maxLogs) {
              state.logs.pop();
            }
          });
        },

        // 다중 로그 추가
        addLogs: (logs: LogEntry[]) => {
          set((state) => {
            state.logs.unshift(...logs);
            
            // 최대 개수 유지
            if (state.logs.length > state.maxLogs) {
              state.logs = state.logs.slice(0, state.maxLogs);
            }
          });
        },

        // 로그 초기화
        clearLogs: () => {
          set((state) => {
            state.logs = [];
          });
        },

        // 필터 설정
        setFilters: (filters: Partial<LogState['filters']>) => {
          set((state) => {
            Object.assign(state.filters, filters);
          });
        },

        // 필터 초기화
        resetFilters: () => {
          set((state) => {
            state.filters = {
              services: [],
              levels: [],
              searchQuery: '',
              timeRange: '1h'
            };
          });
        },

        // 스트리밍 시작
        startStreaming: () => {
          set((state) => {
            state.isStreaming = true;
          });
        },

        // 스트리밍 중지
        stopStreaming: () => {
          set((state) => {
            state.isStreaming = false;
          });
        },

        // 최대 로그 개수 설정
        setMaxLogs: (max: number) => {
          set((state) => {
            state.maxLogs = max;
            if (state.logs.length > max) {
              state.logs = state.logs.slice(0, max);
            }
          });
        }
      })),
      {
        name: 'log-store',
        partialize: (state) => ({
          filters: state.filters,
          maxLogs: state.maxLogs
        })
      }
    ),
    { name: 'log-store' }
  )
);

// ============ System Store ============

interface SystemActions {
  // 이벤트 관리
  addEvent: (event: SystemEvent) => void;
  acknowledgeEvent: (eventId: string) => void;
  
  // 알림 관리
  addNotification: (notification: Notification) => void;
  markNotificationRead: (notificationId: string) => void;
  clearNotifications: () => void;
  
  // 시스템 상태
  updateSystemStatus: (status: SystemState['systemStatus']) => void;
  fetchSystemStatus: () => Promise<void>;
  
  // 설정
  toggleAlerts: () => void;
}

export const useSystemStore = create<SystemState & SystemActions>()(
  devtools(
    immer((set) => ({
      // 초기 상태
      events: [],
      notifications: [],
      systemStatus: null,
      alertsEnabled: true,

      // 이벤트 추가
      addEvent: (event: SystemEvent) => {
        set((state) => {
          state.events.unshift(event);
          
          // 최대 100개 유지
          if (state.events.length > 100) {
            state.events.pop();
          }
        });
      },

      // 이벤트 확인
      acknowledgeEvent: (eventId: string) => {
        set((state) => {
          const event = state.events.find(e => e.id === eventId);
          if (event) {
            event.acknowledged = true;
            event.acknowledgedAt = new Date().toISOString();
          }
        });
      },

      // 알림 추가
      addNotification: (notification: Notification) => {
        set((state) => {
          state.notifications.unshift(notification);
          
          // 최대 50개 유지
          if (state.notifications.length > 50) {
            state.notifications.pop();
          }
        });
      },

      // 알림 읽음 처리
      markNotificationRead: (notificationId: string) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === notificationId);
          if (notification) {
            notification.read = true;
          }
        });
      },

      // 알림 초기화
      clearNotifications: () => {
        set((state) => {
          state.notifications = [];
        });
      },

      // 시스템 상태 업데이트
      updateSystemStatus: (status: SystemState['systemStatus']) => {
        set((state) => {
          state.systemStatus = status;
        });
      },

      // 시스템 상태 가져오기
      fetchSystemStatus: async () => {
        try {
          const response = await apiClient.getSystemStatus();
          if (response.success && response.data) {
            set((state) => {
              state.systemStatus = response.data!;
            });
          }
        } catch (error) {
          logger.error('Failed to fetch system status', error as Error);
        }
      },

      // 알림 토글
      toggleAlerts: () => {
        set((state) => {
          state.alertsEnabled = !state.alertsEnabled;
        });
      }
    })),
    { name: 'system-store' }
  )
);

// ============ Auth Store ============

interface AuthActions {
  // 인증 액션
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  
  // 사용자 관리
  updateUser: (user: Partial<User>) => void;
  
  // 상태 관리
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    persist(
      immer((set) => ({
        // 초기 상태
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // 로그인
        login: async (credentials) => {
          console.log('[useAuthStore.login] Starting login with credentials:', { username: credentials.username });
          
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            console.log('[useAuthStore.login] Importing AuthService...');
            const { AuthService } = await import('../lib/auth/security');
            console.log('[useAuthStore.login] AuthService imported successfully');
            
            console.log('[useAuthStore.login] Calling AuthService.login...');
            
            // HMR 보호: 모듈 재로드 감지
            const moduleTimestamp = Date.now();
            console.log('[useAuthStore.login] Module timestamp:', moduleTimestamp);
            
            const user = await AuthService.login(credentials);
            console.log('[useAuthStore.login] AuthService.login returned user:', user);
            console.log('[useAuthStore.login] User validation - type:', typeof user, 'id:', user?.id);
            
            // 최종 검증
            if (!user || !user.id) {
              console.error('[useAuthStore.login] STORE ERROR: Invalid user returned from AuthService');
              throw new Error('Invalid user object returned from login service');
            }
            
            set((state) => {
              state.user = user;
              state.isAuthenticated = true;
            });
            
            console.log('[useAuthStore.login] Login completed successfully');
          } catch (error) {
            console.error('[useAuthStore.login] Login error caught:', error);
            console.error('[useAuthStore.login] Error type:', typeof error);
            console.error('[useAuthStore.login] Error message:', (error as Error).message);
            console.error('[useAuthStore.login] Error stack:', (error as Error).stack);
            
            set((state) => {
              state.error = (error as Error).message;
            });
            throw error;
          } finally {
            set((state) => {
              state.isLoading = false;
            });
          }
        },

        // 로그아웃
        logout: async () => {
          try {
            const { AuthService } = await import('../lib/auth/security');
            await AuthService.logout();
            
            set((state) => {
              state.user = null;
              state.isAuthenticated = false;
              state.error = null;
            });
          } catch (error) {
            logger.error('Logout error', error as Error);
          }
        },

        // 사용자 정보 업데이트
        updateUser: (userData: Partial<User>) => {
          set((state) => {
            if (state.user) {
              Object.assign(state.user, userData);
            }
          });
        },

        // 로딩 상태 설정
        setLoading: (loading: boolean) => {
          set((state) => {
            state.isLoading = loading;
          });
        },

        // 에러 설정
        setError: (error: string | null) => {
          set((state) => {
            state.error = error;
          });
        }
      })),
      {
        name: 'auth-store',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated
        })
      }
    ),
    { name: 'auth-store' }
  )
);

// ============ UI Store ============

interface UIActions {
  // 테마 관리
  setTheme: (theme: UIState['theme']) => void;
  
  // 레이아웃 관리
  toggleSidebar: () => void;
  selectView: (view: UIState['selectedView']) => void;
  
  // 모달 관리
  openModal: (modal: keyof UIState['modals']) => void;
  closeModal: (modal: keyof UIState['modals']) => void;
  closeAllModals: () => void;
}

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    persist(
      immer((set) => ({
        // 초기 상태
        theme: 'auto',
        sidebarCollapsed: false,
        selectedView: 'dashboard',
        modals: {
          serviceDetails: false,
          cliPrompt: false,
          settings: false
        },

        // 테마 설정
        setTheme: (theme: UIState['theme']) => {
          set((state) => {
            state.theme = theme;
          });
        },

        // 사이드바 토글
        toggleSidebar: () => {
          set((state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed;
          });
        },

        // 뷰 선택
        selectView: (view: UIState['selectedView']) => {
          set((state) => {
            state.selectedView = view;
          });
        },

        // 모달 열기
        openModal: (modal: keyof UIState['modals']) => {
          set((state) => {
            state.modals[modal] = true;
          });
        },

        // 모달 닫기
        closeModal: (modal: keyof UIState['modals']) => {
          set((state) => {
            state.modals[modal] = false;
          });
        },

        // 모든 모달 닫기
        closeAllModals: () => {
          set((state) => {
            Object.keys(state.modals).forEach(key => {
              state.modals[key as keyof UIState['modals']] = false;
            });
          });
        }
      })),
      {
        name: 'ui-store',
        partialize: (state) => ({
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed
        })
      }
    ),
    { name: 'ui-store' }
  )
);

// ============ Store Hooks & Utilities ============

/**
 * WebSocket 이벤트 연결
 */
export function connectWebSocketEvents(): void {
  const serviceWS = wsManager.getServiceStatusWS();
  const logWS = wsManager.getLogStreamWS();
  const alertWS = wsManager.getSystemAlertWS();

  // 서비스 업데이트
  serviceWS.onServiceUpdate((data) => {
    useServiceStore.getState().handleServiceUpdate(data);
  });

  // 메트릭 업데이트
  serviceWS.onMetricsUpdate((data) => {
    useServiceStore.getState().handleMetricsUpdate(data);
  });

  // 로그 엔트리
  logWS.onLogEntry((log) => {
    useLogStore.getState().addLog(log);
  });

  // 시스템 알림
  alertWS.onSystemAlert((alert) => {
    const { addEvent, addNotification, alertsEnabled } = useSystemStore.getState();
    
    addEvent({
      id: alert.id || `evt_${Date.now()}`,
      type: alert.type || 'system_alert',
      source: alert.source || 'system',
      timestamp: alert.timestamp || new Date().toISOString(),
      severity: alert.severity || 'medium',
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata || {},
      acknowledged: false
    });

    if (alertsEnabled) {
      addNotification({
        id: `notif_${Date.now()}`,
        userId: useAuthStore.getState().user?.id || '',
        type: 'warning',
        title: alert.title,
        message: alert.message,
        timestamp: new Date().toISOString(),
        read: false
      });
    }
  });
}

/**
 * 스토어 초기화
 */
let storeInitialized = false;
let initPromise: Promise<void> | null = null;

export async function initializeStores(): Promise<void> {
  // 이미 초기화되었거나 진행 중인 경우 방지
  if (storeInitialized) {
    logger.debug('Stores already initialized, skipping...');
    return;
  }
  
  if (initPromise) {
    logger.debug('Store initialization in progress, waiting...');
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // WebSocket 연결
      try {
        await wsManager.connectAll();
        connectWebSocketEvents();
        logger.info('WebSocket connections established');
      } catch (error) {
        logger.error('Failed to establish WebSocket connections', error as Error);
        // WebSocket 실패해도 계속 진행
      }

      // 초기 데이터 로드
      const { fetchServices, fetchMetrics } = useServiceStore.getState();
      
      try {
        await Promise.all([
          fetchServices(),
          fetchMetrics()
        ]);
        logger.info('Initial data loaded');
      } catch (error) {
        logger.error('Failed to load initial data', error as Error);
        // 데이터 로드 실패해도 계속 진행
      }
      
      storeInitialized = true;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * 스토어 정리
 */
export function cleanupStores(): void {
  wsManager.disconnectAll();
  logger.info('Stores cleaned up');
}

// 브라우저 언로드 시 정리
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cleanupStores();
  });
}