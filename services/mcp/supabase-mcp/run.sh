#!/bin/sh
cd /app/services/mcp/supabase-mcp

# Check if the correct build exists
if [ -f "packages/mcp-server-supabase/dist/transports/stdio.js" ]; then
    echo "[Supabase MCP] Using built stdio transport..."
    exec node packages/mcp-server-supabase/dist/transports/stdio.js
elif [ -f "packages/mcp-server-supabase/src/transports/stdio.ts" ]; then
    echo "[Supabase MCP] Build not found, attempting to build..."
    npm install --workspaces --if-present
    npm run build --workspace=packages/mcp-server-supabase
    
    if [ -f "packages/mcp-server-supabase/dist/transports/stdio.js" ]; then
        exec node packages/mcp-server-supabase/dist/transports/stdio.js
    else
        echo "[Supabase MCP] Build failed, using stub server..."
        exec node stub-server.js
    fi
else
    echo "[Supabase MCP] Using stub server (no access token or build issues)..."
    exec node stub-server.js
fi