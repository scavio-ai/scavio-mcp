import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { registerGoogleTools } from "./google.js";
import { registerYoutubeTools } from "./youtube.js";
import { registerAmazonTools } from "./amazon.js";
import { registerWalmartTools } from "./walmart.js";
import { registerUsageTool } from "./usage.js";
import { registerTiktokTools } from "./tiktok.js";
import { registerInstagramTools } from "./instagram.js";
import { registerRedditTools } from "./reddit.js";

export function registerAllTools(server: McpServer, getClient: () => ScavioClient): void {
  registerGoogleTools(server, getClient);
  registerYoutubeTools(server, getClient);
  registerAmazonTools(server, getClient);
  registerWalmartTools(server, getClient);
  registerTiktokTools(server, getClient);
  registerInstagramTools(server, getClient);
  registerRedditTools(server, getClient);
  registerUsageTool(server, getClient);
}
