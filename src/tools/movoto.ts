import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/movoto.ts (US only, USD, no country). Rules the backend enforces and zod here does
// not: search takes exactly one place shape (city + state, zip with optional state, county + state, neighborhood +
// city + state, or school_id + city + state); market trends takes city + state or zip only; property and school take
// exactly one of url or path; *_min <= *_max; sold_within needs status sold; hide_pending, open_houses,
// price_reduced, new_listings, new_construction and foreclosed need status for_sale; hoa_* is refused on rentals and
// days_on_market_* on sold. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const STATUSES = ["for_sale", "sold", "rentals"] as const;
const SOLD_WITHIN = ["1w", "1m", "3m", "6m", "1y", "2y"] as const;
const PROPERTY_TYPES = ["single_family", "condo", "multi_family", "land", "mobile", "other"] as const;
const SORTS = ["relevant", "newest", "updated", "price_low", "price_high", "sqft_large", "sqft_small", "price_per_sqft"] as const;
const SUGGESTION_TYPES = ["city", "zipcode", "neighborhood", "county", "school"] as const;
const MAX_YEAR = new Date().getUTCFullYear() + 2;

const FIRST = "Movoto (movoto.com, the US home search site owned by Lower)";
const NAME = "Movoto";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_PII = "No listing-agent names, phones, emails or license numbers are returned; brokerage company names are (a brokerage label that is a person's name is null).";
const CARD =
  "id, property_id, url, path (the input of get_movoto_property), status, status_code, is_sold, is_rental, price (USD; monthly rent on rentals), sold_price (null in non-disclosure states such as Texas), currency, sold_date, list_date, days_on_movoto, price_change, price_changed_date, beds, baths, sqft, lot_sqft, year_built, hoa_fee_monthly, garage_spaces, property_type, property_type_label, mls_number, mls_id, brokerage, address {street, unit, city, state, zip, county, neighborhood, full}, latitude, longitude, photo, photo_count, open_houses [{date, start_time, end_time}], has_3d_tour, has_video_tour";
const SNAPSHOT =
  "{today, one_month_ago, one_year_ago: {date, all, single_family, condo: {median_list_price, median_price_per_sqft, median_days_on_market, median_home_sqft, inventory, change_1m_percent, change_1y_percent}}}";

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const state = z.string().length(2);
const zip = z.string().regex(/^\d{5}(-\d{4})?$/);

export function registerMovotoTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/movoto/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_movoto",
    `Search homes for sale, sold homes or rentals on ${FIRST}. Places: city + state, ZIP code, county + state, neighborhood + city + state, or the homes zoned for one school (school_id + city + state). Filters: property types, bedroom, bathroom, price, size, lot, year built, HOA and days-on-market ranges, garage spaces, pool, sold window, hide pending, open houses, price reduced (30 days), new listings (7 days), new construction, foreclosures; 8 sorts; 50 homes a page, up to 99 pages. Returns status, sold_within, location, url, sort, page, page_size, total, pages, has_more, count, listings [{${CARD}}], market_summary {homes_for_sale, average_list_price, median_price_per_sqft, min_list_price, max_list_price, new_listings, open_houses, price_reduced, new_construction, with_pool, condos, single_family, schools}, market_snapshot ${SNAPSHOT}, facet_counts {beds, baths, price_ranges, amenities}, top_zips, top_neighborhoods, nearby_cities, notes (incl. any filter Movoto did not apply). A page past the last one is an empty page with a note (charged). Captured 2026-11-26: homes for sale in Austin, TX gave 5885 over 99 pages; homes sold in the last month in Los Angeles, CA 935; a rental search in Austin, TX 3866, the first at 1637 USD a month. ${NO_PII} US only, USD. ${ONE}`,
    {
      city: z.string().min(1).max(80).optional().describe("A US city, with state (e.g. Austin)."),
      state: state.optional().describe("Two-letter US state code (e.g. TX): with city, county, neighborhood or school_id; optional with zip."),
      zip: zip.optional().describe("Or a five-digit ZIP code (state optional)."),
      county: z.string().min(1).max(80).optional().describe("Or a county, with state (Travis or Travis County)."),
      neighborhood: z.string().min(1).max(80).optional()
        .describe("Or a neighborhood, with city and state (get_movoto_suggestions returns neighborhood names)."),
      school_id: z.union([z.string().regex(/^\d{4,10}$/), z.number().int().positive()]).optional()
        .describe("Or the homes zoned for one school: a Movoto school id (get_movoto_school id, or get_movoto_suggestions school_id), with city and state."),
      status: z.enum(STATUSES).optional().describe("for_sale (default), sold or rentals."),
      sold_within: z.enum(SOLD_WITHIN).optional()
        .describe("status sold: sold in the last 1w, 1m, 3m, 6m, 1y or 2y (default every sale Movoto lists)."),
      hide_pending: z.boolean().optional().describe("status for_sale: leave out pending and contingent homes."),
      property_types: z.array(z.enum(PROPERTY_TYPES)).max(PROPERTY_TYPES.length).optional()
        .describe(`Any of: ${PROPERTY_TYPES.join(", ")} (e.g. ["single_family"]).`),
      beds_min: int(0, 20).optional().describe("Fewest bedrooms (e.g. 3)."),
      beds_max: int(0, 20).optional().describe("Most bedrooms."),
      baths_min: int(0, 20).optional().describe("Fewest bathrooms."),
      baths_max: int(0, 20).optional().describe("Most bathrooms."),
      price_min: int(0, 1_000_000_000).optional().describe("Lowest price, USD (monthly rent on rentals)."),
      price_max: int(0, 1_000_000_000).optional().describe("Highest price, USD (monthly rent on rentals; e.g. 750000)."),
      sqft_min: int(0, 1_000_000).optional().describe("Smallest living area, sqft."),
      sqft_max: int(0, 1_000_000).optional().describe("Largest living area, sqft."),
      lot_sqft_min: int(0, 100_000_000).optional().describe("Smallest lot, sqft."),
      lot_sqft_max: int(0, 100_000_000).optional().describe("Largest lot, sqft."),
      year_built_min: int(1700, MAX_YEAR).optional().describe("Earliest year built."),
      year_built_max: int(1700, MAX_YEAR).optional().describe("Latest year built."),
      hoa_min: int(0, 100_000).optional().describe("Lowest monthly HOA fee, USD (for_sale and sold)."),
      hoa_max: int(0, 100_000).optional().describe("Highest monthly HOA fee, USD (for_sale and sold)."),
      days_on_market_min: int(0, 3650).optional().describe("Fewest days on Movoto (for_sale and rentals)."),
      days_on_market_max: int(0, 3650).optional().describe("Most days on Movoto (for_sale and rentals)."),
      garage_min: int(1, 10).optional().describe("Fewest garage spaces."),
      pool: z.boolean().optional().describe("Only homes whose listing mentions a pool."),
      open_houses: z.boolean().optional().describe("status for_sale: only homes with an open house scheduled."),
      price_reduced: z.boolean().optional().describe("status for_sale: price reduced in the last 30 days."),
      new_listings: z.boolean().optional().describe("status for_sale: listed in the last 7 days."),
      new_construction: z.boolean().optional().describe("status for_sale: new construction."),
      foreclosed: z.boolean().optional().describe("status for_sale: foreclosures."),
      sort: z.enum(SORTS).optional()
        .describe("relevant (Movoto's default), newest (list date), updated, price_low, price_high, sqft_large, sqft_small, price_per_sqft (lowest first)."),
      page: int(1, 500).optional()
        .describe("Page, from 1 (50 homes a page). Movoto serves up to 99 pages per search; a page past the last is empty (with a note)."),
    },
    post("search"),
  );

  server.tool(
    "get_movoto_property",
    `One home on ${NAME} (for sale, sold or for rent) by link or path from search_movoto. Returns the card fields (${CARD}) plus on_market_date, building_name, mls_name, neighborhood_url, description (phone numbers and emails removed), features [{category, group, name, value}] (property tax, HOA fee and name, interior, exterior, utilities, schools ...), price_history [{date, event, price, change_percent, source, mls_number}], tax_history [{year, tax, assessed_total, assessed_land, assessed_improvements, tax_rate_percent}], estimate (Movoto's area-based estimate: the area's price per square foot times the home's size; for-sale and sold homes only, null on rentals; not an appraisal), key_insights, schools [{id, name, rating (GreatSchools 1-10), level, type, url (the input of get_movoto_school)}], school_districts, area_trends {city, zip, neighborhood, county}, city_market_snapshot, local_scores {food, pet, walk, kid}, local_highlights, nearby {sold, for_sale, new_construction, rentals: {total, homes}}, photos [{url, tag}], updated {last_updated, last_checked}, notes. Captured 2026-11-26: 12901 Sherbourne St, Austin, TX 78729, a 4-bed, 3-bath, 2000 sqft single-family home for sale at 649029 USD, with 7 price-history events, 3 schools, 35 photos and a Movoto area-based estimate of 542780 USD. An unknown listing is a charged 404. ${NO_PII} ${ONE}`,
    {
      url: z.string().min(20).max(400).optional()
        .describe("A Movoto property link (listings[].url of search_movoto). Send url or path."),
      path: z.string().min(8).max(400).optional()
        .describe("Or its path (listings[].path), e.g. austin-tx/6001-sierra-arbor-ct-austin-tx-78759/pid_lgzxbh54nh/."),
    },
    post("property"),
  );

  server.tool(
    "get_movoto_market_trends",
    `The housing market trends ${FIRST} publishes for a city (city + state) or a ZIP code: location, url, last_updated, summary, snapshots ${SNAPSHOT}, stat_cards, by_type {all, single_family, condo}, compare {label, rows [{name, current, median_price, yoy_change_percent, price_per_sqft, days_on_market, active_homes, url}]} (the nearby cities or ZIP codes), overview [{label, count, url}], daily (ZIP codes: Movoto's daily statistics, same shape as snapshots), notes. Today, one month ago and one year ago only: Movoto publishes no monthly series. Captured 2026-11-26: Los Angeles, CA had a median list price of 1049000 USD (down 4.6% year over year), 652 USD per sqft, 72 days on market and 5037 active listings; ZIP 78704 (Austin, TX) a median of 750000 USD and 367 active listings. ${ONE}`,
    {
      city: z.string().min(1).max(80).optional().describe("A US city, with state. Send city + state or zip."),
      state: state.optional().describe("Two-letter US state code (with city; optional with zip)."),
      zip: zip.optional().describe("Or a five-digit ZIP code."),
      include_daily: z.boolean().optional()
        .describe("With zip: add daily, Movoto's daily statistics for the ZIP code (default true; same 1 credit)."),
    },
    post("market-trends"),
  );

  server.tool(
    "get_movoto_suggestions",
    `The places ${NAME} suggests for the start of a city, ZIP code, neighborhood, county or school name: query, count, places [{type (city, zipcode, neighborhood, county, school), name, full_name, city, county, state, zip, neighborhood, school_id, listings, geo_id, latitude, longitude, search (the input of search_movoto for that place)}], notes. Places only: Movoto does not suggest street addresses. Captured 2026-11-26: Austin gave 16 places, the first Austin, TX with 6610 listings (search {city: Austin, state: TX}). ${ONE}`,
    {
      query: z.string().min(2).max(80)
        .describe("Required. The start of a city, ZIP code, neighborhood, county or school name (e.g. Austin)."),
      types: z.array(z.enum(SUGGESTION_TYPES)).max(SUGGESTION_TYPES.length).optional()
        .describe(`Only these place types: ${SUGGESTION_TYPES.join(", ")}.`),
    },
    post("suggestions"),
  );

  server.tool(
    "get_movoto_school",
    `One school on ${NAME} by link or path (get_movoto_property schools[].url): id, nces_id, name, url, level, type, address, latitude, longitude, district {id, name, nces_id, url, school_count}, rating (GreatSchools 1-10), state_rating {rating, year}, teacher_student_ratio, tests [{name, abbreviation, description, grades [{grade, subjects [{name, scores {year: percent}}]}]}], zone_homes (home cards), zone_search {school_id, city, state, url} (the search_movoto input for every home zoned for the school), nearby_schools, notes. Ratings and test scores are GreatSchools data as Movoto shows them; parent reviews are not returned. Captured 2026-11-26: Davis Elementary School, Austin, TX (PK, K-5, public, Austin Independent School District), rated 6 of 10, teacher-student ratio 1:12, with 10 zoned homes. An unknown school is a charged 404. ${ONE}`,
    {
      url: z.string().min(20).max(400).optional()
        .describe("A Movoto school link (get_movoto_property schools[].url). Send url or path."),
      path: z.string().min(10).max(400).optional().describe("Or its path: schools/<city-st>/<school>-<id>/."),
    },
    post("school"),
  );
}
