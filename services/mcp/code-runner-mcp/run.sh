#!/bin/sh
set -e

echo "Using Deno at: $(which deno)"
echo "DENO_DIR: $DENO_DIR"

# 캐시 디렉토리 확인
if [ ! -d "$DENO_DIR" ]; then
    echo "Creating DENO_DIR at $DENO_DIR"
    mkdir -p "$DENO_DIR"
fi

# 캐시 상태 확인
echo "Checking cache status..."
ls -la "$DENO_DIR" 2>/dev/null || echo "DENO_DIR is empty"

# 이동 및 캐시 체크
cd /app/services/mcp/code-runner-mcp/packages/code-runner-mcp

# 의존성이 캐시되어 있는지 확인하고 필요시 캐시
echo "Checking if dependencies are cached..."
if ! deno run -A --import-map=/app/services/mcp/code-runner-mcp/import_map.json --check src/stdio.server.ts > /dev/null 2>&1; then
    echo "Dependencies not cached, caching now..."
    deno cache --import-map=/app/services/mcp/code-runner-mcp/import_map.json src/stdio.server.ts || echo "Cache failed, continuing anyway..."
fi

# 메인 서비스 실행 - Use minimal version for testing
echo "Starting MCP server (minimal version for testing)..."
exec deno run -A --import-map=/app/services/mcp/code-runner-mcp/import_map.json src/stdio-minimal.ts