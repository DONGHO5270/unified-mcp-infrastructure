#!/bin/sh
# Taskmaster-AI MCP Full Server Runner
# This script runs the complete server with all 26 tools

cd /app/services/mcp/taskmaster-ai-mcp

# Set environment variables for project root
export TASKMASTER_PROJECT_ROOT=/app/services/mcp/taskmaster-ai-mcp
export TASKMASTER_PROJECT_DIR=/app/services/mcp/taskmaster-ai-mcp

# Ensure all tools are loaded before service is ready
export TASKMASTER_WAIT_FOR_ALL=true

# Use the wrapper fixed version for compatibility
echo "Starting Taskmaster-AI MCP Server (wrapper-fixed) with all tools..." >&2
exec node mcp-server/server-wrapper-fixed.js