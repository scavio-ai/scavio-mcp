import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

const storeId = z.string().regex(/^\d{1,5}$/)
  .describe('Total Wine store number from get_totalwine_stores, e.g. "503" (San Antonio Del Norte, TX). Prices and stock are per store.');

export function registerTotalWineTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/totalwine/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_totalwine",
    `Search Total Wine & More (liquor, wine, beer) at one store. Every result has that store's price (cents), units in stock, purchase limit, aisle, size, brand, rating, review count, and pickup/delivery/shipping availability. store_id is required; get it from get_totalwine_stores. If the store carries none of the matches, products is empty and searched_all_stores is true. 2 credits/call.`,
    {
      query: z.string().min(1).max(200).describe("Search keywords, e.g. 'titos'."),
      store_id: storeId,
      page: z.number().int().min(1).max(50).optional().describe("Page, 1-based. 24 results per page."),
    },
    post("search"),
  );

  server.tool(
    "get_totalwine_product",
    `One Total Wine product at one store: price (cents), units in stock, aisle, bay, shelf, last restock date, ABV, size, taste profile, characteristics, breadcrumbs, images, rating, review count and pickup/delivery/shipping availability. Pass product_id (the id from search_totalwine) or product_url, plus store_id. 2 credits.`,
    {
      product_id: z.string().regex(/^\d{4,12}$/).optional().describe("Numeric product id, e.g. '96260175'."),
      product_url: z.string().min(1).max(500).optional().describe("Total Wine product URL ending in /p/<id>."),
      store_id: storeId,
    },
    post("product"),
  );

  server.tool(
    "get_totalwine_stores",
    `Find Total Wine stores near a ZIP code or city, nearest first: store_id, name, address, phone, coordinates, distance in miles, delivery availability. Use store_id with search_totalwine and get_totalwine_product. 2 credits.`,
    {
      query: z.string().min(1).max(100).describe("ZIP code, city, or 'city, state', e.g. '78801'."),
      radius: z.number().int().min(1).max(200).optional().describe("Radius in miles. Default 50."),
    },
    post("stores"),
  );
}
