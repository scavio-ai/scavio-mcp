import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { ScavioClient } from "../lib/client.js";
import { ApiError } from "../lib/errors.js";

function handleApiError(err: unknown): never | { isError: true; content: { type: "text"; text: string }[] } {
  if (err instanceof ApiError) {
    if (err.status === 429) return { isError: true, content: [{ type: "text", text: "Rate limited. Wait and retry." }] };
    if (err.status === 401) throw new McpError(ErrorCode.InternalError, "Invalid SCAVIO_API_KEY. Check your configuration.");
    return { isError: true, content: [{ type: "text", text: `Scavio API error (${err.status}): ${err.message}` }] };
  }
  throw new McpError(ErrorCode.InternalError, String(err));
}

export function registerAmazonTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_amazon",
    `Search Amazon and return product listings as JSON. Each result includes title, ASIN, price, rating, review count, and image URL. Use when the user wants to find products on Amazon or compare prices.`,
    {
      query: z.string().min(1).max(500)
        .describe("Product search query, e.g. 'wireless noise cancelling headphones'."),
      domain: z.string().default("com")
        .describe("Amazon domain suffix, e.g. 'com' (US), 'co.uk' (UK), 'de' (Germany), 'co.jp' (Japan)."),
      sort_by: z.enum(["most_recent", "price_low_to_high", "price_high_to_low", "featured", "average_review", "bestsellers"]).default("featured")
        .describe("Sort order for results."),
      start_page: z.number().int().min(1).default(1)
        .describe("Starting page number."),
      min_price: z.number().optional()
        .describe("Minimum price filter in the domain's local currency."),
      max_price: z.number().optional()
        .describe("Maximum price filter in the domain's local currency."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/amazon/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_amazon_product",
    `Get detailed information for an Amazon product by its ASIN. Returns title, full description, price, rating, review count, images, variants, and seller info. Use when the user has a specific Amazon product URL or ASIN and wants full details.`,
    {
      query: z.string().length(10)
        .describe("Amazon ASIN — the 10-character product ID, e.g. 'B09V3KXJPB'. Extract from the Amazon URL (/dp/ASIN)."),
      domain: z.string().default("com")
        .describe("Amazon domain suffix, e.g. 'com', 'co.uk', 'de'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/amazon/product", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
