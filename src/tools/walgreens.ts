import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/walgreens.ts. Cross-field rule the backend
// enforces and zod here does not: stores takes zip OR latitude+longitude. No
// zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = [
  "relevance",
  "top_sellers",
  "price_low_to_high",
  "price_high_to_low",
  "unit_price_low_to_high",
  "brand_name_asc",
  "brand_name_desc",
  "most_reviewed",
  "highest_rated",
  "most_viewed",
  "newest_arrival",
] as const;

const storeNumber = () =>
  z.string().regex(/^\d{1,5}$/)
    .describe("Walgreens store number from get_walgreens_stores (field store_number), e.g. '9438'.");

const productId = () =>
  z.string().min(3).max(500)
    .describe("Walgreens product id (a search result's product_id), e.g. '300452904' or 'prod6345045', or a walgreens.com product URL.");

export function registerWalgreensTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/walgreens/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_walgreens",
    `Search Walgreens retail products (no pharmacy), up to 70 per page. Each result has product_id, SKU, UPC, name, brand, size, regular and sale price, unit price, promotion, coupon, loyalty and rebate messages, rating, review count, image, URL, ship/pickup/delivery availability, online stock status and clearance flag. Prices are in dollars and national (the same at every store). Pass store_id for that store's availability text. Use a result's product_id with get_walgreens_product and get_walgreens_stock. 2 credits/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'shampoo'."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based, up to 70 per page."),
      sort: z.enum(SORTS).optional()
        .describe("relevance (default), top_sellers, price_low_to_high, price_high_to_low, unit_price_low_to_high, brand_name_asc, brand_name_desc, most_reviewed, highest_rated, most_viewed or newest_arrival."),
      store_id: storeNumber().optional()
        .describe("Walgreens store number, e.g. '9438'. Each result's availability text then describes that store (e.g. 'Not sold at your store')."),
    },
    post("search"),
  );

  server.tool(
    "get_walgreens_product",
    `One Walgreens retail product: SKU, UPC, GTIN, name, brand, size, regular and sale price, savings, unit price, offers (rewards and rebates), description, ingredients, warnings, rating and review count, category path, images, ship and pickup availability, clearance flag. Prices are in dollars and national. For in-store stock use get_walgreens_stock. An unknown id is a 404. 2 credits.`,
    {
      product_id: productId(),
    },
    post("product"),
  );

  server.tool(
    "get_walgreens_stores",
    `Walgreens and Duane Reade stores near a US ZIP or coordinates, nearest first: store number, name, brand, address, phone, coordinates, distance in miles, opening and closing time, time zone and store page URL. Paged (total_results, total_pages, has_more). Use store numbers with search_walgreens (store_id) and get_walgreens_stock (store_ids). 2 credits/call.`,
    {
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("US ZIP code, e.g. '60601'. Pass this or latitude and longitude."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude, e.g. 40.7484."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude, e.g. -73.9857."),
      radius: z.number().min(1).max(100).optional()
        .describe("Search radius in miles. Default 25."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based."),
      limit: z.number().int().min(1).max(25).optional()
        .describe("Stores per page, 1-25. Default 10."),
    },
    post("stores"),
  );

  server.tool(
    "get_walgreens_stock",
    `Live in-store stock of one Walgreens product at up to 20 stores in one call: per store the status (In Stock, Out of Stock, or Not Available when the store does not carry it), the unit count and in_stock. Store numbers Walgreens does not recognise are listed in unknown_store_ids. An unknown product id is a 404. 4 credits.`,
    {
      product_id: productId(),
      store_ids: z.array(storeNumber()).min(1).max(20)
        .describe("Walgreens store numbers to check, up to 20, e.g. ['9438', '14318']."),
    },
    post("stock"),
  );
}
