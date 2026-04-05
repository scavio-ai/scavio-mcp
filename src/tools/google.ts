import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { ScavioClient } from "../lib/client.js";
import { ApiError } from "../lib/errors.js";

export function registerGoogleTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_google",
    `Search Google and return structured results as JSON. Each result includes title, URL, and snippet. Also returns top stories, knowledge graph, local results, news, images, and related searches depending on search type. Use when the user asks to search the web, find current information, or look something up online. Returns 1 credit (light) or 2 credits (full).`,
    {
      query: z.string().min(1).max(500)
        .describe("The search query."),
      search_type: z.enum(["classic", "news", "maps", "images", "lens"]).default("classic")
        .describe("Type of search. Use 'news' for recent articles, 'maps' for local results, 'images' for image results."),
      country_code: z.string().length(2).default("us")
        .describe("ISO 3166-1 alpha-2 country code, e.g. 'us', 'gb', 'fr'."),
      language: z.string().default("en")
        .describe("Language code, e.g. 'en', 'fr', 'de'."),
      page: z.number().int().min(1).max(100).default(1)
        .describe("Page number, 1-indexed."),
      device: z.enum(["desktop", "mobile"]).default("desktop")
        .describe("Device type for results."),
      light_request: z.boolean().default(true)
        .describe("true = 1 credit (fewer results). false = 2 credits (full results). Use false only when the user needs comprehensive results."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/google", params);
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
