import { RouterConfig } from '../types';
import dotenv from 'dotenv';
import path from 'path';
import { MCP_SERVICES_CONFIG } from './mcp-services';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../configs/api-keys.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../configs/environment.env') });

export const config: RouterConfig = {
  MAX_CONCURRENT_PROCESSES: parseInt(process.env.MAX_CONCURRENT_PROCESSES || '10'),
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
  PROCESS_IDLE_TIMEOUT: parseInt(process.env.PROCESS_IDLE_TIMEOUT || '60000'),
  MCP_SERVICES: MCP_SERVICES_CONFIG
};
