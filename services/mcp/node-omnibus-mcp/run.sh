#!/bin/sh
cd /app/services/mcp/node-omnibus-mcp

echo "[Node Omnibus MCP] Building TypeScript project..." >&2

# Build the TypeScript project
npm run build

echo "[Node Omnibus MCP] Starting server..." >&2

# Run the built server
exec node build/index.js