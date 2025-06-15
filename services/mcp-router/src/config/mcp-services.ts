import { MCPService } from '../types';

export const MCP_SERVICES_CONFIG: Record<string, MCPService> = {
  // GitHub MCP (monorepo structure)
  'github': {
    name: 'github',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/github-mcp',
    env: {
      GITHUB_TOKEN: process.env.GITHUB_MCP_TOKEN || ''
    },
    capabilities: ['tools', 'resources'],
    startupTimeout: 15000  // tsx 로딩 시간 고려
  },
  
  // Serena MCP (Python) - Semantic code analysis with fallback
  'serena': {
    name: 'serena',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/serena-mcp',
    env: {
      SERENA_PROJECT_DIR: process.env.SERENA_PROJECT_DIR || '/app',
      PYTHONPATH: '/app/services/mcp/serena-mcp/src:/app/services/mcp/serena-mcp',
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUNBUFFERED: '1'
    },
    capabilities: ['tools'],
    startupTimeout: 15000  // 빠른 fallback으로 단축
  },
  
  // Playwright MCP (Real Implementation with System Chromium)
  'playwright': {
    name: 'playwright',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/playwright-mcp',
    env: {
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: 'true',
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/usr/bin/chromium',
      DISPLAY: ':99',
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8'
    },
    capabilities: ['tools'],
    startupTimeout: 15000  // 실제 브라우저 시작을 위한 충분한 시간
  },
  
  // Serper Search MCP
  'serper-search': {
    name: 'serper-search',
    command: 'node',
    args: ['build/index.js'],
    cwd: '/app/services/mcp/serper-search-mcp',
    env: {
      SERPER_API_KEY: process.env.SERPER_MCP_API_KEY || ''
    },
    capabilities: ['tools']
  },
  
  // Desktop Commander MCP
  'desktop-commander': {
    name: 'desktop-commander',
    command: 'node',
    args: ['dist/index.js'],
    cwd: '/app/services/mcp/desktop-commander-mcp',
    env: {
      ALLOWED_PATHS: process.env.DESKTOP_COMMANDER_ALLOWED_PATHS || '/workspace'
    },
    capabilities: ['tools']
  },
  
  // Clear Thought MCP (workspace structure)
  'clear-thought': {
    name: 'clear-thought',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/clear-thought-mcp',
    env: {},
    capabilities: ['tools'],
    startupTimeout: 10000
  },
  
  // Context7 MCP
  'context7': {
    name: 'context7',
    command: 'node',
    args: ['dist/index.js'],
    cwd: '/app/services/mcp/context7-mcp',
    env: {
      CONTEXT7_API_KEY: process.env.CONTEXT7_API_KEY || ''
    },
    capabilities: ['tools', 'resources']
  },
  
  // Taskmaster AI MCP
  'taskmaster-ai': {
    name: 'taskmaster-ai',
    command: 'sh',
    args: ['run-fixed.sh'],
    cwd: '/app/services/mcp/taskmaster-ai-mcp',
    env: {
      ANTHROPIC_API_KEY: process.env.TASKMASTER_ANTHROPIC_API_KEY || '',
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
      OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3.2',
      USE_OLLAMA: process.env.USE_OLLAMA || 'false',
      LLM_PROVIDER: process.env.LLM_PROVIDER || 'anthropic',
      TASKMASTER_WAIT_FOR_ALL: 'true',  // Ensure all 25 tools are loaded
      TASKMASTER_HOST_MODE: 'true'  // Enable Host Mode for MCP environment
    },
    capabilities: ['tools', 'resources'],
    startupTimeout: 30000  // Increased to allow time for all tools to load
  },
  
  // Stochastic Thinking MCP (workspace structure)
  'stochastic-thinking': {
    name: 'stochastic-thinking',
    command: 'node',
    args: ['packages/server-stochasticthinking/dist/index.js'],
    cwd: '/app/services/mcp/stochastic-thinking-mcp',
    env: {},
    capabilities: ['tools'],
    startupTimeout: 10000
  },
  
  // Vercel MCP
  'vercel': {
    name: 'vercel',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/vercel-mcp',
    env: {
      VERCEL_ID: process.env.VERCEL_MCP_ID || '',
      VERCEL_ACCESS_TOKEN: process.env.VERCEL_MCP_ACCESS_TOKEN || ''
    },
    capabilities: ['tools', 'resources'],
    startupTimeout: 10000
  },
  
  // Code Runner MCP (Deno project)
  'code-runner': {
    name: 'code-runner',
    command: 'sh',
    args: ['run-ultra-minimal.sh'],
    cwd: '/app/services/mcp/code-runner-mcp',
    env: {},
    capabilities: ['tools'],
    startupTimeout: 10000  // Fast fallback
  },
  
  // Supabase MCP (workspace structure)
  'supabase': {
    name: 'supabase',
    command: 'sh',
    args: ['run-direct.sh'],  // Use optimized script that skips problematic dependencies
    cwd: '/app/services/mcp/supabase-mcp',
    env: {
      SUPABASE_URL: process.env.SUPABASE_MCP_URL || '',
      SUPABASE_KEY: process.env.SUPABASE_MCP_KEY || '',
      SUPABASE_PROJECT_REF: process.env.SUPABASE_MCP_PROJECT_REF || '',
      SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_MCP_ACCESS_TOKEN || ''
    },
    capabilities: ['tools', 'resources'],
    startupTimeout: 15000  // Increased for build time
  },
  
  // NodeJS Debugger MCP
  'nodejs-debugger': {
    name: 'nodejs-debugger',
    command: 'node',
    args: ['src/mcp-server.js'],
    cwd: '/app/services/mcp/nodejs-debugger-mcp',
    env: {},
    capabilities: ['tools']
  },
  
  // Code Checker MCP (Python)
  'code-checker': {
    name: 'code-checker',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/code-checker-mcp',
    env: {},
    capabilities: ['tools'],
    startupTimeout: 10000
  },
  
  // NPM Sentinel MCP
  'npm-sentinel': {
    name: 'npm-sentinel',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/npm-sentinel-mcp',
    env: {
      NPM_REGISTRY_URL: process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org'
    },
    capabilities: ['tools']
  },
  
  // Node Omnibus MCP
  'node-omnibus': {
    name: 'node-omnibus',
    command: 'node',
    args: ['build/index.js'],
    cwd: '/app/services/mcp/node-omnibus-mcp',
    env: {},
    capabilities: ['tools']
  },
  
  // 21st.dev Magic MCP
  '21stdev-magic': {
    name: '21stdev-magic',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/21stdev-magic-mcp',
    env: {
      TWENTY_FIRST_API_KEY: process.env.TWENTY_FIRST_MCP_API_KEY || ''
    },
    capabilities: ['tools'],
    startupTimeout: 15000  // Allow time for TypeScript MCP server startup
  },
  
  // Mermaid MCP
  'mermaid': {
    name: 'mermaid',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/mermaid-mcp',
    env: {
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: 'true',
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/usr/bin/chromium',
      DISPLAY: ':99'
    },
    capabilities: ['tools'],
    startupTimeout: 30000  // Playwright 초기화 시간 고려
  },
  
  // Code Context Provider MCP
  'code-context-provider': {
    name: 'code-context-provider',
    command: 'node',
    args: ['dist/index.js'],
    cwd: '/app/services/mcp/code-context-provider-mcp',
    env: {},
    capabilities: ['tools', 'resources']
  },

  // Mem0 MCP - 개발자 코딩 선호도 저장
  'mem0': {
    name: 'mem0',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/mem0-mcp',
    env: {
      MEM0_API_KEY: process.env.MEM0_API_KEY || '',
      PYTHONPATH: '/app/services/mcp/mem0-mcp',
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8'
    },
    capabilities: ['tools'],
    startupTimeout: 10000
  },

  // Docker MCP - Docker 컨테이너 및 Compose 관리
  'docker': {
    name: 'docker',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/docker-mcp',
    env: {
      DOCKER_HOST: process.env.DOCKER_HOST || 'unix:///var/run/docker.sock',
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8'
    },
    capabilities: ['tools'],
    startupTimeout: 10000
  },

  // Sequential Thinking Tools MCP - AI 기반 도구 추천 시스템
  'sequential-thinking-tools': {
    name: 'sequential-thinking-tools',
    command: 'sh',
    args: ['run.sh'],
    cwd: '/app/services/mcp/sequential-thinking-tools',
    env: {
      NODE_ENV: 'production',
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8'
    },
    capabilities: ['tools'],
    startupTimeout: 15000  // NPM 패키지 로딩 시간 고려
  }
};