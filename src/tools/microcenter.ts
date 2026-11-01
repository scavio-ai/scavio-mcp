import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/microcenter.ts. Cross-field rule the
// backend enforces and zod here does not: search takes query, category, or
// both (at least one). No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const SORTS = ["best_match", "rating", "review_count", "price_low", "price_high", "newest"] as const;

const storeId = () =>
  z.string().regex(/^\d{1,3}$/).optional()
    .describe("Micro Center 3-digit store id from get_micro_center_stores, e.g. '131' (Dallas) or '151' (Chicago). Stock counts and open-box units are that store's. Omit for the web store (029), which lists shippable items only.");

export function registerMicroCenterTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/microcenter/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_micro_center",
    `Search Micro Center by keyword or category at one store, up to 96 per page. Each product has product_id, SKU, name, brand, category, price and original price in dollars, highlights, and that store's stock: the label as printed ("4 IN STOCK", "25+ IN STOCK", "NOT CARRIED"), quantity, quantity_capped (counts are capped at 25+), in_stock and not_carried. Open-box count and lowest price, rebate text and in-store-only flag where shown; sponsored placements are flagged. Without store_id the web store (029) is used. 2 credits/call.`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Search keywords, e.g. 'rtx 5070'. Pass this, category, or both."),
      category: z.string().min(1).max(500).optional()
        .describe("Category id, e.g. '518' (Graphics Cards), a 'category:Graphics Cards|518' value, or a microcenter.com listing URL carrying one. Product breadcrumbs carry category ids."),
      store_id: storeId(),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based."),
      per_page: z.union([z.literal(24), z.literal(48), z.literal(96)]).optional()
        .describe("Results per page: 24, 48 or 96 (default)."),
      sort: z.enum(SORTS).optional()
        .describe("best_match (default), rating, review_count, price_low, price_high or newest."),
      include_out_of_stock: z.boolean().optional()
        .describe("Also list products the store has no stock of or does not carry. Default false."),
    },
    post("search"),
  );

  server.tool(
    "get_micro_center_product",
    `One Micro Center product: SKU, MPN, UPC, name, brand, description, price, original price, availability, ship and pickup flags, images, rating, review count, up to 10 recent reviews, breadcrumbs with category ids and the full spec table. selected_store has that store's address, stock (label, quantity, quantity_capped at 25+, in_stock) and each open-box unit (condition, warranty, price). stores_in_stock lists every store with a yes/no in_stock flag, not a count. An unknown product id is a 404. 2 credits.`,
    {
      product_id: z.string().min(1).max(500)
        .describe("Micro Center product id (a search result's product_id, the number after /product/ in a microcenter.com URL), e.g. '691231', or the product URL. Not the SKU."),
      store_id: storeId(),
    },
    post("product"),
  );

  server.tool(
    "get_micro_center_stores",
    `Every Micro Center store with its 3-digit store_id (what search_micro_center and get_micro_center_product take), name, city, state and store page URL; street address and ZIP where known. The web store 029 is not listed but is accepted as a store_id. 1 credit.`,
    {
      state: z.string().regex(/^[A-Za-z]{2}$/).optional()
        .describe("2-letter US state code to filter by, e.g. 'TX'."),
    },
    post("stores"),
  );
}
