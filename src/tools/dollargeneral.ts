import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/dollargeneral.ts. Cross-field rule the
// backend enforces and zod here does not: stores takes zip OR
// latitude+longitude. No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const SORTS = ["recommended", "price_low", "price_high", "rating"] as const;

const storeId = () =>
  z.string().regex(/^\d{1,5}$/)
    .describe("Dollar General store number from get_dollar_general_stores, e.g. '14838'. Prices and unit counts are that store's.");

const sort = () =>
  z.enum(SORTS).optional()
    .describe("recommended (default), price_low, price_high or rating.");

const upc = () =>
  z.string().regex(/^\d{6,14}$/)
    .describe("Product UPC, the upc field of a search result, e.g. '030772156629'. Leading zeros are optional.");

export function registerDollarGeneralTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/dollargeneral/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_dollar_general",
    `Search Dollar General products at one store. Each result has that store's price and original price (dollars), available_quantity (units on hand at that store), rating, review count, categories, digital coupons and promotions, UPC and product URL. 24 per page. Use a result's upc with get_dollar_general_product. 1 credit/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'paper towels'."),
      store_id: storeId(),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based, 24 per page."),
      sort: sort(),
      in_stock_only: z.boolean().optional()
        .describe("Only products with units on hand at the store. Default false."),
    },
    post("search"),
  );

  server.tool(
    "get_dollar_general_product",
    `One Dollar General product by UPC at one store: price, original price, available_quantity (units on hand), nearby_stores_with_stock, rating, review count, SKU, brand, description, highlights, images, category hierarchy, digital coupons and promotions. Rating and review count only, no review text. An unknown UPC or store number is a 404. 1 credit.`,
    {
      upc: upc(),
      store_id: storeId(),
    },
    post("product"),
  );

  server.tool(
    "get_dollar_general_stores",
    `Dollar General stores near a US ZIP or coordinates, nearest first (up to 25): store number, address, phone, coordinates, distance in miles, opening hours and services. Pass a upc and one call returns that product's unit count at every store returned (quantity, in_stock, inventory_status, is_sellable). 1 credit.`,
    {
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("US ZIP code, e.g. '75203'. Pass this or latitude and longitude."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude, e.g. 32.74."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude, e.g. -96.79."),
      radius: z.number().min(1).max(100).optional()
        .describe("Search radius in miles. Default 25."),
      upc: upc().optional()
        .describe("Product UPC. Every store then carries its unit count of that product."),
    },
    post("stores"),
  );

  server.tool(
    "get_dollar_general_deals",
    `Dollar General products on sale or on clearance, priced and stocked at one store, 24 per page. available_quantity > 0 means in stock at that store; the listing covers the whole chain, so out-of-stock items are included. Clearance items carry the current price only (no was-price). 1 credit/call.`,
    {
      store_id: storeId(),
      type: z.enum(["on_sale", "clearance"])
        .describe("on_sale (everything on sale) or clearance (the clearance event)."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based, 24 per page."),
      sort: sort(),
    },
    post("deals"),
  );

  server.tool(
    "get_dollar_general_coupons",
    `Dollar General's current digital coupons, 30 per page: offer id and code, summary, description, brand, company, value, offer type, category, minimum quantity, start and expiration dates, and whether it is a manufacturer coupon. 1 credit/call.`,
    {
      page: z.number().int().min(1).max(50).optional()
        .describe("Page, 1-based, 30 per page."),
    },
    post("coupons"),
  );
}
