import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerUsageTool(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_usage",
    `Get credit balance, plan, and usage stats. Free.`,
    {},
    async () => {
      try {
        const data = await getClient().get("/api/v1/usage");
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
