/**
 * API Client Library for MCP Infrastructure
 * 통합 MCP 인프라를 위한 API 클라이언트 라이브러리
 */

import { MCPService, ServiceMetrics, CLIPromptData } from '../../types';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(baseUrl: string = 'http://localhost:3100', timeout: number = 10000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * 인증 토큰 설정
   */
  setAuthToken(token: string): void {
    this.headers['Authorization'] = `Bearer ${token}`;
  }

  /**
   * 인증 토큰 제거
   */
  clearAuthToken(): void {
    delete this.headers['Authorization'];
  }

  /**
   * 기본 URL 반환
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * 기본 HTTP 요청 메서드
   */
  public async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      // 외부에서 전달된 signal이 있으면 사용, 없으면 새로 생성
      const controller = options.signal ? null : new AbortController();
      const signal = options.signal || controller?.signal;
      
      const timeoutId = controller ? setTimeout(() => controller.abort(), this.timeout) : null;

      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
        signal: signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      console.log(`[ApiClient] Response status: ${response.status} ${response.statusText}`);
      console.log(`[ApiClient] Response headers:`, Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log(`[ApiClient] Raw response text:`, responseText);
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log(`[ApiClient] Parsed response data:`, responseData);
      } catch (parseError) {
        console.error(`[ApiClient] JSON parse error:`, parseError);
        return {
          success: false,
          error: `Invalid JSON response: ${parseError}`,
          timestamp: new Date().toISOString(),
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: responseData.message || responseData.error || `HTTP ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      // Handle backend response format
      // If the backend already returns { success, data }, extract the inner data
      if (responseData && typeof responseData === 'object' && 'success' in responseData && 'data' in responseData) {
        console.log(`[ApiClient] Detected nested response format, extracting inner data`);
        console.log(`[ApiClient] responseData.success:`, responseData.success);
        console.log(`[ApiClient] responseData.data:`, responseData.data);
        console.log(`[ApiClient] responseData.data type:`, typeof responseData.data);
        
        // 로그인 응답 특별 검증
        if (endpoint.includes('/auth/login') && responseData.data) {
          console.log(`[ApiClient] LOGIN RESPONSE VALIDATION:`);
          console.log(`[ApiClient] data.user:`, responseData.data.user);
          console.log(`[ApiClient] data.user.id:`, responseData.data.user?.id);
          console.log(`[ApiClient] data.accessToken:`, responseData.data.accessToken ? '[PRESENT]' : '[MISSING]');
          console.log(`[ApiClient] data.refreshToken:`, responseData.data.refreshToken ? '[PRESENT]' : '[MISSING]');
        }
        
        const result = {
          success: responseData.success,
          data: responseData.data,
          error: responseData.error,
          timestamp: new Date().toISOString(),
        };
        console.log(`[ApiClient] Final response to return:`, result);
        return result;
      }

      // Otherwise, treat the entire response as data
      console.log(`[ApiClient] Using entire response as data`);
      return {
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============ MCP Services API ============

  /**
   * 모든 MCP 서비스 목록 조회
   */
  async getServices(signal?: AbortSignal): Promise<ApiResponse<MCPService[]>> {
    return this.request<MCPService[]>('/api/services', signal ? { signal } : {});
  }

  /**
   * 특정 MCP 서비스 상세 정보 조회
   */
  async getService(serviceId: string): Promise<ApiResponse<MCPService>> {
    return this.request<MCPService>(`/api/services/${serviceId}`);
  }

  /**
   * MCP 서비스 상태 업데이트
   */
  async updateServiceStatus(
    serviceId: string, 
    status: 'healthy' | 'degraded' | 'unhealthy'
  ): Promise<ApiResponse<MCPService>> {
    return this.request<MCPService>(`/api/services/${serviceId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  /**
   * MCP 서비스 재시작
   */
  async restartService(serviceId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(`/api/services/${serviceId}/restart`, {
      method: 'POST',
    });
  }

  // ============ Metrics API ============

  /**
   * 모든 서비스 메트릭 조회
   */
  async getMetrics(): Promise<ApiResponse<Record<string, ServiceMetrics>>> {
    return this.request<Record<string, ServiceMetrics>>('/api/metrics');
  }

  /**
   * 특정 서비스 메트릭 조회
   */
  async getServiceMetrics(serviceId: string): Promise<ApiResponse<ServiceMetrics>> {
    return this.request<ServiceMetrics>(`/api/metrics/${serviceId}`);
  }

  /**
   * 시계열 메트릭 데이터 조회
   */
  async getTimeSeriesMetrics(
    serviceId: string,
    timeRange: '1h' | '6h' | '24h' | '7d'
  ): Promise<ApiResponse<Array<{ timestamp: string; metrics: ServiceMetrics }>>> {
    return this.request(`/api/metrics/${serviceId}/timeseries?range=${timeRange}`);
  }

  // ============ MCP Protocol API ============

  /**
   * MCP 서비스에 직접 JSON-RPC 요청
   */
  async mcpRequest(
    serviceId: string,
    method: string,
    params: any = {}
  ): Promise<ApiResponse<any>> {
    return this.request(`/mcp/${serviceId}`, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `request_${Date.now()}`,
        method,
        params,
      }),
    });
  }

  /**
   * MCP 서비스의 사용 가능한 도구 목록 조회
   */
  async getServiceTools(serviceId: string): Promise<ApiResponse<any[]>> {
    return this.mcpRequest(serviceId, 'tools/list');
  }

  /**
   * MCP 도구 실행
   */
  async executeTool(
    serviceId: string,
    toolName: string,
    arguments_: Record<string, any> = {}
  ): Promise<ApiResponse<any>> {
    return this.mcpRequest(serviceId, 'tools/call', {
      name: toolName,
      arguments: arguments_,
    });
  }

  // ============ Logs API ============

  /**
   * 서비스 로그 조회
   */
  async getServiceLogs(
    serviceId: string,
    options: {
      lines?: number;
      since?: string;
      follow?: boolean;
    } = {}
  ): Promise<ApiResponse<string[]>> {
    const params = new URLSearchParams();
    if (options.lines) params.append('lines', options.lines.toString());
    if (options.since) params.append('since', options.since);
    if (options.follow) params.append('follow', 'true');

    const endpoint = `/api/logs/${serviceId}${params.toString() ? `?${params.toString()}` : ''}`;
    return this.request<string[]>(endpoint);
  }

  // ============ System API ============

  /**
   * 시스템 전체 상태 조회
   */
  async getSystemStatus(): Promise<ApiResponse<{
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    systemLoad: number;
    uptime: number;
  }>> {
    return this.request('/api/system/status');
  }

  /**
   * 시스템 헬스 체크
   */
  async healthCheck(): Promise<ApiResponse<{ status: 'ok' | 'error'; timestamp: string }>> {
    return this.request('/api/health');
  }

  // ============ Authentication API ============

  /**
   * CLI 토큰 생성
   */
  async generateCLIToken(permissions: string[]): Promise<ApiResponse<{ token: string; expiresAt: string }>> {
    return this.request('/api/auth/cli-token', {
      method: 'POST',
      body: JSON.stringify({ permissions }),
    });
  }

  /**
   * 토큰 검증
   */
  async validateToken(): Promise<ApiResponse<{ valid: boolean; permissions: string[] }>> {
    return this.request('/api/auth/validate');
  }
}

// 싱글톤 인스턴스 생성
export const apiClient = new ApiClient();

// 개발 환경에서 글로벌 접근 가능하도록 설정
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).apiClient = apiClient;
}