#!/bin/sh
cd /app/services/mcp/playwright-mcp

# Set environment for Docker
export DISPLAY=:99
export PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright

# Start Xvfb if not running
if ! pgrep Xvfb > /dev/null; then
  echo "[Playwright MCP] Starting Xvfb..." >&2
  Xvfb :99 -screen 0 1280x720x24 -nolisten tcp -nolisten unix &
  sleep 2
fi

# Build TypeScript if needed
if [ -f "package.json" ] && [ -f "tsconfig.json" ]; then
  echo "[Playwright MCP] Building TypeScript..." >&2
  npm run build 2>/dev/null || echo "[Playwright MCP] Build failed, using existing files..."
fi

# Check for real implementation first
if [ -f "playwright-real.cjs" ]; then
  echo "[Playwright MCP] Using real implementation..." >&2
  exec node playwright-real.cjs
elif [ -f "mcp-wrapper.js" ]; then
  echo "[Playwright MCP] Using Docker wrapper..." >&2
  exec node mcp-wrapper.js
elif [ -f "cli.js" ]; then
  echo "[Playwright MCP] Using CLI entry point..." >&2
  exec node cli.js --browser chromium --headless
else
  echo "[Playwright MCP] Error: No valid entry point found" >&2
  exit 1
fi