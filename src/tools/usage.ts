import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { ScavioClient } from "../lib/client.js";
import { ApiError } from "../lib/errors.js";

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
        if (err instanceof ApiError) {
          if (err.status === 429) return { isError: true, content: [{ type: "text", text: "Rate limited. Wait and retry." }] };
          if (err.status === 401) throw new McpError(ErrorCode.InternalError, "Invalid SCAVIO_API_KEY. Check your configuration.");
          return { isError: true, content: [{ type: "text", text: `Scavio API error (${err.status}): ${err.message}` }] };
        }
        throw new McpError(ErrorCode.InternalError, String(err));
      }
    },
  );
}
