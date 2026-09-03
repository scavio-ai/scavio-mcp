import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Every description opens "Target.com, the US retailer" on purpose: read out of
// context, a tool called get_target_* is easily taken for "the target of the
// operation". The brand has to be established in the first clause, before the
// model has decided what the tool is for.
//
// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. Upstream defaults are documented in the describe
// text and left for the backend to apply.

const SORT_DESCRIPTION =
  "Sort order. Upstream default is 'relevance'.";

const storeIdField = z.string().optional()
  .describe("Target store id for prices/availability. Default '3991'.");

export function registerTargetTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_target_products",
    `Search Target.com products. Slow (~9s/call, headless browser). Max 28/page. 1 credit/page.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search keyword, e.g. 'office chair'."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      count: z.number().int().min(1).max(28).optional()
        .describe("Items/page, max 28. Default 24."),
      sort: z.enum(["relevance", "featured", "price_low", "price_high", "rating_high", "best_seller", "newest"]).optional()
        .describe(SORT_DESCRIPTION),
      store_id: storeIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/target/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_target_category",
    `List Target.com products in a category. Very slow (~37s/call). Max 28/page. 1 credit/page.`,
    {
      category_id: z.string().min(1)
        .describe("Segment after N- in target.com /c/ URL, e.g. '5xtg6'."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      count: z.number().int().min(1).max(28).optional()
        .describe("Items/page, max 28. Default 24."),
      sort: z.enum(["relevance", "featured", "price_low", "price_high", "rating_high", "best_seller", "newest"]).optional()
        .describe(SORT_DESCRIPTION),
      store_id: storeIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/target/category", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_target_product",
    `Get full Target.com product detail by TCIN. Child TCIN returns variation parent. 1 credit.`,
    {
      tcin: z.string().min(1)
        .describe("TCIN from target.com /p/ URL, e.g. '54551690'."),
      store_id: storeIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/target/product", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_target_reviews",
    `Get Target.com product reviews. HARD CAP: 8 reviews max, no pagination. ~40s/call. 1 credit.`,
    {
      tcin: z.string().min(1)
        .describe("TCIN, e.g. '54551690'."),
      limit: z.number().int().min(1).optional()
        .describe("Trim returned reviews. Max 8 regardless."),
      store_id: storeIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/target/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
