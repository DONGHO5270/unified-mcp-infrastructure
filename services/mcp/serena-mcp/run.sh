#!/bin/sh
cd /app/services/mcp/serena-mcp

# Set environment variables
export PYTHONPATH="/app/services/mcp/serena-mcp/src:/app/services/mcp/serena-mcp:$PYTHONPATH"
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8
export SERENA_PROJECT_DIR=/app/services/mcp/serena-mcp
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# Check for real Serena MCP server first
echo "[Serena MCP] Checking server availability..." >&2

# Try complete Serena MCP server first (all real tools)
if [ -f "enhanced_mcp_v2.py" ]; then
    echo "[Serena MCP] Starting Enhanced MCP Server v2 with 17 real tools..." >&2
    exec python3 -u enhanced_mcp_v2.py
elif [ -f "enhanced_mcp.py" ]; then
    echo "[Serena MCP] Starting Enhanced MCP Server with real code analysis..." >&2
    exec python3 -u enhanced_mcp.py
elif [ -f "serena_complete_server.py" ]; then
    echo "[Serena MCP] Starting Complete Serena MCP Server with all real tools..." >&2
    exec python3 -u serena_complete_server.py
elif [ -f "serena_real_server.py" ]; then
    echo "[Serena MCP] Starting Real Serena MCP Server with all dependencies..." >&2
    exec python3 -u serena_real_server.py
elif [ -f "enhanced_stub.py" ]; then
    echo "[Serena MCP] Starting Enhanced Serena MCP Server v2.0..." >&2
    exec python3 -u enhanced_stub.py
elif [ -f "fixed_stub.py" ]; then
    echo "[Serena MCP] Starting enhanced stub server (no dependencies)..." >&2
    exec python3 -u fixed_stub.py
elif [ -f "simple_stub.py" ]; then
    echo "[Serena MCP] Starting simple stub server..." >&2
    exec python3 -u simple_stub.py
elif [ -f "mcp_wrapper.py" ]; then
    echo "[Serena MCP] Trying wrapped Serena server (requires aiofiles)..." >&2
    exec python3 -u mcp_wrapper.py
elif [ -f "main.py" ] && command -v pyright >/dev/null 2>&1; then
    echo "[Serena MCP] Starting full Serena with language servers..." >&2
    exec python3 -u main.py
else
    echo "[Serena MCP] No suitable server found..." >&2
    exit 1
fi