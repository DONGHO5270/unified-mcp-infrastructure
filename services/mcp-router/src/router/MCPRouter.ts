import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { MCPService, MCPRequest, MCPResponse, RouterConfig } from '../types';

export class MCPRouter extends EventEmitter {
  private services: Map<string, MCPService>;
  private activeProcesses: Map<string, ChildProcess>;
  private requestQueue: PQueue;
  private config: RouterConfig;

  constructor(config: RouterConfig) {
    super();
    this.config = config;
    this.services = new Map();
    this.activeProcesses = new Map();
    this.requestQueue = new PQueue({ 
      concurrency: config.MAX_CONCURRENT_PROCESSES || 10 
    });
    
    this.loadServices();
  }

  private loadServices() {
    for (const [name, service] of Object.entries(this.config.MCP_SERVICES)) {
      this.services.set(name, service);
      logger.info(`Loaded MCP service: ${name}`);
    }
  }

  async execute(serviceName: string, method: string, params: any): Promise<any> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Unknown MCP service: ${serviceName}`);
    }

    const requestId = uuidv4();
    logger.info(`Executing ${serviceName}.${method} [${requestId}]`);

    return this.requestQueue.add(async () => {
      const process = await this.spawnMCPProcess(service, requestId);
      
      try {
        const response = await this.sendRequest(process, {
          jsonrpc: '2.0',
          id: requestId,
          method,
          params
        });
        
        return response.result;
      } finally {
        // Clean up process after request
        this.terminateProcess(requestId);
      }
    });
  }

  private async spawnMCPProcess(service: MCPService, requestId: string): Promise<ChildProcess> {
    const startTime = Date.now();
    
    const processEnv = {
      ...process.env,
      ...service.env,
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8'
    };

    const childProcess = spawn(service.command, service.args || [], {
      cwd: service.cwd,
      env: processEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    });

    this.activeProcesses.set(requestId, childProcess);

    // Handle process errors
    childProcess.on('error', (error: Error) => {
      logger.error(`Process error for ${service.name}:`, error);
      this.emit('processError', { service: service.name, error });
    });

    childProcess.on('exit', (code, signal) => {
      logger.error(`Process ${service.name} exited with code ${code}, signal ${signal}`);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      logger.debug(`${service.name} stderr: ${data}`);
    });

    // Wait for process to be ready
    await this.waitForProcessReady(childProcess, service);
    
    logger.info(`Spawned ${service.name} process in ${Date.now() - startTime}ms`);
    return childProcess;
  }

  private async waitForProcessReady(process: ChildProcess, service: MCPService): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        logger.error(`Process ${service.name} startup timeout - no MCP initialization detected`);
        reject(new Error(`Process ${service.name} failed to start within timeout`));
      }, service.startupTimeout || 10000);

      let buffer = '';
      const onData = (data: Buffer) => {
        const output = data.toString();
        buffer += output;
        logger.debug(`${service.name} stdout:`, output.trim());
        
        // MCP services output JSON-RPC messages, look for any valid JSON
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              // Any valid JSON response indicates the service is ready
              clearTimeout(timeout);
              process.stdout?.removeListener('data', onData);
              logger.info(`${service.name} initialized successfully`);
              resolve();
              return;
            } catch (e) {
              // Not valid JSON yet, continue
            }
          }
        }
      };

      // Also resolve immediately if we're dealing with stdio services
      // Some MCP services might not output anything until they receive input
      setTimeout(() => {
        clearTimeout(timeout);
        process.stdout?.removeListener('data', onData);
        logger.info(`${service.name} assumed ready (no initialization output)`);
        resolve();
      }, 1000);

      process.stdout?.on('data', onData);
    });
  }

  private async sendRequest(process: ChildProcess, request: MCPRequest): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.REQUEST_TIMEOUT || 30000);

      let responseBuffer = '';

      const onData = (data: Buffer) => {
        responseBuffer += data.toString();
        
        // Try to parse complete JSON-RPC response
        try {
          const lines = responseBuffer.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              const response = JSON.parse(line);
              if (response.id === request.id) {
                clearTimeout(timeout);
                process.stdout?.removeListener('data', onData);
                resolve(response);
                return;
              }
            }
          }
        } catch (e) {
          // Not a complete JSON yet, continue buffering
        }
      };

      process.stdout?.on('data', onData);
      
      // Send request
      const requestStr = JSON.stringify(request) + '\n';
      process.stdin?.write(requestStr);
    });
  }

  private terminateProcess(requestId: string) {
    const process = this.activeProcesses.get(requestId);
    if (process) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(requestId);
      logger.debug(`Terminated process for request ${requestId}`);
    }
  }

  async shutdown() {
    logger.info('Shutting down MCP Router...');
    
    // Terminate all active processes
    for (const [requestId, process] of this.activeProcesses) {
      process.kill('SIGTERM');
      logger.debug(`Terminated process ${requestId}`);
    }
    
    this.activeProcesses.clear();
    await this.requestQueue.onIdle();
  }

  getStats() {
    return {
      services: Array.from(this.services.keys()),
      activeProcesses: this.activeProcesses.size,
      queueSize: this.requestQueue.size,
      queuePending: this.requestQueue.pending
    };
  }
}