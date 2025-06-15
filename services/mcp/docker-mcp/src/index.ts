#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import { parse as parseUrl } from 'url';

// Import the SDK
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

// 命令行参数解析
const args = process.argv.slice(2);
const transportType = args.includes('--http') ? 'http' : 'stdio';
const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1], 10) : 3000;
const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : 'localhost';

const execAsync = promisify(exec);

// Docker容器相关接口
interface ContainerArgs {
  all?: boolean;
}

interface RunContainerArgs {
  image: string;
  name?: string;
  detach?: boolean;
  ports?: Array<string>;
  volumes?: Array<string>;
  env?: Record<string, string>;
  command?: string;
}

interface ContainerActionArgs {
  container: string;
}

interface ImageArgs {
  image: string;
}

// Docker Compose相关接口
interface ComposeArgs {
  file?: string;
  projectName?: string;
  services?: Array<string>;
}

interface ComposeUpArgs extends ComposeArgs {
  detach?: boolean;
  build?: boolean;
  removeOrphans?: boolean;
}

interface ComposeDownArgs extends ComposeArgs {
  volumes?: boolean;
  removeOrphans?: boolean;
}

interface ComposeLogsArgs extends ComposeArgs {
  follow?: boolean;
  tail?: string;
}

interface ComposeBuildArgs extends ComposeArgs {
  noCache?: boolean;
  pull?: boolean;
}

// 新增 - 高级容器管理接口
interface ContainerInspectArgs {
  container: string;
  format?: string;
}

interface ContainerLogsArgs {
  container: string;
  tail?: string;
  since?: string;
  until?: string;
  timestamps?: boolean;
}

interface ContainerExecArgs {
  container: string;
  command: string;
  interactive?: boolean;
}

interface ContainerStatsArgs {
  container: string;
  noStream?: boolean;
}

// 新增 - 镜像管理接口
interface BuildImageArgs {
  dockerfile?: string;
  tag: string;
  context: string;
  buildArgs?: Record<string, string>;
  noCache?: boolean;
  pull?: boolean;
}

interface PruneImagesArgs {
  all?: boolean;
  filter?: string;
}

// 新增 - 网络管理接口
interface NetworkArgs {
  name: string;
}

interface CreateNetworkArgs extends NetworkArgs {
  driver?: string;
  subnet?: string;
  gateway?: string;
  internal?: boolean;
}

interface NetworkConnectArgs {
  network: string;
  container: string;
  alias?: Array<string>;
}

// 新增 - 卷管理接口
interface VolumeArgs {
  name: string;
}

interface CreateVolumeArgs extends VolumeArgs {
  driver?: string;
  labels?: Record<string, string>;
}

// 新增 - 系统信息接口
interface SystemInfoArgs {
  format?: string;
}

interface SystemDiskUsageArgs {
  verbose?: boolean;
}

// 新增 - 安全检查接口
interface SecurityScanArgs {
  image: string;
  verbose?: boolean;
}

class DockerServer {
  private server: Server;
  private transportType: string;
  private port: number;
  private host: string;
  private httpServer?: http.Server;
  private sseClients: http.ServerResponse[] = [];

  constructor(options: { transport: string; port: number; host: string }) {
    this.transportType = options.transport;
    this.port = options.port;
    this.host = options.host;

    this.server = new Server(
      {
        name: 'docker-mcp-server',
        version: '0.3.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error: any) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      if (this.httpServer) {
        this.httpServer.close();
      }
      process.exit(0);
    });

    // 初始化服务器
    console.log('Docker MCP Server initialized');
  }

  private setupToolHandlers() {
    // 设置 tools/list 处理程序
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_containers',
          description: 'List all Docker containers',
          inputSchema: {
            type: 'object',
            properties: {
              all: {
                type: 'boolean',
                description: 'Show all containers (default shows just running)',
              },
            },
          },
        },
        {
          name: 'list_images',
          description: 'List all Docker images',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'run_container',
          description: 'Run a Docker container',
          inputSchema: {
            type: 'object',
            properties: {
              image: {
                type: 'string',
                description: 'Docker image to run',
              },
              name: {
                type: 'string',
                description: 'Name for the container',
              },
              detach: {
                type: 'boolean',
                description: 'Run container in background',
              },
              ports: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Port mappings (e.g. ["8080:80"])',
              },
              volumes: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Volume mappings (e.g. ["/host/path:/container/path"])',
              },
              env: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Environment variables (e.g. ["KEY=value"])',
              },
              command: {
                type: 'string',
                description: 'Command to run in the container',
              },
            },
            required: ['image'],
          },
        },
        {
          name: 'stop_container',
          description: 'Stop a running Docker container',
          inputSchema: {
            type: 'object',
            properties: {
              container: {
                type: 'string',
                description: 'Container ID or name',
              },
            },
            required: ['container'],
          },
        },
        {
          name: 'remove_container',
          description: 'Remove a Docker container',
          inputSchema: {
            type: 'object',
            properties: {
              container: {
                type: 'string',
                description: 'Container ID or name',
              },
              force: {
                type: 'boolean',
                description: 'Force removal of running container',
              },
            },
            required: ['container'],
          },
        },
        {
          name: 'pull_image',
          description: 'Pull a Docker image from a registry',
          inputSchema: {
            type: 'object',
            properties: {
              image: {
                type: 'string',
                description: 'Image name (e.g. "nginx:latest")',
              },
            },
            required: ['image'],
          },
        },
        // Docker Compose 相关工具
        {
          name: 'compose_up',
          description: 'Start Docker Compose services',
          inputSchema: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                description: 'Path to docker-compose.yml file',
              },
              projectName: {
                type: 'string',
                description: 'Specify project name',
              },
              services: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Services to start (default: all services)',
              },
              detach: {
                type: 'boolean',
                description: 'Run in background',
              },
              build: {
                type: 'boolean',
                description: 'Build images before starting containers',
              },
              removeOrphans: {
                type: 'boolean',
                description: 'Remove containers for services not defined in the Compose file',
              },
            },
          },
        },
        {
          name: 'compose_down',
          description: 'Stop and remove Docker Compose services',
          inputSchema: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                description: 'Path to docker-compose.yml file',
              },
              projectName: {
                type: 'string',
                description: 'Specify project name',
              },
              volumes: {
                type: 'boolean',
                description: 'Remove named volumes declared in the volumes section',
              },
              removeOrphans: {
                type: 'boolean',
                description: 'Remove containers for services not defined in the Compose file',
              },
            },
          },
        },
        {
          name: 'compose_ps',
          description: 'List Docker Compose services',
          inputSchema: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                description: 'Path to docker-compose.yml file',
              },
              projectName: {
                type: 'string',
                description: 'Specify project name',
              },
              services: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Services to show (default: all services)',
              },
            },
          },
        },
        {
          name: 'compose_logs',
          description: 'View Docker Compose service logs',
          inputSchema: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                description: 'Path to docker-compose.yml file',
              },
              projectName: {
                type: 'string',
                description: 'Specify project name',
              },
              services: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Services to show logs for (default: all services)',
              },
              follow: {
                type: 'boolean',
                description: 'Follow log output',
              },
              tail: {
                type: 'string',
                description: 'Number of lines to show from the end of the logs (e.g. "100")',
              },
            },
          },
        },
        {
          name: 'compose_build',
          description: 'Build Docker Compose services',
          inputSchema: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                description: 'Path to docker-compose.yml file',
              },
              projectName: {
                type: 'string',
                description: 'Specify project name',
              },
              services: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Services to build (default: all services)',
              },
              noCache: {
                type: 'boolean',
                description: 'Do not use cache when building the image',
              },
              pull: {
                type: 'boolean',
                description: 'Always attempt to pull a newer version of the image',
              },
            },
          },
        },
        
        // 新增 - 高级容器管理工具
        {
          name: 'inspect_container',
          description: 'Show detailed information about a container',
          inputSchema: {
            type: 'object',
            properties: {
              container: {
                type: 'string',
                description: 'Container ID or name',
              },
              format: {
                type: 'string',
                description: 'Format the output using a Go template',
              },
            },
            required: ['container'],
          },
        },
        {
          name: 'container_logs',
          description: 'Fetch the logs of a container',
          inputSchema: {
            type: 'object',
            properties: {
              container: {
                type: 'string',
                description: 'Container ID or name',
              },
              tail: {
                type: 'string',
                description: 'Number of lines to show from the end of the logs (e.g. "100")',
              },
              since: {
                type: 'string',
                description: 'Show logs since timestamp (e.g. "2021-01-02T13:23:37") or relative (e.g. "42m" for 42 minutes)',
              },
              until: {
                type: 'string',
                description: 'Show logs before timestamp (e.g. "2021-01-02T13:23:37") or relative (e.g. "42m" for 42 minutes)',
              },
              timestamps: {
                type: 'boolean',
                description: 'Show timestamps',
              },
            },
            required: ['container'],
          },
        },
        {
          name: 'exec_container',
          description: 'Execute a command in a running container',
          inputSchema: {
            type: 'object',
            properties: {
              container: {
                type: 'string',
                description: 'Container ID or name',
              },
              command: {
                type: 'string',
                description: 'Command to execute',
              },
              interactive: {
                type: 'boolean',
                description: 'Keep STDIN open even if not attached',
              },
            },
            required: ['container', 'command'],
          },
        },
        {
          name: 'container_stats',
          description: 'Display a live stream of container resource usage statistics',
          inputSchema: {
            type: 'object',
            properties: {
              container: {
                type: 'string',
                description: 'Container ID or name',
              },
              noStream: {
                type: 'boolean',
                description: 'Disable streaming stats and only pull the first result',
              },
            },
            required: ['container'],
          },
        },
        
        // 新增 - 镜像管理工具
        {
          name: 'build_image',
          description: 'Build an image from a Dockerfile',
          inputSchema: {
            type: 'object',
            properties: {
              dockerfile: {
                type: 'string',
                description: 'Path to Dockerfile',
              },
              tag: {
                type: 'string',
                description: 'Name and optionally a tag in the name:tag format',
              },
              context: {
                type: 'string',
                description: 'Path to the build context',
              },
              buildArgs: {
                type: 'object',
                description: 'Build-time variables',
              },
              noCache: {
                type: 'boolean',
                description: 'Do not use cache when building the image',
              },
              pull: {
                type: 'boolean',
                description: 'Always attempt to pull a newer version of the image',
              },
            },
            required: ['tag', 'context'],
          },
        },
        {
          name: 'prune_images',
          description: 'Remove unused images',
          inputSchema: {
            type: 'object',
            properties: {
              all: {
                type: 'boolean',
                description: 'Remove all unused images, not just dangling ones',
              },
              filter: {
                type: 'string',
                description: 'Provide filter values (e.g. "until=24h")',
              },
            },
          },
        },
        
        // 新增 - 网络管理工具
        {
          name: 'list_networks',
          description: 'List all Docker networks',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_network',
          description: 'Create a new Docker network',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Network name',
              },
              driver: {
                type: 'string',
                description: 'Driver to manage the network (default "bridge")',
              },
              subnet: {
                type: 'string',
                description: 'Subnet in CIDR format (e.g. "172.30.0.0/16")',
              },
              gateway: {
                type: 'string',
                description: 'Gateway for the subnet',
              },
              internal: {
                type: 'boolean',
                description: 'Restrict external access to the network',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'remove_network',
          description: 'Remove a Docker network',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Network name or ID',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'network_connect',
          description: 'Connect a container to a network',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network name or ID',
              },
              container: {
                type: 'string',
                description: 'Container ID or name',
              },
              alias: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Add network-scoped alias for the container',
              },
            },
            required: ['network', 'container'],
          },
        },
        
        // 新增 - 卷管理工具
        {
          name: 'list_volumes',
          description: 'List all Docker volumes',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_volume',
          description: 'Create a Docker volume',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Volume name',
              },
              driver: {
                type: 'string',
                description: 'Volume driver name (default "local")',
              },
              labels: {
                type: 'object',
                description: 'Labels to set on the volume',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'remove_volume',
          description: 'Remove a Docker volume',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Volume name',
              },
            },
            required: ['name'],
          },
        },
        
        // 新增 - 系统信息工具
        {
          name: 'system_info',
          description: 'Display system-wide information',
          inputSchema: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                description: 'Format the output using a Go template',
              },
            },
          },
        },
        {
          name: 'system_df',
          description: 'Show Docker disk usage',
          inputSchema: {
            type: 'object',
            properties: {
              verbose: {
                type: 'boolean',
                description: 'Show detailed information on space usage',
              },
            },
          },
        },
        
        // 新增 - 安全检查工具
        {
          name: 'security_scan',
          description: 'Scan a Docker image for vulnerabilities',
          inputSchema: {
            type: 'object',
            properties: {
              image: {
                type: 'string',
                description: 'Image to scan (e.g. "nginx:latest")',
              },
              verbose: {
                type: 'boolean',
                description: 'Show detailed vulnerability information',
              },
            },
            required: ['image'],
          },
        },
      ],
    }));

    // 设置 tools/call 处理程序
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'list_containers':
            return await this.listContainers(request.params.arguments as unknown as ContainerArgs);
          case 'list_images':
            return await this.listImages();
          case 'run_container':
            return await this.runContainer(request.params.arguments as unknown as RunContainerArgs);
          case 'stop_container':
            return await this.stopContainer(request.params.arguments as unknown as ContainerActionArgs);
          case 'remove_container':
            return await this.removeContainer(request.params.arguments as unknown as ContainerActionArgs);
          case 'pull_image':
            return await this.pullImage(request.params.arguments as unknown as ImageArgs);
          // Docker Compose 命令处理
          case 'compose_up':
            return await this.composeUp(request.params.arguments as unknown as ComposeUpArgs);
          case 'compose_down':
            return await this.composeDown(request.params.arguments as unknown as ComposeDownArgs);
          case 'compose_ps':
            return await this.composePs(request.params.arguments as unknown as ComposeArgs);
          case 'compose_logs':
            return await this.composeLogs(request.params.arguments as unknown as ComposeLogsArgs);
          case 'compose_build':
            return await this.composeBuild(request.params.arguments as unknown as ComposeBuildArgs);
          // 新增 - 高级容器管理工具
          case 'inspect_container':
            return await this.inspectContainer(request.params.arguments as unknown as ContainerInspectArgs);
          case 'container_logs':
            return await this.containerLogs(request.params.arguments as unknown as ContainerLogsArgs);
          case 'exec_container':
            return await this.execContainer(request.params.arguments as unknown as ContainerExecArgs);
          case 'container_stats':
            return await this.containerStats(request.params.arguments as unknown as ContainerStatsArgs);
          // 新增 - 镜像管理工具
          case 'build_image':
            return await this.buildImage(request.params.arguments as unknown as BuildImageArgs);
          case 'prune_images':
            return await this.pruneImages(request.params.arguments as unknown as PruneImagesArgs);
          // 新增 - 网络管理工具
          case 'list_networks':
            return await this.listNetworks();
          case 'create_network':
            return await this.createNetwork(request.params.arguments as unknown as CreateNetworkArgs);
          case 'remove_network':
            return await this.removeNetwork(request.params.arguments as unknown as NetworkArgs);
          case 'network_connect':
            return await this.networkConnect(request.params.arguments as unknown as NetworkConnectArgs);
          // 新增 - 卷管理工具
          case 'list_volumes':
            return await this.listVolumes();
          case 'create_volume':
            return await this.createVolume(request.params.arguments as unknown as CreateVolumeArgs);
          case 'remove_volume':
            return await this.removeVolume(request.params.arguments as unknown as VolumeArgs);
          // 新增 - 系统信息工具
          case 'system_info':
            return await this.systemInfo(request.params.arguments as unknown as SystemInfoArgs);
          case 'system_df':
            return await this.systemDf(request.params.arguments as unknown as SystemDiskUsageArgs);
          // 新增 - 安全检查工具
          case 'security_scan':
            return await this.securityScan(request.params.arguments as unknown as SecurityScanArgs);
          default:
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Unknown tool: ${request.params.name}`
                }
              ]
            };
        }
      } catch (error: any) {
        console.error(error);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error executing Docker command: ${error.message}`
            }
          ]
        };
      }
    });
  }

  private async listContainers(args: ContainerArgs) {
    const showAll = args?.all === true ? '-a' : '';
    const { stdout } = await execAsync(`docker ps ${showAll} --format "{{.ID}}\\t{{.Image}}\\t{{.Status}}\\t{{.Names}}"`);
    
    const containers = stdout.trim().split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const [id, image, status, name] = line.split('\t');
        return { id, image, status, name };
      });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(containers, null, 2),
        },
      ],
    };
  }

  private async listImages() {
    const { stdout } = await execAsync('docker images --format "{{.Repository}}:{{.Tag}}\\t{{.ID}}\\t{{.Size}}"');
    
    const images = stdout.trim().split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const [name, id, size] = line.split('\t');
        return { name, id, size };
      });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(images, null, 2),
        },
      ],
    };
  }

  private async runContainer(args: RunContainerArgs) {
    if (!args.image) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Image parameter is required'
          }
        ]
      };
    }

    try {
      let command = 'docker run';
      
      if (args.detach) {
        command += ' -d';
      }
      
      if (args.name) {
        command += ` --name ${args.name}`;
      }
      
      if (args.ports && Array.isArray(args.ports)) {
        args.ports.forEach((port: string) => {
          command += ` -p ${port}`;
        });
      }
      
      if (args.volumes && Array.isArray(args.volumes)) {
        args.volumes.forEach((volume: string) => {
          command += ` -v ${volume}`;
        });
      }
      
      if (args.env && Array.isArray(args.env)) {
        args.env.forEach((env: string) => {
          command += ` -e ${env}`;
        });
      }
      
      command += ` ${args.image}`;
      
      if (args.command) {
        command += ` ${args.command}`;
      }
      
      const { stdout } = await execAsync(command);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout.trim(),
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error running container: ${error.message}`
          }
        ]
      };
    }
  }

  private async stopContainer(args: ContainerActionArgs) {
    if (!args.container) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Container parameter is required'
          }
        ]
      };
    }
    
    try {
      const { stdout } = await execAsync(`docker stop ${args.container}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout.trim(),
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error stopping container: ${error.message}`
          }
        ]
      };
    }
  }

  private async removeContainer(args: ContainerActionArgs) {
    if (!args.container) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Container parameter is required'
          }
        ]
      };
    }
    
    try {
      const { stdout } = await execAsync(`docker rm ${args.container}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout.trim(),
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error removing container: ${error.message}`
          }
        ]
      };
    }
  }

  private async pullImage(args: ImageArgs) {
    if (!args.image) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Image parameter is required'
          }
        ]
      };
    }
    
    try {
      const { stdout } = await execAsync(`docker pull ${args.image}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout.trim(),
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error pulling image: ${error.message}`
          }
        ]
      };
    }
  }

  // Docker Compose 相关方法
  private buildComposeCommand(args: ComposeArgs): string {
    // 使用新版命令格式
    let command = 'docker compose';
    
    if (args.file) {
      command += ` -f ${args.file}`;
    }
    
    if (args.projectName) {
      command += ` -p ${args.projectName}`;
    }
    
    return command;
  }

  // 辅助方法：尝试执行Docker Compose命令，支持新老版本
  private async tryComposeCommand(args: ComposeArgs, subCommand: string, additionalArgs: string = ''): Promise<string> {
    // 先尝试新版命令 docker compose
    try {
      const newCommand = `${this.buildComposeCommand(args)} ${subCommand} ${additionalArgs}`;
      const { stdout } = await execAsync(newCommand);
      return stdout;
    } catch (error: any) {
      // 如果新版命令失败，尝试老版命令 docker-compose
      console.log(`New docker compose command failed, trying legacy docker-compose command: ${error.message}`);
      
      let legacyCommand = 'docker-compose';
      if (args.file) {
        legacyCommand += ` -f ${args.file}`;
      }
      if (args.projectName) {
        legacyCommand += ` -p ${args.projectName}`;
      }
      
      legacyCommand += ` ${subCommand} ${additionalArgs}`;
      
      const { stdout } = await execAsync(legacyCommand);
      return stdout;
    }
  }

  private async composeUp(args: ComposeUpArgs) {
    try {
      let additionalArgs = '';
      
      if (args.detach) {
        additionalArgs += ' -d';
      }
      
      if (args.build) {
        additionalArgs += ' --build';
      }
      
      if (args.removeOrphans) {
        additionalArgs += ' --remove-orphans';
      }
      
      if (args.services && Array.isArray(args.services) && args.services.length > 0) {
        additionalArgs += ` ${args.services.join(' ')}`;
      }
      
      const stdout = await this.tryComposeCommand(args, 'up', additionalArgs);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout.trim(),
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing compose up: ${error.message}`
          }
        ]
      };
    }
  }

  private async composeDown(args: ComposeDownArgs) {
    try {
      let additionalArgs = '';
      
      if (args.volumes) {
        additionalArgs += ' -v';
      }
      
      if (args.removeOrphans) {
        additionalArgs += ' --remove-orphans';
      }
      
      const stdout = await this.tryComposeCommand(args, 'down', additionalArgs);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout.trim(),
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing compose down: ${error.message}`
          }
        ]
      };
    }
  }

  private async composePs(args: ComposeArgs) {
    try {
      let additionalArgs = '';
      
      if (args.services && Array.isArray(args.services) && args.services.length > 0) {
        additionalArgs += ` ${args.services.join(' ')}`;
      }
      
      const stdout = await this.tryComposeCommand(args, 'ps', additionalArgs);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout.trim(),
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing compose ps: ${error.message}`
          }
        ]
      };
    }
  }

  private async composeLogs(args: ComposeLogsArgs) {
    try {
      let additionalArgs = '';
      
      if (args.follow) {
        additionalArgs += ' -f';
      }
      
      if (args.tail) {
        additionalArgs += ` --tail=${args.tail}`;
      }
      
      if (args.services && Array.isArray(args.services) && args.services.length > 0) {
        additionalArgs += ` ${args.services.join(' ')}`;
      }
      
      const stdout = await this.tryComposeCommand(args, 'logs', additionalArgs);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout.trim(),
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing compose logs: ${error.message}`
          }
        ]
      };
    }
  }

  private async composeBuild(args: ComposeBuildArgs) {
    this.logRequest('compose_build', args);
    
    try {
      let additionalArgs = '';
      
      const noCache = args.noCache ? '--no-cache' : '';
      const pull = args.pull ? '--pull' : '';
      const services = args.services ? args.services.join(' ') : '';
      
      additionalArgs = `${noCache} ${pull} ${services}`.trim();
      
      const stdout = await this.tryComposeCommand(args, 'build', additionalArgs);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('compose_build', error);
    }
  }

  // 新增 - 高级容器管理方法
  private async inspectContainer(args: ContainerInspectArgs) {
    this.logRequest('inspect_container', args);
    
    try {
      const format = args.format ? `--format "${args.format}"` : '';
      const { stdout } = await execAsync(`docker inspect ${format} ${args.container}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('inspect_container', error);
    }
  }
  
  private async containerLogs(args: ContainerLogsArgs) {
    this.logRequest('container_logs', args);
    
    try {
      const tail = args.tail ? `--tail ${args.tail}` : '';
      const since = args.since ? `--since ${args.since}` : '';
      const until = args.until ? `--until ${args.until}` : '';
      const timestamps = args.timestamps ? '--timestamps' : '';
      
      const { stdout } = await execAsync(`docker logs ${tail} ${since} ${until} ${timestamps} ${args.container}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('container_logs', error);
    }
  }
  
  private async execContainer(args: ContainerExecArgs) {
    this.logRequest('exec_container', args);
    
    try {
      const interactive = args.interactive ? '-i' : '';
      const { stdout } = await execAsync(`docker exec ${interactive} ${args.container} ${args.command}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('exec_container', error);
    }
  }
  
  private async containerStats(args: ContainerStatsArgs) {
    this.logRequest('container_stats', args);
    
    try {
      const noStream = args.noStream ? '--no-stream' : '';
      const { stdout } = await execAsync(`docker stats ${noStream} ${args.container} --no-trunc --format "{{json .}}"`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('container_stats', error);
    }
  }
  
  // 新增 - 镜像管理方法
  private async buildImage(args: BuildImageArgs) {
    this.logRequest('build_image', args);
    
    try {
      const dockerfile = args.dockerfile ? `-f ${args.dockerfile}` : '';
      const noCache = args.noCache ? '--no-cache' : '';
      const pull = args.pull ? '--pull' : '';
      
      // 处理构建参数
      let buildArgsStr = '';
      if (args.buildArgs) {
        buildArgsStr = Object.entries(args.buildArgs)
          .map(([key, value]) => `--build-arg ${key}=${value}`)
          .join(' ');
      }
      
      const { stdout } = await execAsync(`docker build ${dockerfile} ${noCache} ${pull} ${buildArgsStr} -t ${args.tag} ${args.context}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('build_image', error);
    }
  }
  
  private async pruneImages(args: PruneImagesArgs = {}) {
    this.logRequest('prune_images', args);
    
    try {
      const all = args.all ? '--all' : '';
      const filter = args.filter ? `--filter ${args.filter}` : '';
      
      const { stdout } = await execAsync(`docker image prune -f ${all} ${filter}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('prune_images', error);
    }
  }
  
  // 新增 - 网络管理方法
  private async listNetworks() {
    this.logRequest('list_networks', {});
    
    try {
      const { stdout } = await execAsync('docker network ls --format "{{json .}}"');
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('list_networks', error);
    }
  }
  
  private async createNetwork(args: CreateNetworkArgs) {
    this.logRequest('create_network', args);
    
    try {
      const driver = args.driver ? `--driver ${args.driver}` : '';
      const subnet = args.subnet ? `--subnet ${args.subnet}` : '';
      const gateway = args.gateway ? `--gateway ${args.gateway}` : '';
      const internal = args.internal ? '--internal' : '';
      
      const { stdout } = await execAsync(`docker network create ${driver} ${subnet} ${gateway} ${internal} ${args.name}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('create_network', error);
    }
  }
  
  private async removeNetwork(args: NetworkArgs) {
    this.logRequest('remove_network', args);
    
    try {
      const { stdout } = await execAsync(`docker network rm ${args.name}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('remove_network', error);
    }
  }
  
  private async networkConnect(args: NetworkConnectArgs) {
    this.logRequest('network_connect', args);
    
    try {
      const alias = args.alias ? args.alias.map(a => `--alias ${a}`).join(' ') : '';
      
      const { stdout } = await execAsync(`docker network connect ${alias} ${args.network} ${args.container}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('network_connect', error);
    }
  }
  
  // 新增 - 卷管理方法
  private async listVolumes() {
    this.logRequest('list_volumes', {});
    
    try {
      const { stdout } = await execAsync('docker volume ls --format "{{json .}}"');
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('list_volumes', error);
    }
  }
  
  private async createVolume(args: CreateVolumeArgs) {
    this.logRequest('create_volume', args);
    
    try {
      const driver = args.driver ? `--driver ${args.driver}` : '';
      
      // 处理标签
      let labelsStr = '';
      if (args.labels) {
        labelsStr = Object.entries(args.labels)
          .map(([key, value]) => `--label ${key}=${value}`)
          .join(' ');
      }
      
      const { stdout } = await execAsync(`docker volume create ${driver} ${labelsStr} ${args.name}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('create_volume', error);
    }
  }
  
  private async removeVolume(args: VolumeArgs) {
    this.logRequest('remove_volume', args);
    
    try {
      const { stdout } = await execAsync(`docker volume rm ${args.name}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('remove_volume', error);
    }
  }
  
  // 新增 - 系统信息方法
  private async systemInfo(args: SystemInfoArgs = {}) {
    this.logRequest('system_info', args);
    
    try {
      const format = args.format ? `--format "${args.format}"` : '';
      
      const { stdout } = await execAsync(`docker system info ${format}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('system_info', error);
    }
  }
  
  private async systemDf(args: SystemDiskUsageArgs = {}) {
    this.logRequest('system_df', args);
    
    try {
      const verbose = args.verbose ? '--verbose' : '';
      
      const { stdout } = await execAsync(`docker system df ${verbose} --format "{{json .}}"`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('system_df', error);
    }
  }
  
  // 新增 - 安全检查方法
  private async securityScan(args: SecurityScanArgs) {
    this.logRequest('security_scan', args);
    
    try {
      const verbose = args.verbose ? '--verbose' : '';
      
      // 注意：安全扫描需要外部工具，这里仅作为示例
      // 实际使用时需要确保已安装扫描工具，如 trivy、clair 等
      // 此处使用 trivy 作为例子（需事先安装）
      const { stdout } = await execAsync(`trivy image ${verbose} ${args.image}`);
      
      return {
        content: [
          {
            type: 'text',
            text: stdout
          }
        ]
      };
    } catch (error) {
      return this.handleError('security_scan', error);
    }
  }

  // 辅助方法：记录请求信息
  private logRequest(method: string, params: any) {
    console.log(`[${new Date().toISOString()}] Request: ${method}`, JSON.stringify(params));
  }

  // 辅助方法：处理错误
  private handleError(method: string, error: any) {
    console.error(`[${new Date().toISOString()}] Error in ${method}:`, error);
    
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error executing ${method}: ${error.message || error}`
        }
      ]
    };
  }

  private async setupStdioTransport() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Docker MCP server running on stdio');
  }

  private setupHttpServer(): Promise<void> {
    return new Promise<void>((resolve) => {
      // 创建HTTP服务器
      this.httpServer = http.createServer((req, res) => {
        const url = req.url || '';
        
        // 处理SSE连接
        if (url === '/mcp/events' && req.method === 'GET') {
          // 设置SSE响应头
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          
          // 发送初始连接消息 - 确保是有效的JSON格式
          res.write(`data: {"type":"connection","status":"connected"}\n\n`);
          
          // 添加到SSE客户端列表
          this.sseClients.push(res);
          
          // 当客户端断开连接时
          req.on('close', () => {
            this.sseClients = this.sseClients.filter(client => client !== res);
          });
        } 
        // 处理客户端到服务器的请求 - 添加JSON-RPC支持
        else if (url === '/mcp' && req.method === 'POST') {
          let body = '';
          
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          
          req.on('end', () => {
            try {
              // 解析请求体
              const message = JSON.parse(body);
              
              // 确保是完整的JSON-RPC请求
              if (message.jsonrpc !== '2.0' || !message.method) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id: message.id || null,
                  error: {
                    code: -32600,
                    message: 'Invalid Request'
                  }
                }));
                return;
              }
              
              // 处理请求 (在实际实现中，这里应该转发到MCP服务器)
              const response = {
                jsonrpc: '2.0',
                id: message.id,
                result: {
                  message: 'Received but not implemented in this HTTP handler'
                }
              };
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(response));
            } catch (e) {
              console.error('Error parsing message:', e);
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: {
                  code: -32700,
                  message: 'Parse error'
                }
              }));
            }
          });
        }
        // 处理CORS预检请求
        else if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          });
          res.end();
        }
        // 处理其他请求
        else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Docker MCP Server running. Use SSE endpoint /mcp/events to connect or POST to /mcp for JSON-RPC requests.');
        }
      });
      
      // 启动HTTP服务器
      this.httpServer.listen(this.port, this.host, () => {
        console.log(`HTTP server running at http://${this.host}:${this.port}`);
        console.log(`- GET /mcp/events # SSE事件流，接收服务器消息`);
        console.log(`- POST /mcp # 发送JSON-RPC请求到服务器`);
        resolve();
      });
    });
  }

  async run() {
    if (this.transportType === 'http') {
      // 如果使用HTTP模式，先启动Stdio传输，然后启动HTTP服务器
      await this.setupStdioTransport();
      await this.setupHttpServer();
      console.log("MCP服务器现在支持HTTP/SSE传输！");
      console.log("注意：当前HTTP服务仅提供单向SSE流，用于接收服务器发送的事件。");
      console.log("对于完整的双向通信，请使用标准Stdio传输。");
    } else {
      await this.setupStdioTransport();
    }
  }
}

// 启动服务器
const server = new DockerServer({
  transport: transportType,
  port: port,
  host: host
});

server.run().catch(console.error);
