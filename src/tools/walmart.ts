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

export function registerWalmartTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_walmart",
    `Search Walmart and return product listings as JSON. Each result includes title, product ID, price, rating, and image URL. Use when the user wants to find products on Walmart or compare prices with Amazon.`,
    {
      query: z.string().min(1).max(500)
        .describe("Product search query, e.g. 'air fryer 6 quart'."),
      domain: z.string().optional()
        .describe("Walmart domain."),
      device: z.enum(["desktop", "mobile", "tablet"]).optional()
        .describe("Device to emulate."),
      sort_by: z.enum(["best_match", "price_low", "price_high", "best_seller"]).default("best_match")
        .describe("Sort order for results."),
      start_page: z.number().int().min(1).optional()
        .describe("Starting page (1-indexed)."),
      min_price: z.number().optional()
        .describe("Minimum price filter in USD."),
      max_price: z.number().optional()
        .describe("Maximum price filter in USD."),
      fulfillment_speed: z.enum(["today", "tomorrow", "2_days", "anytime"]).default("anytime")
        .describe("Delivery speed filter."),
      fulfillment_type: z.enum(["in_store"]).optional()
        .describe("Fulfillment type filter."),
      delivery_zip: z.string().optional()
        .describe("ZIP code for localized results."),
      store_id: z.string().optional()
        .describe("Store id for in-store availability."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_product",
    `Get detailed information for a Walmart product by its product ID. Returns title, full description, price, rating, images, and seller info. Use when the user has a specific Walmart product URL or product ID and wants full details.`,
    {
      product_id: z.string()
        .describe("Walmart product ID — numeric string from the product URL (/ip/name/PRODUCT_ID)."),
      domain: z.string().optional()
        .describe("Walmart domain."),
      device: z.enum(["desktop", "mobile", "tablet"]).optional()
        .describe("Device to emulate."),
      delivery_zip: z.string().optional()
        .describe("ZIP code for localized pricing."),
      store_id: z.string().optional()
        .describe("Store id for in-store availability."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/product", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
