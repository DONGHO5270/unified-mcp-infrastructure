#!/bin/sh
cd /app/services/mcp/github-mcp

# Try the real implementation first
if [ -f "github-real.cjs" ]; then
  echo "[GitHub MCP] Using real implementation..."
  exec node github-real.cjs
elif [ -f "github/mcp-server.js" ]; then
  echo "[GitHub MCP] Trying original server..."
  cd github
  # Install just this workspace dependencies
  npm install --no-package-lock --no-workspaces 2>/dev/null || true
  exec node mcp-server.js
else
  echo "[GitHub MCP] No implementation found"
  exit 1
fi
