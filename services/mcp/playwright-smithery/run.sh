#!/bin/sh
cd /app/services/mcp/playwright-smithery

# Smithery API configuration
export SMITHERY_API_KEY="f74ce18b-8505-49ce-8752-ea73c5eec2c3"
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

echo "[Playwright Smithery] Starting Smithery proxy for Playwright MCP..." >&2
exec node smithery-stdio-proxy.js