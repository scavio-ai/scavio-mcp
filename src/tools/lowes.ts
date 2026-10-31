import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/lowes.ts. Cross-field rule the backend
// enforces and zod here does not: search takes query OR category_id, not both.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const storeId = () =>
  z.string().regex(/^\d{1,4}$/)
    .describe("Lowe's store number from get_lowes_stores (field store_id), e.g. '0595'. Prices and stock are that store's.");

const zip = () =>
  z.string().regex(/^\d{5}$/)
    .describe("The store's own 5-digit ZIP, from get_lowes_stores, e.g. '28117'.");

const itemId = () =>
  z.string().min(1).max(500)
    .describe("Lowe's item id (the number at the end of a lowes.com/pd/ URL), e.g. '5014148635', or the full product URL.");

export function registerLowesTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/lowes/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_lowes",
    `Search Lowe's by keyword or category at one store. Each result has that store's price, was-price and savings with the sale end date, brand, model number, rating, review count, stock quantity and availability for pickup, delivery, parcel shipping and same-day delivery. store_id and zip are required (from get_lowes_stores). Set on_sale for that store's deals. 24 per page. 2 credits/call.`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Search keywords, e.g. 'cordless drill'. Pass this or category_id."),
      category_id: z.string().regex(/^\d{4,16}$/).optional()
        .describe("Category id, the number at the end of a lowes.com/pl/ URL, e.g. '4294607842'. Pass this or query."),
      store_id: storeId(),
      zip: zip(),
      page: z.number().int().min(1).max(31).optional()
        .describe("Page, 1-based, 24 per page. Lowe's serves up to page 31."),
      on_sale: z.boolean().optional()
        .describe("Only items on sale at this store (with a was-price). A page can then hold fewer than 24 results."),
    },
    post("search"),
  );

  server.tool(
    "get_lowes_product",
    `One Lowe's item at one store: price, was-price and savings, on-hand stock with lead time per fulfillment method, stock at nearby stores, aisle and bay, grouped specifications, bullets, UPC, dimensions, weight, rating, images, and the store's address and hours. 2 credits.`,
    {
      item_id: itemId(),
      store_id: storeId(),
      zip: zip(),
    },
    post("product"),
  );

  server.tool(
    "get_lowes_stores",
    `Find Lowe's stores near a US ZIP, nearest first: store_id, name, address, phone, coordinates, distance, time zone, opening hours and features. Pass a store's store_id and its own ZIP to search_lowes and get_lowes_product. 2 credits.`,
    {
      zip: z.string().regex(/^\d{5}$/)
        .describe("5-digit US ZIP code to search around, e.g. '10001'."),
      limit: z.number().int().min(1).max(10).optional()
        .describe("Stores to return, nearest first. 1-10, default 10."),
    },
    post("stores"),
  );

  server.tool(
    "get_lowes_reviews",
    `Customer reviews for a Lowe's item, 10 per page: rating, title, text, date, reviewer, recommended, helpful votes, verified and incentivized flags, photos and brand replies, plus the average rating, total and count per star. 1 credit/page.`,
    {
      item_id: itemId(),
      page: z.number().int().min(1).max(1000).optional()
        .describe("Page, 1-based, 10 per page."),
      sort: z.enum(["newest", "oldest", "most_helpful"]).optional()
        .describe("newest (default), oldest or most_helpful."),
    },
    post("reviews"),
  );
}
