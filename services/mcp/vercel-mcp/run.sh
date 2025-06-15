#!/bin/sh
cd /app/services/mcp/vercel-mcp

# 환경 변수 설정
export NODE_ENV=production

# Vercel API 토큰 확인
if [ -z "$VERCEL_MCP_ACCESS_TOKEN" ]; then
    echo "Warning: VERCEL_MCP_ACCESS_TOKEN not set, using default"
fi

# dist/index.js 실행
exec node dist/index.js