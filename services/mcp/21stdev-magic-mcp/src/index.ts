#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { CreateUiTool } from "./tools/create-ui.js";
import { FetchUiTool } from "./tools/fetch-ui.js";
import { LogoSearchTool } from "./tools/logo-search.js";
import { RefineUiTool } from "./tools/refine-ui.js";

const VERSION = "0.0.46";
const server = new McpServer({
  name: "21st-magic",
  version: VERSION,
});

// Register tools
new CreateUiTool().register(server);
new LogoSearchTool().register(server);
new FetchUiTool().register(server);
new RefineUiTool().register(server);

async function runServer() {
  const transport = new StdioServerTransport();
  // Server starting - no console output to avoid interfering with JSON-RPC

  let isShuttingDown = false;

  const cleanup = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    // Shutting down server
    try {
      transport.close();
    } catch (error) {
      // Error closing transport
    }
    // Server closed
    process.exit(0);
  };

  transport.onerror = (error: Error) => {
    // Transport error occurred
    cleanup();
  };

  transport.onclose = () => {
    // Transport closed unexpectedly
    cleanup();
  };

  process.on("SIGTERM", () => {
    // Received SIGTERM
    cleanup();
  });

  process.on("SIGINT", () => {
    // Received SIGINT
    cleanup();
  });

  process.on("beforeExit", () => {
    // Received beforeExit
    cleanup();
  });

  await server.connect(transport);
  // Server started successfully
}

runServer().catch((error) => {
  // Fatal error running server
  if (!process.exitCode) {
    process.exit(1);
  }
});
