#!/bin/sh
cd /app/services/mcp/mem0-mcp

# Python 환경 설정
export PYTHONPATH=/app/services/mcp/mem0-mcp:$PYTHONPATH
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

echo "Starting enhanced mem0 MCP server with persistent storage..." >&2

# 영속적 저장소를 지원하는 향상된 서버 실행
exec python3 mem0_service.py