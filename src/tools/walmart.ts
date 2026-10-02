import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

/**
 * Walmart marketplace. A price-bearing parameter: com and ca bill 1 credit,
 * com.mx bills 2. Search and category accept all three; product accepts ca
 * only together with a store target (see storeFields).
 *
 * Never given a zod default: the MCP SDK applies defaults BEFORE the handler
 * runs, so a default is posted on every call whether the caller meant it or not.
 */
const domainField = z.enum(["com", "ca", "com.mx"]).optional()
  .describe("'com' (US, 1cr), 'ca' (Canada, 1cr), 'com.mx' (Mexico, 2cr). Default US.");

/**
 * The backend enum is CLOSED to today|tomorrow. '2_days' leaks items 3-4 days
 * out and 'anytime' is a no-op, so both were retired upstream — and a zod
 * default here would post the retired value on every call and 400 the request.
 * There is deliberately no default.
 */
const fulfillmentSpeedField = z.enum(["today", "tomorrow"]).optional()
  .describe("'today' or 'tomorrow'. Omit for all items.");

/**
 * Store targeting (search + product). Both or neither: the API 400s one alone.
 * store_id comes from get_walmart_stores on the same domain. walmart.com and
 * walmart.ca only. A store-targeted call bills 2 credits regardless of domain.
 * No defaults, for the same reason as domainField.
 */
const deliveryZipField = z.string().min(5).max(7).optional()
  .describe("Shopper postal code: 5-digit US ZIP, or Canadian postal code (e.g. 'M5V 2T6') with domain 'ca'. Must be passed with store_id.");
const storeIdField = z.string().min(1).optional()
  .describe("Walmart store id from get_walmart_stores (same domain). Must be passed with delivery_zip. The store used is echoed in data.location.");

const sortByField = z.enum(["best_match", "price_low", "price_high", "best_seller", "rating_high", "new"]).optional()
  .describe("Sort order. Default 'best_match'.");

export function registerWalmartTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_walmart",
    `Search Walmart products. Paginate with page while has_more_pages. 1 credit (US/CA), 2 credits (Mexico). Optional store targeting: pass delivery_zip + store_id together (store_id from get_walmart_stores, same domain) for one store's assortment and availability - walmart.com and walmart.ca only, 2 credits, takes 10-60s, store echoed in data.location.`,
    {
      query: z.string().min(1).max(500)
        .describe("Product search query."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based."),
      sort_by: sortByField,
      min_price: z.number().optional()
        .describe("Min price."),
      max_price: z.number().optional()
        .describe("Max price."),
      fulfillment_speed: fulfillmentSpeedField,
      fulfillment_type: z.enum(["in_store"]).optional()
        .describe("'in_store' for pickup only. Omit for all."),
      domain: domainField,
      delivery_zip: deliveryZipField,
      store_id: storeIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_product",
    `Get full Walmart product detail. No reviews (use get_walmart_reviews) or offers (use get_walmart_offers). seller_catalog_id is the NUMERIC id for seller endpoints. 1 credit. Optional store targeting: delivery_zip + store_id together (store_id from get_walmart_stores) - 2 credits, takes 10-60s, store echoed in data.location; 404 if that store does not carry the item. domain 'ca' only with a store pair.`,
    {
      product_id: z.string().min(1)
        .describe("Walmart usItemId, e.g. '13544111159'."),
      domain: z.enum(["com", "ca"]).optional()
        .describe("'com' (default) or 'ca'. 'ca' requires delivery_zip + store_id."),
      delivery_zip: deliveryZipField,
      store_id: storeIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/product", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_stores",
    `Find Walmart stores near a US ZIP (walmart.com) or Canadian postal code (domain 'ca'), nearest first: store_id, name, distance_miles, address, coordinates, hours. Use a store_id with delivery_zip on search_walmart or get_walmart_product (same domain) to target that store. 1 credit.`,
    {
      zipcode: z.string().min(5).max(7)
        .describe("5-digit US ZIP, e.g. '50036', or Canadian postal code with domain 'ca', e.g. 'M5V 2T6'."),
      domain: z.enum(["com", "ca"]).optional()
        .describe("'com' (walmart.com, default) or 'ca' (walmart.ca)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/stores", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_reviews",
    `Get Walmart product reviews. 10/page, paginate with page param. Includes rating_breakdown and top positive/negative. 1 credit/page.`,
    {
      product_id: z.string().min(1)
        .describe("Walmart usItemId."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based. 10 reviews/page."),
      sort: z.enum(["relevancy", "submission-desc", "submission-asc", "rating-desc", "rating-asc", "helpful-desc"]).optional()
        .describe("Sort order."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_category",
    `Browse Walmart category products (no query). Same shape as search_walmart. Paginate with page while has_more_pages. limit trims locally (doesn't reduce cost). 1 credit (US/CA), 2 credits (Mexico).`,
    {
      category_id: z.string().min(1)
        .describe("Category id, e.g. '1095191' or '3944_133251_1095191'."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      limit: z.number().int().min(1).optional()
        .describe("Max products to return (local trim, same cost)."),
      sort_by: sortByField,
      min_price: z.number().optional()
        .describe("Min price."),
      max_price: z.number().optional()
        .describe("Max price."),
      fulfillment_speed: fulfillmentSpeedField,
      domain: domainField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/category", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_offers",
    `Get the buy-box offer for a Walmart product. Returns only the winning seller (not full offer list). Not paginated. 1 credit.`,
    {
      product_id: z.string().min(1)
        .describe("Walmart usItemId."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/offers", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_seller",
    `Get a Walmart seller's storefront. IMPORTANT: seller_id must be NUMERIC seller_catalog_id (not the GUID seller_id, which 404s). 1 credit.`,
    {
      seller_id: z.string().min(1)
        .describe("Numeric seller_catalog_id, e.g. '101480084'. GUID form 404s."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/seller", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_seller_products",
    `List a Walmart seller's products. HARD CAP: ~40 products max (no pagination). Use total_count for real catalog size. seller_id must be NUMERIC seller_catalog_id (GUID 404s). 1 credit.`,
    {
      seller_id: z.string().min(1)
        .describe("Numeric seller_catalog_id, e.g. '101480084'. GUID form 404s."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/seller-products", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
