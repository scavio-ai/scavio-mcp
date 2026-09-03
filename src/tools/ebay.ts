import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// No zod `.default()` anywhere in this file, on purpose. The MCP SDK applies a
// zod default BEFORE the handler runs, so a defaulted field is posted on every
// single call whether the model set it or not — which is exactly how the
// shipped Walmart tool ended up sending a value the backend enum rejected.
// Upstream defaults are documented in the .describe() text instead and left for
// the backend to apply.

export function registerEbayTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_ebay",
    `Search eBay live or sold listings. sold=true for completed-sale price research. Either query or seller required; seller alone pages their catalogue. per_page only 60/120/240. 1 credit/page.`,
    {
      query: z.string().min(1).max(500).optional()
        .describe("Search keywords. Either this or seller required."),
      seller: z.string().min(1).max(64).optional()
        .describe("Seller username. Alone (no query) pages their catalogue."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      sort_by: z.enum(["best_match", "ending_soonest", "newly_listed", "price_low", "price_high"]).optional()
        .describe("Sort order."),
      min_price: z.number().min(0).optional()
        .describe("Min price."),
      max_price: z.number().min(0).optional()
        .describe("Max price."),
      condition: z.enum(["new", "open_box", "refurbished", "used", "for_parts"]).optional()
        .describe("Condition filter."),
      buying_format: z.enum(["auction", "buy_it_now", "best_offer"]).optional()
        .describe("Listing format."),
      free_shipping: z.boolean().optional()
        .describe("Free shipping only."),
      sold: z.boolean().optional()
        .describe("Completed sold listings for price research."),
      category_id: z.string().optional()
        .describe("Numeric eBay category id."),
      per_page: z.union([z.literal(60), z.literal(120), z.literal(240)]).optional()
        .describe("Results per page. Only 60, 120, 240."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/ebay/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_ebay_product",
    `Get full eBay listing details: specs, images, shipping, auction state, seller info. 1 credit.`,
    {
      item_id: z.string().min(1)
        .describe("Item number or ebay.com/itm/ URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/ebay/product", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_ebay_seller",
    `Get eBay seller profile. No listings; use search_ebay with seller param for inventory. 1 credit.`,
    {
      seller: z.string().min(1).max(64)
        .describe("Seller username."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/ebay/seller", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
