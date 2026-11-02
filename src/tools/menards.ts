import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/menards.ts. Cross-field rules the backend
// enforces and zod here does not: search's store_id must be a real Menards
// store; product takes item_id OR url; stores takes zip OR city+state;
// min_price <= max_price. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

export function registerMenardsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/menards/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_menards",
    `Search menards.com at one store, 40 products a page. Each result has item_id, SKU, name, URL, image, the price ladder (price, everyday_price, sale_price, price_type regular/sale/clearance/minimum_advertised, rebates such as "11% REBATE*", final_price after rebates; price_in_cart true when the rebate shows only in the cart) and that store's stock: stock_quantity, stock_message, not_available_at_store, pickup and delivery flags. Also total_results, total_pages and facets. store_id is required (get one from get_menards_stores); an unknown store number is a 400. Pass an item_id to get_menards_product for specifications and the aisle. 2 credits.`,
    {
      query: z.string().min(1).max(200).describe("Search keywords, e.g. 'sledge hammer'."),
      store_id: z.string().regex(/^\d{1,5}$/)
        .describe("Menards store number from get_menards_stores, e.g. '3181'. Required: stock is that store's."),
      page: z.number().int().min(1).max(100).optional().describe("Results page, 1-based, 40 products a page. Defaults to 1."),
      sort: z.enum(["relevance", "price_asc", "price_desc", "brand_asc", "brand_desc"]).optional()
        .describe("Result order. Defaults to relevance. Price sorts order by everyday_price (regular price), not the sale price."),
      in_stock_today: z.boolean().optional().describe("Only products in stock at the store today."),
      min_price: z.number().min(0).optional().describe("Lowest price in dollars."),
      max_price: z.number().min(0).optional().describe("Highest price in dollars."),
    },
    post("search"),
  );

  server.tool(
    "get_menards_product",
    `One Menards product by item id or URL (find item ids with search_menards): name, brand, model number, SKU, description, bullets, specifications, images, videos and documents, with the full price ladder: everyday price, sale price and its end date, mail-in rebates (text such as "11% REBATE*", amount, dates), final_price after rebates and the you-save amount. Also pickup, delivery and ship-to-store flags. Pass store_id for that store's stock quantity, stock message, aisle location and not_available_at_store; without it prices are the default store's (3598) and stock fields are null. Prices are in dollars. With store_id it can take 10-40 seconds. An unknown item id or store number is a 404. 1 credit; 2 credits with store_id.`,
    {
      item_id: z.string().regex(/^\d{8,16}$/).optional()
        .describe("Menards item id: the number after p- in a menards.com product URL, e.g. '60893666613'. Not the SKU or model number. Pass this or url."),
      url: z.string().max(2000).optional()
        .describe("A menards.com product URL, e.g. 'https://www.menards.com/main/p-60893666613.htm'. Pass this or item_id."),
      store_id: z.string().regex(/^\d{1,5}$/).optional()
        .describe("Menards store number from get_menards_stores, e.g. '3181'. Adds that store's stock quantity, stock message and aisle, priced for that store. Costs 2 credits instead of 1 and typically takes 10-40 seconds."),
    },
    post("product"),
  );

  server.tool(
    "get_menards_stores",
    `Menards stores near a US ZIP code or a city and state, nearest first: store number (store_id), name, address, coordinates, distance in miles and services (garden center, grocery, rental center, propane and more). Use a store_id with search_menards or get_menards_product for that store's stock. 1 credit.`,
    {
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("US ZIP code, e.g. '55401'. Pass this, or city and state."),
      city: z.string().min(1).max(80).optional()
        .describe("City to search around, with state, e.g. 'Madison'."),
      state: z.string().regex(/^[A-Za-z]{2}$/).optional()
        .describe("2-letter US state code, with city, e.g. 'WI'."),
    },
    post("stores"),
  );
}
