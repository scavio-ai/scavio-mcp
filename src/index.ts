#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { env } from "./lib/env.js";
import { ScavioClient } from "./lib/client.js";
import { registerAllTools } from "./tools/index.js";

const SERVER_NAME = "scavio-mcp";
const SERVER_VERSION = "0.1.0";

if (env.TRANSPORT === "stdio") {
  await startStdio();
} else {
  await startHttp();
}

async function startStdio() {
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/stdio.js"
  );

  const apiKey = env.SCAVIO_API_KEY;
  if (!apiKey) {
    console.error("SCAVIO_API_KEY is required for stdio transport");
    process.exit(1);
  }

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const client = new ScavioClient(apiKey);
  registerAllTools(server, () => client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} started (stdio)`);
}

async function startHttp() {
  const { Hono } = await import("hono");
  const { serve } = await import("@hono/node-server");
  const { WebStandardStreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
  );

  const app = new Hono();

  app.get("/", (c) => c.json({ status: "ok", server: SERVER_NAME }));
  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/mcp", async (c) => {
    const apiKey =
      c.req.header("x-api-key") ??
      c.req.header("authorization")?.replace("Bearer ", "") ??
      c.req.query("api_key");

    if (!apiKey) {
      return c.json({ error: "Missing SCAVIO_API_KEY. Provide x-api-key or Authorization: Bearer header." }, 401);
    }

    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    const client = new ScavioClient(apiKey);
    registerAllTools(server, () => client);

    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.error(`${SERVER_NAME} started (http) on port ${info.port}`);
  });
}
