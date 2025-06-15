import { WebSocket } from 'ws';
import { MCPRouter } from '../router/MCPRouter';
import { logger } from '../utils/logger';
import { WebSocketRequest, WebSocketResponse } from '../types';

export class StdioBridge {
  private router: MCPRouter;
  private activeStreams: Map<string, WebSocket>;

  constructor(router: MCPRouter) {
    this.router = router;
    this.activeStreams = new Map();
  }

  async handleWebSocketRequest(ws: WebSocket, request: WebSocketRequest) {
    const { id, type, service, method, params } = request;

    try {
      switch (type) {
        case 'execute':
          await this.handleExecute(ws, id, service, method, params);
          break;
          
        case 'stream':
          await this.handleStream(ws, id, service, method, params);
          break;
          
        case 'cancel':
          this.handleCancel(id);
          break;
          
        default:
          throw new Error(`Unknown request type: ${type}`);
      }
    } catch (error) {
      this.sendError(ws, id, error);
    }
  }

  private async handleExecute(
    ws: WebSocket, 
    id: string, 
    service: string, 
    method: string, 
    params: any
  ) {
    try {
      const result = await this.router.execute(service, method, params);
      
      const response: WebSocketResponse = {
        id,
        type: 'result',
        result
      };
      
      ws.send(JSON.stringify(response));
    } catch (error) {
      this.sendError(ws, id, error);
    }
  }

  private async handleStream(
    ws: WebSocket,
    id: string,
    service: string,
    method: string,
    params: any
  ) {
    this.activeStreams.set(id, ws);
    
    try {
      // Create a custom event emitter for this stream
      const streamHandler = (data: any) => {
        if (this.activeStreams.has(id)) {
          const response: WebSocketResponse = {
            id,
            type: 'stream',
            data
          };
          ws.send(JSON.stringify(response));
        }
      };

      // Register stream handler
      this.router.on(`stream:${id}`, streamHandler);
      
      // Execute with streaming
      const result = await this.router.execute(service, method, {
        ...params,
        _stream: true,
        _streamId: id
      });
      
      // Send completion
      const response: WebSocketResponse = {
        id,
        type: 'complete',
        result
      };
      ws.send(JSON.stringify(response));
      
    } catch (error) {
      this.sendError(ws, id, error);
    } finally {
      this.activeStreams.delete(id);
      this.router.removeAllListeners(`stream:${id}`);
    }
  }

  private handleCancel(id: string) {
    const ws = this.activeStreams.get(id);
    if (ws) {
      const response: WebSocketResponse = {
        id,
        type: 'cancelled'
      };
      ws.send(JSON.stringify(response));
      this.activeStreams.delete(id);
    }
  }

  private sendError(ws: WebSocket, id: string, error: any) {
    const response: WebSocketResponse = {
      id,
      type: 'error',
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: error.code || 'INTERNAL_ERROR'
      }
    };
    
    ws.send(JSON.stringify(response));
    logger.error(`WebSocket error for request ${id}:`, error);
  }

  cleanup() {
    // Close all active streams
    for (const [id, ws] of this.activeStreams) {
      try {
        const response: WebSocketResponse = {
          id,
          type: 'cancelled'
        };
        ws.send(JSON.stringify(response));
      } catch (e) {
        // Ignore send errors during cleanup
      }
    }
    this.activeStreams.clear();
  }
}