import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

export function registerUsageTool(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_usage",
    `Get the current user's credit balance, plan, searches used this month, and auto-recharge settings. Use when the user asks how many credits they have left, what plan they're on, or about their usage.`,
    {},
    async () => {
      try {
        const data = await getClient().get("/api/v1/usage");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
