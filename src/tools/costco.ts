import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/costco.ts field for field (names, enums,
// min/max). Cross-field rules the backend enforces and zod here does not:
// item_id OR item_ids on product/prices, query OR category on clearance,
// zip OR latitude+longitude (or warehouse_ids on gas), in_warehouse needs
// warehouse_id. A violation comes back as a 400 with the reason.
//
// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. Defaults are documented in the describe text and
// left for the backend to apply.

const NA_COUNTRIES = ["us", "ca"] as const;
const ALL_COUNTRIES = ["us", "ca", "uk", "au", "mx", "jp", "kr", "tw"] as const;

const naCountry = () =>
  z.enum(NA_COUNTRIES).optional()
    .describe("costco.com 'us' (default) or costco.ca 'ca'.");

const anyCountry = () =>
  z.enum(ALL_COUNTRIES).optional()
    .describe("Costco site. Default 'us'. us/ca support every filter; uk, au, mx, jp, kr, tw support keyword, sort and paging only.");

const warehouseId = () =>
  z.string().min(1).max(10)
    .describe("Costco warehouse number, e.g. '1062' (from get_costco_warehouses).");

const itemId = () =>
  z.string().min(1).max(300)
    .describe("Costco item number or product id, e.g. '100334960', or a costco.com product URL.");

/** Filters shared by search, category and deals (us/ca). */
const listingFilters = () => ({
  warehouse_id: warehouseId().optional()
    .describe("Adds that warehouse's in-store price, stock status and price code to every result. Omit for online prices only."),
  sort_by: z.enum(["best_match", "price_low", "price_high", "top_rated", "newest"]).optional()
    .describe("Default 'best_match'."),
  brands: z.array(z.string().min(1).max(100)).max(20).optional()
    .describe("Brand filter, e.g. ['Kirkland Signature']."),
  min_price: z.number().min(0).optional()
    .describe("Min online price, inclusive."),
  max_price: z.number().min(0).optional()
    .describe("Max online price, inclusive."),
  min_rating: z.number().min(1).max(5).optional()
    .describe("Min average star rating."),
  on_sale: z.boolean().optional()
    .describe("Only items with an active discount."),
  in_stock: z.boolean().optional()
    .describe("Hide out-of-stock items."),
  in_warehouse: z.boolean().optional()
    .describe("Only items sold and in stock at warehouse_id (requires warehouse_id)."),
  page: z.number().int().min(1).max(500).optional()
    .describe("Page, 1-based."),
  page_size: z.number().int().min(1).max(120).optional()
    .describe("Results/page, max 120. Default 24."),
});

const locationFields = () => ({
  zip: z.string().min(5).max(10).optional()
    .describe("US zip code, e.g. '10025'."),
  latitude: z.number().min(-90).max(90).optional()
    .describe("Latitude, with longitude, instead of zip (required outside the US)."),
  longitude: z.number().min(-180).max(180).optional()
    .describe("Longitude, with latitude."),
});

export function registerCostcoTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/costco/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_costco",
    `Search Costco products by keyword or item number: online price, original price, rating, member-only and stock flags, promotions, facets. Pass warehouse_id to add one warehouse's in-store price and stock per result. 1 credit/page.`,
    {
      query: z.string().min(1).max(200)
        .describe("Keywords or a Costco item number, e.g. 'olive oil'."),
      country: anyCountry(),
      ...listingFilters(),
    },
    post("search"),
  );

  server.tool(
    "get_costco_category",
    `List products in a Costco category, same shape, filters and per-warehouse pricing as search_costco. Get slugs from get_costco_categories. 1 credit/page.`,
    {
      category: z.string().min(1).max(200)
        .describe("Category slug, e.g. 'televisions', or a costco.com category URL."),
      country: naCountry(),
      ...listingFilters(),
    },
    post("category"),
  );

  server.tool(
    "get_costco_categories",
    `Get Costco departments, or the full subcategory tree under one department. Use to find slugs for get_costco_category. 1 credit.`,
    {
      category_id: z.string().min(1).max(20).optional()
        .describe("Omit for top-level departments; pass an id, e.g. '30001', for its subcategory tree."),
      country: naCountry(),
    },
    post("categories"),
  );

  server.tool(
    "get_costco_product",
    `Get full Costco product detail for up to 20 items: description, features, specs, variants, member-only flag, purchase limits, delivery fee, promotions with dates. Online price only; use get_costco_prices for warehouse prices. 1 credit.`,
    {
      item_id: itemId().optional(),
      item_ids: z.array(itemId()).min(1).max(20).optional()
        .describe("Up to 20 ids in one call (us/ca only). Pass item_id or item_ids."),
      country: anyCountry(),
    },
    post("product"),
  );

  server.tool(
    "get_costco_prices",
    `Compare Costco online vs in-warehouse price for up to 20 items at up to 10 warehouses: price, discount, final price, promotion start/end dates, per-order/per-member limits, price code. 1 credit per 5 lookups, 1 lookup per 2 locations incl. online (10 warehouses = 2 credits).`,
    {
      item_id: itemId().optional(),
      item_ids: z.array(itemId()).min(1).max(20).optional()
        .describe("Up to 20 ids. Pass item_id or item_ids."),
      warehouse_ids: z.array(warehouseId()).min(1).max(10)
        .describe("Warehouses to price, max 10, e.g. ['1062','1107']. Online price always included."),
      country: naCountry(),
    },
    post("prices"),
  );

  server.tool(
    "get_costco_availability",
    `Get in-warehouse stock status for one Costco item at up to 10 warehouses, plus pickup and same-day delivery availability. Status only, no quantities. 1 credit per 5 warehouses.`,
    {
      item_number: itemId(),
      warehouse_ids: z.array(warehouseId()).min(1).max(10)
        .describe("Warehouses to check, max 10, e.g. ['1062']."),
      country: naCountry(),
    },
    post("availability"),
  );

  server.tool(
    "get_costco_reviews",
    `Get Costco product reviews with rating distribution and recommend count. Sort, star filter, up to 100/page. 1 credit/page.`,
    {
      product_id: itemId()
        .describe("Costco product id (product_id from search_costco or get_costco_product)."),
      sort_by: z.enum(["newest", "oldest", "highest_rating", "lowest_rating", "most_helpful"]).optional()
        .describe("Default 'newest'."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this star rating."),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Reviews/page, max 100. Default 25."),
    },
    post("reviews"),
  );

  server.tool(
    "get_costco_warehouses",
    `Find Costco warehouses near a US zip or coordinates: warehouse_id, address, hours, departments, services, gas station hours and prices. Use to get warehouse_id for other Costco tools. 1 credit (2 for country 'ca').`,
    {
      ...locationFields(),
      country: anyCountry(),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Nearest warehouses to return, max 50. Default 10."),
    },
    post("warehouses"),
  );

  server.tool(
    "get_costco_gas_prices",
    `Get current regular, premium and diesel prices at Costco gas stations near a location or at specific warehouses. By location: 1 credit (2 for 'ca'). By warehouse_ids: 1 credit per 5 (ca: 2 per warehouse).`,
    {
      ...locationFields(),
      warehouse_ids: z.array(warehouseId()).min(1).max(10).optional()
        .describe("Specific warehouses instead of a location, max 10."),
      country: naCountry(),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Nearest stations to return, max 50. Default 10."),
    },
    post("gas"),
  );

  server.tool(
    "get_costco_coupons",
    `Get the current Costco member coupon book (US): offers with item number, amount off, final price, warehouse/online scope, limits, and the book's valid dates. A book holds ~200 offers; returns the first 50 by default (limit to change). 1 credit.`,
    {
      limit: z.number().int().min(1).max(500).optional()
        .describe("Max coupons returned (default 50). Local trim, same cost."),
    },
    async ({ limit }) => {
      try {
        const data = await getClient().post("/api/v1/costco/coupons", {});
        return trimResponse(data, { limit: limit ?? 50, listKeys: ["coupons"] });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_costco_deals",
    `List Costco deal feeds: new, while_supplies_last, treasure_hunt, member_favorites, online_only, on_sale. Same filters and per-warehouse pricing as search_costco. 1 credit/page.`,
    {
      type: z.enum(["new", "while_supplies_last", "treasure_hunt", "member_favorites", "online_only", "on_sale"])
        .describe("Deal feed, e.g. 'while_supplies_last'."),
      country: naCountry(),
      ...listingFilters(),
    },
    post("deals"),
  );

  server.tool(
    "get_costco_clearance",
    `Find Costco clearance and markdown items at one warehouse by scanning a query or category: .97 clearance and .00/.88 manager markdown by default, .49/.79/.89 special buy on request. Price codes are the member-community decode; covers items Costco lists online only. 1 credit (up to 5 pages).`,
    {
      warehouse_id: warehouseId(),
      query: z.string().min(1).max(200).optional()
        .describe("Keywords to scan, e.g. 'tv'. Pass query or category."),
      category: z.string().min(1).max(200).optional()
        .describe("Category slug to scan instead of a query."),
      pages: z.number().int().min(1).max(5).optional()
        .describe("Result pages of 120 to scan, max 5. Default 3."),
      price_codes: z.array(z.enum(["clearance", "manager_markdown", "special_buy"])).min(1).optional()
        .describe("Codes to keep. Default clearance + manager_markdown; special_buy is common on regular grocery prices."),
      country: naCountry(),
    },
    post("clearance"),
  );

  server.tool(
    "get_costco_search_suggestions",
    `Get Costco search suggestions for a partial query, plus matching warehouse locations. 1 credit.`,
    {
      query: z.string().min(1).max(100)
        .describe("Partial query, e.g. 'kirk'."),
      country: naCountry(),
    },
    post("autocomplete"),
  );
}
