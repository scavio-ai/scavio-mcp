import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

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
    .describe("Region to look up: a redfin.com region URL ('https://www.redfin.com/city/30818/TX/Austin', /neighborhood/, /county/, /zipcode/) or a bare 5-digit ZIP ('78701'). CITY NAMES ARE NOT ACCEPTED - 'Austin, TX' will fail. Required unless you pass region_id AND region_type."),
  region_id: z.number().int().min(1).optional()
    .describe("Redfin's internal region id, as returned in region.id by a previous response. NOT a ZIP code - the two are different number spaces, and a ZIP here resolves to another city rather than failing. Must be sent together with region_type."),
  region_type: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(6)]).optional()
    .describe("Redfin region type: 1 neighborhood, 2 ZIP, 5 county, 6 city. Must be sent together with region_id."),
};

export function registerRedfinTools(server: McpServer, getClient: () => ScavioClient) {
  const call = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(path, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_redfin",
    `Search Redfin, the US residential real-estate marketplace, and return listings as JSON: price, price per sqft, beds, baths, living area, lot size, year built, coordinates, listing remarks and full photo galleries. Covers for-sale, sold and for-rent inventory. IMPORTANT: days_on_market is ALWAYS NULL in the response - Redfin does not expose it on this feed, so filter with max_days_on_market / min_days_on_market instead of reading it back. CITY NAMES ARE NOT ACCEPTED: pass \`location\` as a redfin.com region URL (/city/, /neighborhood/, /county/, /zipcode/) or a bare 5-digit ZIP, or pass region_id AND region_type together. Paginated with page + limit, up to 350 listings per page (backend default 100). Every numeric filter is truncated into Redfin's query, so fractional bounds are rejected - 1.5 baths is not expressible. max_days_on_market and min_days_on_market cannot be combined, and sold_within_days is rejected unless listing_status=sold. Costs 1 credit.`,
    {
      ...regionRef,
      listing_status: z.enum(["for_sale", "sold", "for_rent"]).optional()
        .describe("Market to search. Backend default is 'for_sale'."),
      sold_within_days: z.number().int().min(1).optional()
        .describe("Sold within the last N days. ONLY valid with listing_status='sold', where the backend defaults it to 90 - sending it on any other listing_status is a 400."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based."),
      limit: z.number().int().min(1).max(350).optional()
        .describe("Listings per page, 1-350. Backend default is 100."),
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
        .describe("Result sort order. Backend default is Redfin's own 'recommended' ranking."),
      min_price: z.number().min(0).optional()
        .describe("Minimum price, inclusive. This is monthly rent when listing_status='for_rent'."),
      max_price: z.number().min(0).optional()
        .describe("Maximum price, inclusive. This is monthly rent when listing_status='for_rent'."),
      beds_min: z.number().int().min(0).optional()
        .describe("Minimum bedrooms. Whole numbers only."),
      beds_max: z.number().int().min(0).optional()
        .describe("Maximum bedrooms. Whole numbers only."),
      baths_min: z.number().int().min(0).optional()
        .describe("Minimum bathrooms, WHOLE baths only - 1.5 is rejected, not rounded."),
      sqft_min: z.number().int().min(0).optional()
        .describe("Minimum living area in square feet."),
      sqft_max: z.number().int().min(0).optional()
        .describe("Maximum living area in square feet."),
      lot_size_min: z.number().int().min(0).optional()
        .describe("Minimum lot size in square feet."),
      year_built_min: z.number().int().min(0).optional()
        .describe("Earliest year built."),
      year_built_max: z.number().int().min(0).optional()
        .describe("Latest year built."),
      max_hoa: z.number().min(0).optional()
        .describe("Maximum monthly HOA fee in dollars."),
      property_type: z.enum(["house", "condo", "townhouse", "multi_family", "land", "other", "co_op"]).optional()
        .describe("Restrict to one property type."),
      has_pool: z.boolean().optional()
        .describe("Only listings with a pool."),
      max_days_on_market: z.number().int().min(0).optional()
        .describe("Listed at most N days ago. Cannot be combined with min_days_on_market - Redfin expresses both through one param, so sending both is a 400."),
      min_days_on_market: z.number().int().min(0).optional()
        .describe("Listed at least N days ago. Cannot be combined with max_days_on_market."),
    },
    call("/api/v1/redfin/search"),
  );

  server.tool(
    "get_redfin_property",
    `Get one Redfin listing (US residential real estate) in full as JSON: price, the Redfin Estimate and rental estimate, the complete MLS fact sheet, price and tax history, listing agents, open houses, schools, climate risk, walkability and location scores, sun exposure, monthly weather, permits, zoning, comparable sales and photos. Takes a Redfin property id or any redfin.com listing URL carrying one - get either from search_redfin. Not paginated. Costs 1 credit, the same as a search page, because it reads the property page's inlined request cache in one fetch.`,
    {
      property_id: z.string().min(1).max(500)
        .describe("Redfin property id ('31295086'), or any redfin.com listing URL carrying one ('https://www.redfin.com/TX/Austin/7644-Parkview-Cir-78731/home/31295086'). Only the id in such a URL is used - Redfin resolves the address itself."),
    },
    call("/api/v1/redfin/property"),
  );

  server.tool(
    "get_redfin_market",
    `Get Redfin housing-market statistics for a US region as JSON: median list and sale price, median price per sqft, sale-to-list ratio, average number of offers, average days on market, year-over-year movement, Redfin's 0-100 compete score, live inventory broken down by property type, median price and active listings per bedroom count, and Redfin agent presence with aggregate rating. Region-level aggregates only - use search_redfin for individual listings. Addressed exactly like search_redfin: a redfin.com region URL or a bare 5-digit ZIP in \`location\`, or region_id AND region_type together. CITY NAMES ARE NOT ACCEPTED. Not paginated. Costs 1 credit.`,
    { ...regionRef },
    call("/api/v1/redfin/market"),
  );
}
