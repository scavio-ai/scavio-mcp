import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/canadiantire.ts. Cross-field rules the
// backend enforces and zod here does not: search takes query OR category_id;
// stores takes postal_code OR latitude+longitude. No zod `.default()`: the MCP
// SDK would post a defaulted field on every call.

const SORTS = ["relevance", "price_asc", "price_desc", "newest", "rating", "bestseller"] as const;
const DEAL_TYPES = ["sale", "instant_rebate", "special_buy", "loyalty"] as const;

const storeId = () =>
  z.string().regex(/^\d{1,5}$/)
    .describe("Canadian Tire store number from get_canadian_tire_stores, e.g. '600'. Prices and stock are that store's.");

export function registerCanadianTireTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/canadiantire/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_canadian_tire",
    `Search Canadian Tire by keyword or category at one store. Each result has the store's price and regular price (CAD), price range for multi-variant items, savings, badges (clearance, sale, rebate), rating, review count, brand, part number, SKU, and stock at the store and online. Prices differ by store and province (Quebec differs). 24 per page. 1 credit/call.`,
    {
      query: z.string().max(200).optional()
        .describe("Search keywords, e.g. 'dewalt drill'. Pass this or category_id."),
      category_id: z.string().max(300).optional()
        .describe("Category id (DC followed by 7 digits, e.g. 'DC0002209'), or a canadiantire.ca category URL ending in one. Pass this or query."),
      store_id: storeId(),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based, 24 per page."),
      sort: z.enum(SORTS).optional()
        .describe("relevance (default), price_asc, price_desc, newest, rating or bestseller."),
      in_stock_only: z.boolean().optional()
        .describe("Only items in stock at store_id."),
    },
    post("search"),
  );

  server.tool(
    "get_canadian_tire_product",
    `One Canadian Tire product by code at one store: breadcrumb, images, videos, rating and review count, descriptions, feature bullets, specifications, price and regular price, warranty, manuals, variants with their SKUs, and the store's price, stock, and pickup and ship-to-home dates. Rating and review count only, no review text. 1 credit.`,
    {
      product_code: z.string().regex(/^\d{7}[pP]?$/)
        .describe("Product code, the code field of a search result, e.g. '0547273P'."),
      store_id: storeId(),
    },
    post("product"),
  );

  server.tool(
    "get_canadian_tire_stores",
    `Canadian Tire stores near a postal code or coordinates, nearest first: store number, name, address, phone, coordinates, distance, weekly hours and services. Pass sku to also get each store's stock quantity and aisle for that item. 1 credit.`,
    {
      postal_code: z.string().max(10).optional()
        .describe("Canadian postal code or its first 3 characters, e.g. 'M5V 2T6'. Pass this or latitude and longitude."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude, e.g. 43.6426."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude, e.g. -79.3871."),
      radius_km: z.number().min(1).max(200).optional()
        .describe("Search radius in km. Default 25, max 200."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Stores to return, nearest first. Default 10, max 50."),
      sku: z.string().max(12).optional()
        .describe("7-digit SKU, e.g. '0438858'. Adds each store's stock quantity and aisle for it."),
    },
    post("stores"),
  );

  server.tool(
    "get_canadian_tire_availability",
    `Price and stock for up to 50 SKUs at one Canadian Tire store in one call: the store's price and regular price, clearance and sale flags, price valid-until date, stock quantity, aisle, online stock, and pickup and delivery dates. SKUs that do not exist are listed in not_found. 1 credit.`,
    {
      store_id: storeId(),
      skus: z.array(z.string().max(12)).min(1).max(50)
        .describe("1-50 SKUs (7 digits, the sku field of a search result or a product variant), e.g. ['0438858', '0547273']."),
    },
    post("availability"),
  );

  server.tool(
    "get_canadian_tire_clearance",
    `Every clearance item at one Canadian Tire store, 100 per page: clearance price, regular price, stock at the store and the same fields as search_canadian_tire. In-stock items only by default. 1 credit/call.`,
    {
      store_id: storeId(),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based, 100 per page."),
      in_stock_only: z.boolean().optional()
        .describe("Only clearance items in stock at store_id. Default true."),
    },
    post("clearance"),
  );

  server.tool(
    "get_canadian_tire_deals",
    `Items on a deal at one Canadian Tire store, 100 per page: this week's sale prices, instant rebates, special buys or Triangle Rewards loyalty offers, with the same fields as search_canadian_tire. 1 credit/call.`,
    {
      store_id: storeId(),
      type: z.enum(DEAL_TYPES)
        .describe("sale (this week's sale prices), instant_rebate, special_buy or loyalty (Triangle Rewards offers)."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based, 100 per page."),
    },
    post("deals"),
  );
}
