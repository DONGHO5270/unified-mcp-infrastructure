#!/bin/sh
cd /app/services/mcp/mermaid-mcp

# Set Playwright environment
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
export DISPLAY=:99

# Start Xvfb if not running (for headless browser)
if ! pgrep Xvfb > /dev/null; then
  echo "[Mermaid MCP] Starting Xvfb..." >&2
  Xvfb :99 -screen 0 1280x720x24 -nolisten tcp -nolisten unix &
  sleep 2
fi

# Install Playwright dependencies if needed
if [ ! -d "node_modules/playwright" ]; then
  echo "[Mermaid MCP] Installing Playwright dependencies..." >&2
  cp package-playwright.json package.json
  npm install --no-save
fi

# Use Playwright-based implementation
if [ -f "mermaid-playwright.js" ]; then
  echo "[Mermaid MCP] Starting Playwright-based Mermaid server..." >&2
  exec node mermaid-playwright.js
else
  echo "[Mermaid MCP] Playwright implementation not found" >&2
  exit 1
fi
