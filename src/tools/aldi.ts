import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/aldi.ts. Cross-field rule the backend
// enforces and zod here does not: search and product take store_id OR zip
// (nearest store). No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const storeId = () =>
  z.string().regex(/^\d{1,10}$/).optional()
    .describe("ALDI store id from get_aldi_stores, e.g. '151248'. Prices and stock are that store's. Pass this, or zip to use the nearest store.");

const zip = () =>
  z.string().regex(/^\d{5}(-\d{4})?$/).optional()
    .describe("US ZIP code, e.g. '33133'. Without store_id, the nearest ALDI store to it is used.");

const serviceType = () =>
  z.enum(["instore", "pickup", "delivery"]).optional()
    .describe("Which price: instore (default, the shelf price in the store), pickup or delivery (online prices for ordering from that store, often higher than the shelf price).");

export function registerAldiTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/aldi/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_aldi",
    `Search ALDI US products at one store (store_id, or the nearest store to a zip). Prices are per store and per service_type: the in-store shelf price by default; pickup and delivery are the online prices, often higher. Each result has product_id, name, brand, size, price and was_price in dollars, discount label, unit price, in_stock and stock level, category, in-store aisle location, ALDI-exclusive brand flag, dietary labels, image and URL. Exact matches only unless include_related is set. ALDI has no product ratings. 1 credit/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'cheese'."),
      store_id: storeId(),
      zip: zip(),
      service_type: serviceType(),
      sort: z.enum(["best_match", "price_low", "price_high"]).optional()
        .describe("best_match (default), price_low or price_high."),
      limit: z.number().int().min(1).max(60).optional()
        .describe("Products per page, 1-60. Default 30."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based."),
      include_related: z.boolean().optional()
        .describe("Also return the related items ALDI lists after the exact matches. Default false."),
    },
    post("search"),
  );

  server.tool(
    "get_aldi_product",
    `One ALDI US product at one store (store_id, or the nearest store to a zip): price and was_price in dollars for that store and service_type (in-store shelf price by default), unit price, stock, category, brand, size, description, ingredients, allergen warnings, dietary labels and images. An unknown product id is a 404. 1 credit.`,
    {
      product_id: z.string().min(1).max(300)
        .describe("ALDI product id (a search result's product_id), e.g. '16902710', or an aldi.us product URL."),
      store_id: storeId(),
      zip: zip(),
      service_type: serviceType(),
    },
    post("product"),
  );

  server.tool(
    "get_aldi_stores",
    `ALDI US stores near a ZIP, nearest first: store_id (use it with search_aldi and get_aldi_product), name, street address, city, state, ZIP, coordinates and distance in miles. 1 credit.`,
    {
      zip: z.string().regex(/^\d{5}(-\d{4})?$/)
        .describe("US ZIP code to search around, e.g. '33131'."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Stores to return, nearest first, 1-50. Default 10."),
    },
    post("stores"),
  );
}
