import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Redfin - US residential real estate. Three tools, 1 credit each, flat:
// property and market read the listing/region PAGE, whose inlined request cache
// replaces the ~40 internal calls the page made, which is why a full fact sheet
// costs the same as a search page.
//
// Two things a model must be told or it will burn a billed call:
//   1. CITY NAMES ARE NOT ACCEPTED on `location`. Redfin's own name lookup is
//      the single path its edge blocks our proxy pool from. A redfin.com region
//      URL, a bare 5-digit ZIP, or region_id + region_type together.
//   2. days_on_market IS ALWAYS NULL on search - Redfin's mainHouseInfo has no
//      `dom` key. It is described as null here rather than omitted, because a
//      model that sees "days on market" in a field list will otherwise plan
//      around a value that never arrives.
//
// No zod `.default()` anywhere in this file, deliberately: the MCP SDK applies
// a zod default BEFORE the handler runs, so a declared default is posted on
// every call. `sold_within_days` is the sharp edge - the backend REJECTS it
// unless listing_status=sold, so a default of 90 here would 400 every for-sale
// search. Defaults belong to the backend and are documented in .describe() text.

/** location OR (region_id AND region_type) - the region halves must travel together. */
const regionRef = {
  location: z.string().min(1).max(500).optional()
    .describe("Redfin URL or 5-digit ZIP. CITY NAMES NOT ACCEPTED. Required unless region_id+region_type."),
  region_id: z.number().int().min(1).optional()
    .describe("Redfin region id (NOT a ZIP). Use with region_type."),
  region_type: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(6)]).optional()
    .describe("1=neighborhood, 2=ZIP, 5=county, 6=city. Use with region_id."),
};

export function registerRedfinTools(server: McpServer, getClient: () => ScavioClient) {
  const call = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(path, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_redfin",
    `Search Redfin US real estate listings. CITY NAMES NOT ACCEPTED for location. days_on_market is ALWAYS NULL; filter via max/min_days_on_market. sold_within_days only valid with listing_status=sold. 1 credit.`,
    {
      ...regionRef,
      listing_status: z.enum(["for_sale", "sold", "for_rent"]).optional()
        .describe("Default 'for_sale'."),
      sold_within_days: z.number().int().min(1).optional()
        .describe("Last N days. ONLY with listing_status=sold, else 400."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      limit: z.number().int().min(1).max(350).optional()
        .describe("Per page, default 100."),
      sort: z.enum([
        "recommended",
        "price_low",
        "price_high",
        "newest",
        "oldest",
        "sqft_low",
        "sqft_high",
        "price_per_sqft_low",
        "price_per_sqft_high",
      ]).optional()
        .describe("Sort order."),
      min_price: z.number().min(0).optional()
        .describe("Min price (rent if for_rent)."),
      max_price: z.number().min(0).optional()
        .describe("Max price (rent if for_rent)."),
      beds_min: z.number().int().min(0).optional()
        .describe("Min bedrooms."),
      beds_max: z.number().int().min(0).optional()
        .describe("Max bedrooms."),
      baths_min: z.number().int().min(0).optional()
        .describe("Min baths, whole only."),
      sqft_min: z.number().int().min(0).optional()
        .describe("Min sqft."),
      sqft_max: z.number().int().min(0).optional()
        .describe("Max sqft."),
      lot_size_min: z.number().int().min(0).optional()
        .describe("Min lot sqft."),
      year_built_min: z.number().int().min(0).optional()
        .describe("Earliest year."),
      year_built_max: z.number().int().min(0).optional()
        .describe("Latest year."),
      max_hoa: z.number().min(0).optional()
        .describe("Max HOA $/mo."),
      property_type: z.enum(["house", "condo", "townhouse", "multi_family", "land", "other", "co_op"]).optional()
        .describe("Property type."),
      has_pool: z.boolean().optional()
        .describe("Pool filter."),
      max_days_on_market: z.number().int().min(0).optional()
        .describe("At most N days. Cannot combine with min."),
      min_days_on_market: z.number().int().min(0).optional()
        .describe("At least N days. Cannot combine with max."),
    },
    call("/api/v1/redfin/search"),
  );

  server.tool(
    "get_redfin_property",
    `Full Redfin property detail: estimates, MLS facts, history, schools, comps. 1 credit.`,
    {
      property_id: z.string().min(1).max(500)
        .describe("Property id or redfin.com URL."),
    },
    call("/api/v1/redfin/property"),
  );

  server.tool(
    "get_redfin_market",
    `Redfin housing-market stats for a US region: prices, inventory, compete score. CITY NAMES NOT ACCEPTED. 1 credit.`,
    { ...regionRef },
    call("/api/v1/redfin/market"),
  );
}
