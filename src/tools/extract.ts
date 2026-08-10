import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

export function registerExtractTool(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "extract_url",
    `Read any web page. Returns the page as clean Markdown, plain text, or raw HTML. This is the general read-a-page primitive: point it at any http(s) URL - an article, a docs page, a product page, a changelog, a competitor's pricing page - and get the body back as text you can reason over. Returns { url, format, mode, content, content_length }. Formats: 'markdown' (readability extraction, the default and the best choice for reading), 'text' (that Markdown flattened to plain prose), 'html' (the raw unprocessed page). COST IS TIER-PRICED BY THE mode PARAMETER, NOT FLAT: mode='normal' (plain fetch) costs 1 credit, mode='advanced' (full JavaScript rendering, for React/Vue pages that are empty without it) costs 1 credit, mode='ultra' (residential proxy, for hard bot walls and heavy protection) costs 2 credits. Start at 'normal' and escalate only when the content comes back empty or blocked. Billing happens ONLY on a successful extraction - a dead link, a bot wall or a timeout costs nothing. http(s) URLs only; a bare host like 'example.com' is upgraded to https, and loopback, private, link-local and cloud-metadata hosts are rejected with a 400. Returns the whole page in one call - there is no pagination.`,
    {
      url: z.string().min(1).max(2048)
        .describe("The page to read. http(s) only; a bare host such as 'example.com' is upgraded to https. Internal, loopback and private-network hosts are rejected with a 400."),
      format: z.enum(["html", "markdown", "text"]).optional()
        .describe("Output format. 'markdown' = readability extraction of the main content (default, best for reading). 'text' = that Markdown flattened to plain prose. 'html' = the raw unprocessed page."),
      mode: z.enum(["normal", "advanced", "ultra"]).optional()
        .describe("THE PRICE-BEARING PARAMETER. 'normal' = plain fetch, 1 credit (default). 'advanced' = full JavaScript rendering for pages that are empty without it, 1 credit. 'ultra' = residential proxy for hard bot walls, 2 credits. Escalate only when a cheaper mode returns empty or blocked content."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/extract", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
