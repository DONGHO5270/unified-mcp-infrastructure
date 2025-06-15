export interface MCPService {
  name: string;
  command: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
  startupTimeout?: number;
  capabilities?: string[];
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface WebSocketRequest {
  id: string;
  type: 'execute' | 'stream' | 'cancel';
  service: string;
  method: string;
  params?: any;
}

export interface WebSocketResponse {
  id: string;
  type: 'result' | 'stream' | 'complete' | 'error' | 'cancelled';
  result?: any;
  data?: any;
  error?: {
    message: string;
    code?: string;
  };
}

export interface RouterConfig {
  MCP_SERVICES: Record<string, MCPService>;
  MAX_CONCURRENT_PROCESSES?: number;
  REQUEST_TIMEOUT?: number;
  PROCESS_IDLE_TIMEOUT?: number;
}