import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. That matters more here than elsewhere: Home Depot
// does NOT fall back on an unknown sort — it answers 200 with an empty page
// that scrape.do still bills — so a bad value costs credits and returns
// nothing. Upstream defaults are documented in the describe text instead.

export function registerHomeDepotTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_home_depot",
    `Search Home Depot products. Fixed 12 items/page. Invalid sort_by returns billed empty page. 2 credits/page.`,
    {
      query: z.string().min(1).max(500)
        .describe("Search query, e.g. 'cordless drill 20v'."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based, fixed 12/page."),
      sort_by: z.enum(["best_match", "top_sellers", "top_rated", "price_low", "price_high"]).optional()
        .describe("Sort order. Default 'best_match'."),
      min_price: z.number().min(0).optional()
        .describe("Min price USD."),
      max_price: z.number().min(0).optional()
        .describe("Max price USD."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/homedepot/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_home_depot_product",
    `Get full Home Depot product detail. Only 10-review preview; use get_home_depot_reviews for full reviews. 2 credits.`,
    {
      item_id: z.string().min(1)
        .describe("Item id, e.g. '206566893', or homedepot.com URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/homedepot/product", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_home_depot_reviews",
    `Get Home Depot product reviews. 30/page, stop at total_pages. 2 credits/page.`,
    {
      item_id: z.string().min(1)
        .describe("Item id, e.g. '206566893', or homedepot.com URL."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based, 30/page."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/homedepot/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
