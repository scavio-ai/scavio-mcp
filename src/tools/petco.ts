import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/petco.ts. Cross-field rules the backend
// enforces and zod here does not: product takes part_number OR url;
// store-inventory takes store_id OR zip. No zod `.default()`: the MCP SDK would
// post a defaulted field on every call.

const SORTS = ["relevance", "price", "rating", "top_sold", "newest", "name"] as const;

const LISTING_FIELDS =
  "Each product has price, list price and autoship (Repeat Delivery) price in dollars, rating, review count, brand, part_number, cat_entry_id (for get_petco_store_inventory), fulfillment flags (pickup in store, same-day delivery, autoship, in-store only), deal_group_ids, and every size/flavor variation with its own prices. Also returned: total_results, facets with counts and the categories the matches fall into. 48 per page. Prices are national.";

const zip = () => z.string().regex(/^\d{5}(-\d{4})?$/);

const listingFields = () => ({
  page: z.number().int().min(1).max(100).optional()
    .describe("Page, 1-based. 48 products per page."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), price, rating, top_sold, newest or name."),
  sort_order: z.enum(["asc", "desc"]).optional()
    .describe("asc or desc. Default asc for price and name, desc for everything else."),
});

export function registerPetcoTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/petco/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_petco",
    `Search Petco products. ${LISTING_FIELDS} 1 credit/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'dog food'."),
      ...listingFields(),
    },
    post("search"),
  );

  server.tool(
    "get_petco_category",
    `Products in a Petco category, e.g. dog/dog-food/dry-dog-food. ${LISTING_FIELDS} Can take 10-30 seconds. An unknown category is a 404. 1 credit/call.`,
    {
      path: z.string().min(1).max(300)
        .describe("A petco.com category: its path ('dog/dog-food/dry-dog-food'), /category/<path>, or the full URL. A search result's categories[].url works too."),
      ...listingFields(),
    },
    post("category"),
  );

  server.tool(
    "get_petco_product",
    `One Petco product by part number or URL, with every variant (size, flavor): cat_entry_id, part number, SKU, UPC, price, list price, autoship (Repeat Delivery) price, first-autoship promo price, online quantity and status, fulfillment flags, ingredients, guaranteed analysis, directions, specifications, dimensions and images. Plus brand, rating, review count and breadcrumbs. Prices are national; for per-store stock pass a variant's cat_entry_id to get_petco_store_inventory. Can take 10-30 seconds. An unknown product is a 404. 1 credit.`,
    {
      part_number: z.string().regex(/^\d{4,10}$/).optional()
        .describe("Petco part number (a search result's part_number), e.g. '3748364'. Pass this or url."),
      url: z.string().min(1).max(500).optional()
        .describe("Petco product page URL, /product/<name>-<part number> (a search result's url). Answers faster than part_number."),
    },
    post("product"),
  );

  server.tool(
    "get_petco_stores",
    `Petco stores nearest a US ZIP code (up to 10): store_id (what get_petco_store_inventory takes), store number, name, address, phone, coordinates, distance in miles, in-store pickup and opening hours per weekday. 1 credit.`,
    {
      zip: zip()
        .describe("US ZIP code, e.g. '10001'."),
      limit: z.number().int().min(1).max(10).optional()
        .describe("Number of stores, nearest first, 1-10. Default 5."),
    },
    post("stores"),
  );

  server.tool(
    "get_petco_store_inventory",
    `Units on hand at one Petco store for up to 10 products: qty_available, alert_level (GREEN, YELLOW, RED) and in_stock per cat_entry_id. Pass a store_id, or a zip to use the nearest store (returned as store). Takes catalog entry ids (cat_entry_id from search_petco or get_petco_product), not part numbers; one unknown id makes the whole answer a 404. 1 credit.`,
    {
      cat_entry_ids: z.array(z.string().regex(/^\d{1,12}$/)).min(1).max(10)
        .describe("Up to 10 catalog entry ids: the cat_entry_id of a search result, variation or product variant, e.g. ['6131012', '531503']. NOT the part number."),
      store_id: z.string().regex(/^\d{1,12}$/).optional()
        .describe("Petco store id: the store_id of get_petco_stores (not the store number), e.g. '13275'. Pass this or zip."),
      zip: zip().optional()
        .describe("US ZIP code, e.g. '10001': stock is read at the nearest store to it."),
    },
    post("store-inventory"),
  );
}
