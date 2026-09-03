import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerExtractTool(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "extract_url",
    `Read any web page as Markdown, text, or HTML. Tier-priced: normal=1cr, advanced(JS render)=1cr, ultra(residential proxy)=2cr. Start normal, escalate on empty/blocked. Only billed on success.`,
    {
      url: z.string().min(1).max(2048)
        .describe("http(s) URL. Bare hosts upgraded to https. Private/loopback rejected."),
      format: z.enum(["html", "markdown", "text"]).optional()
        .describe("'markdown' (default), 'text', or 'html'."),
      mode: z.enum(["normal", "advanced", "ultra"]).optional()
        .describe("PRICE-BEARING. 'normal'=1cr (default), 'advanced'=JS render 1cr, 'ultra'=residential 2cr."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/extract", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
