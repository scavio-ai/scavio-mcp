#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { env } from "./lib/env.js";
import { ScavioClient } from "./lib/client.js";
import { registerAllTools, PLATFORM_KEYS, DEFAULT_PLATFORMS } from "./tools/index.js";

const SERVER_NAME = "scavio-mcp";

/**
 * Read from package.json rather than a literal. The literal drifted to five
 * minor versions behind npm, and it is the version every client is handed
 * during `initialize`. src/ and dist/ are both one level under the package
 * root, so this resolves identically under tsx and under node dist/index.js.
 */
const SERVER_VERSION: string = (
  JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
  ) as { version: string }
).version;

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
  const platforms = registerAllTools(server, () => client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `${SERVER_NAME} v${SERVER_VERSION} started (stdio) - platforms: ${platforms.join(", ") || "none"}` +
      `${env.SCAVIO_PLATFORMS ? "" : " (default set; set SCAVIO_PLATFORMS=all for every platform)"}`,
  );
}

async function startHttp() {
  const { Hono } = await import("hono");
  const { serve } = await import("@hono/node-server");
  const { WebStandardStreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
  );

  const app = new Hono();

  app.get("/", (c) =>
    c.json({
      status: "ok",
      server: SERVER_NAME,
      version: SERVER_VERSION,
      platforms: PLATFORM_KEYS,
      default_platforms: DEFAULT_PLATFORMS,
    }),
  );
  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/mcp", async (c) => {
    const apiKey =
      c.req.header("x-api-key") ??
      c.req.header("authorization")?.replace("Bearer ", "") ??
      c.req.query("api_key");

    if (!apiKey) {
      return c.json({ error: "Missing SCAVIO_API_KEY. Provide x-api-key or Authorization: Bearer header." }, 401);
    }

    // A hosted remote has no per-user env var, so the allowlist is selectable
    // per connection. Falls back to SCAVIO_PLATFORMS, then to the default set.
    const platforms =
      c.req.header("x-scavio-platforms") ?? c.req.query("platforms") ?? env.SCAVIO_PLATFORMS;

    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    const client = new ScavioClient(apiKey);
    registerAllTools(server, () => client, platforms);

    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.error(`${SERVER_NAME} v${SERVER_VERSION} started (http) on port ${info.port}`);
  });
}
