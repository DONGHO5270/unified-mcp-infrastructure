#!/bin/sh
cd /app/services/mcp/code-checker-mcp
export PYTHONPATH="/app/services/mcp/code-checker-mcp/src:$PYTHONPATH"
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8

# Install pylint for better code analysis (optional)
if ! command -v pylint >/dev/null 2>&1; then
    echo "[Code Checker MCP] Installing pylint for enhanced analysis..."
    pip install pylint >/dev/null 2>&1 || true
fi

# Use the real implementation
echo "[Code Checker MCP] Starting real code analysis server..."
exec python3 -u real_mcp_server.py