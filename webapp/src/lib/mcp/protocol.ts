/**
 * MCP Protocol Wrapper
 * Model Context Protocol JSON-RPC 통신을 위한 타입 안전한 래퍼
 */

import { apiClient } from '../api/client';

// ============ MCP JSON-RPC Types ============

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse<T = any> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// ============ MCP Tool Types ============

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// ============ MCP Resource Types ============

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// ============ MCP Protocol Wrapper Class ============

export class MCPProtocolWrapper {
  private requestId = 0;

  private generateId(): string {
    return `mcp_${Date.now()}_${++this.requestId}`;
  }

  /**
   * MCP 서비스 초기화
   */
  async initialize(serviceId: string): Promise<{
    protocolVersion: string;
    capabilities: any;
    serverInfo: any;
  }> {
    const response = await apiClient.mcpRequest(serviceId, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
      },
      clientInfo: {
        name: 'MCP Infrastructure Dashboard',
        version: '1.0.0',
      },
    });

    if (!response.success) {
      throw new Error(`MCP 초기화 실패: ${response.error}`);
    }

    return response.data?.result;
  }

  /**
   * 서비스의 사용 가능한 도구 목록 조회
   */
  async listTools(serviceId: string): Promise<MCPTool[]> {
    const response = await apiClient.mcpRequest(serviceId, 'tools/list');
    
    if (!response.success) {
      throw new Error(`도구 목록 조회 실패: ${response.error}`);
    }

    return response.data?.result?.tools || [];
  }

  /**
   * 특정 도구 정보 조회
   */
  async getTool(serviceId: string, toolName: string): Promise<MCPTool | null> {
    const tools = await this.listTools(serviceId);
    return tools.find(tool => tool.name === toolName) || null;
  }

  /**
   * 도구 실행
   */
  async callTool(serviceId: string, toolCall: MCPToolCall): Promise<MCPToolResult> {
    const response = await apiClient.mcpRequest(serviceId, 'tools/call', {
      name: toolCall.name,
      arguments: toolCall.arguments,
    });

    if (!response.success) {
      throw new Error(`도구 실행 실패: ${response.error}`);
    }

    const result = response.data?.result;
    if (response.data?.error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${response.data.error.message}`,
        }],
        isError: true,
      };
    }

    return result;
  }

  /**
   * 서비스의 사용 가능한 리소스 목록 조회
   */
  async listResources(serviceId: string): Promise<MCPResource[]> {
    const response = await apiClient.mcpRequest(serviceId, 'resources/list');
    
    if (!response.success) {
      throw new Error(`리소스 목록 조회 실패: ${response.error}`);
    }

    return response.data?.result?.resources || [];
  }

  /**
   * 리소스 내용 조회
   */
  async readResource(serviceId: string, uri: string): Promise<MCPResourceContent> {
    const response = await apiClient.mcpRequest(serviceId, 'resources/read', { uri });
    
    if (!response.success) {
      throw new Error(`리소스 읽기 실패: ${response.error}`);
    }

    return response.data?.result?.contents?.[0];
  }

  /**
   * 프롬프트 목록 조회
   */
  async listPrompts(serviceId: string): Promise<any[]> {
    const response = await apiClient.mcpRequest(serviceId, 'prompts/list');
    
    if (!response.success) {
      throw new Error(`프롬프트 목록 조회 실패: ${response.error}`);
    }

    return response.data?.result?.prompts || [];
  }

  /**
   * 프롬프트 실행
   */
  async getPrompt(serviceId: string, name: string, arguments_?: Record<string, any>): Promise<any> {
    const response = await apiClient.mcpRequest(serviceId, 'prompts/get', {
      name,
      arguments: arguments_,
    });
    
    if (!response.success) {
      throw new Error(`프롬프트 실행 실패: ${response.error}`);
    }

    return response.data?.result;
  }

  /**
   * 로그 이벤트 전송
   */
  async sendLog(serviceId: string, level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency', data: any, logger?: string): Promise<void> {
    await apiClient.mcpRequest(serviceId, 'logging/setLevel', {
      level,
      data,
      logger,
    });
  }

  /**
   * 완료 알림 (자동완성, 힌트 등)
   */
  async requestCompletion(serviceId: string, ref: any, argument?: any): Promise<any> {
    const response = await apiClient.mcpRequest(serviceId, 'completion/complete', {
      ref,
      argument,
    });
    
    if (!response.success) {
      throw new Error(`완료 요청 실패: ${response.error}`);
    }

    return response.data?.result;
  }
}

// ============ High-Level Service Wrappers ============

/**
 * 특정 MCP 서비스를 위한 고수준 래퍼
 */
export class MCPService {
  private protocol: MCPProtocolWrapper;
  private serviceId: string;
  private _tools: MCPTool[] | null = null;
  private _resources: MCPResource[] | null = null;

  constructor(serviceId: string) {
    this.serviceId = serviceId;
    this.protocol = new MCPProtocolWrapper();
  }

  /**
   * 서비스 초기화
   */
  async initialize(): Promise<void> {
    await this.protocol.initialize(this.serviceId);
    // 도구와 리소스를 미리 로드
    await this.loadTools();
    await this.loadResources();
  }

  /**
   * 도구 목록 로드
   */
  private async loadTools(): Promise<void> {
    try {
      this._tools = await this.protocol.listTools(this.serviceId);
    } catch (error) {
      console.warn(`Failed to load tools for ${this.serviceId}:`, error);
      this._tools = [];
    }
  }

  /**
   * 리소스 목록 로드
   */
  private async loadResources(): Promise<void> {
    try {
      this._resources = await this.protocol.listResources(this.serviceId);
    } catch (error) {
      console.warn(`Failed to load resources for ${this.serviceId}:`, error);
      this._resources = [];
    }
  }

  /**
   * 사용 가능한 도구 목록
   */
  get tools(): MCPTool[] {
    return this._tools || [];
  }

  /**
   * 사용 가능한 리소스 목록
   */
  get resources(): MCPResource[] {
    return this._resources || [];
  }

  /**
   * 도구 실행 (간편 인터페이스)
   */
  async execute(toolName: string, args: Record<string, any> = {}): Promise<MCPToolResult> {
    return this.protocol.callTool(this.serviceId, { name: toolName, arguments: args });
  }

  /**
   * 특정 도구 존재 여부 확인
   */
  hasTool(toolName: string): boolean {
    return this.tools.some(tool => tool.name === toolName);
  }

  /**
   * 리소스 읽기 (간편 인터페이스)
   */
  async readResource(uri: string): Promise<MCPResourceContent> {
    return this.protocol.readResource(this.serviceId, uri);
  }

  /**
   * 서비스 정보 새로고침
   */
  async refresh(): Promise<void> {
    await this.loadTools();
    await this.loadResources();
  }
}

// ============ Service Factory ============

export class MCPServiceFactory {
  private static services = new Map<string, MCPService>();

  /**
   * MCP 서비스 인스턴스 생성 또는 재사용
   */
  static async getService(serviceId: string): Promise<MCPService> {
    if (!this.services.has(serviceId)) {
      const service = new MCPService(serviceId);
      await service.initialize();
      this.services.set(serviceId, service);
    }
    
    return this.services.get(serviceId)!;
  }

  /**
   * 특정 서비스 인스턴스 제거
   */
  static removeService(serviceId: string): void {
    this.services.delete(serviceId);
  }

  /**
   * 모든 서비스 인스턴스 초기화
   */
  static clear(): void {
    this.services.clear();
  }

  /**
   * 현재 로드된 서비스 목록
   */
  static getLoadedServices(): string[] {
    return Array.from(this.services.keys());
  }
}

// 싱글톤 인스턴스
export const mcpProtocol = new MCPProtocolWrapper();