import { spawn, ChildProcess } from 'child_process';
import { MCPService } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface MCPProcess {
  process: ChildProcess;
  service: MCPService;
  lastUsed: number;
  buffer: string;
  pendingRequests: Map<string | number, (response: any) => void>;
}

export class MCPPersistentRouter {
  private config: Record<string, MCPService>;
  private processes: Map<string, MCPProcess> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private idleTimeout: number;

  constructor(config: Record<string, MCPService>) {
    this.config = config;
    this.idleTimeout = parseInt(process.env.PROCESS_IDLE_TIMEOUT || '60000');
    
    // Cleanup idle processes every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleProcesses();
    }, 30000);
  }

  async executeMCP(serviceName: string, mcpRequest: any): Promise<any> {
    const service = this.config[serviceName];
    if (!service) {
      return {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        error: {
          code: -32601,
          message: `Unknown service: ${serviceName}`
        }
      };
    }

    logger.info(`Executing MCP ${serviceName}.${mcpRequest.method}`);
    
    // Handle prompts/list for services that don't implement it
    if (mcpRequest.method === 'prompts/list') {
      logger.info(`Handling prompts/list for ${serviceName} - returning empty`);
      return {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        result: {
          prompts: []
        }
      };
    }
    
    try {
      const mcpProcess = await this.getOrCreateProcess(serviceName, service);
      const response = await this.sendRequest(mcpProcess, mcpRequest);
      return response;
    } catch (error: any) {
      logger.error(`Error executing ${serviceName}:`, error);
      return {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        error: {
          code: -32603,
          message: error.message || 'Internal error'
        }
      };
    }
  }

  private async getOrCreateProcess(serviceName: string, service: MCPService): Promise<MCPProcess> {
    let mcpProcess = this.processes.get(serviceName);
    
    if (!mcpProcess || mcpProcess.process.killed) {
      // Create new process
      const childProcess = spawn(service.command, service.args || [], {
        cwd: service.cwd,
        env: {
          PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
          LANG: 'C.UTF-8',
          LC_ALL: 'C.UTF-8',
          PYTHONIOENCODING: 'utf-8',
          HOME: process.env.HOME || '/root',
          USER: process.env.USER || 'root',
          ...service.env
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      mcpProcess = {
        process: childProcess,
        service,
        lastUsed: Date.now(),
        buffer: '',
        pendingRequests: new Map()
      };

      // Set up event handlers
      childProcess.stdout?.on('data', (data) => {
        mcpProcess!.buffer += data.toString();
        this.processBuffer(mcpProcess!);
      });

      childProcess.stderr?.on('data', (data) => {
        logger.debug(`${serviceName} stderr:`, data.toString());
      });

      childProcess.on('error', (error) => {
        logger.error(`Process error for ${serviceName}:`, error);
        // Reject all pending requests
        for (const [id, resolve] of mcpProcess!.pendingRequests) {
          resolve({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32603,
              message: error.message
            }
          });
        }
        mcpProcess!.pendingRequests.clear();
      });

      childProcess.on('exit', (code) => {
        logger.info(`${serviceName} process exited with code ${code}`);
        this.processes.delete(serviceName);
        // Reject all pending requests
        for (const [id, resolve] of mcpProcess!.pendingRequests) {
          resolve({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32603,
              message: `Process exited with code ${code} without responding`
            }
          });
        }
      });

      this.processes.set(serviceName, mcpProcess);
      
      // Initialize the process
      try {
        const initRequest = {
          jsonrpc: '2.0',
          id: 'auto-init-' + Date.now(),
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {}
          }
        };
        
        await this.sendRequest(mcpProcess, initRequest);
        logger.info(`Successfully initialized ${serviceName}`);
      } catch (error) {
        logger.warn(`Failed to initialize ${serviceName}:`, error);
      }
      
      // Wait for process to be ready after initialization
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    mcpProcess.lastUsed = Date.now();
    return mcpProcess;
  }

  private processBuffer(mcpProcess: MCPProcess) {
    const lines = mcpProcess.buffer.split('\n');
    mcpProcess.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          if (response.id !== undefined && mcpProcess.pendingRequests.has(response.id)) {
            const resolve = mcpProcess.pendingRequests.get(response.id);
            mcpProcess.pendingRequests.delete(response.id);
            resolve!(response);
          }
        } catch (e) {
          logger.debug('Failed to parse line as JSON:', line);
        }
      }
    }
  }

  private async sendRequest(mcpProcess: MCPProcess, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        mcpProcess.pendingRequests.delete(request.id);
        reject(new Error('Request timeout'));
      }, parseInt(process.env.REQUEST_TIMEOUT || '120000'));

      mcpProcess.pendingRequests.set(request.id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      const requestStr = JSON.stringify(request) + '\n';
      mcpProcess.process.stdin?.write(requestStr);
    });
  }

  private cleanupIdleProcesses() {
    const now = Date.now();
    for (const [serviceName, mcpProcess] of this.processes) {
      if (now - mcpProcess.lastUsed > this.idleTimeout) {
        logger.info(`Cleaning up idle process: ${serviceName}`);
        mcpProcess.process.kill('SIGTERM');
        this.processes.delete(serviceName);
      }
    }
  }

  async shutdown() {
    clearInterval(this.cleanupInterval);
    for (const [serviceName, mcpProcess] of this.processes) {
      logger.info(`Shutting down process: ${serviceName}`);
      mcpProcess.process.kill('SIGTERM');
    }
    this.processes.clear();
  }
}