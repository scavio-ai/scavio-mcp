import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/lennar.ts (US only, USD, no country). Rules the backend enforces
// and zod here does not: search needs a place (market, state, city, text, latitude + longitude, or
// bounds); latitude and longitude go together; radius and sort distance need latitude + longitude;
// bounds needs north > south and east > west; *_min <= *_max; page * page_size stays within result
// 10,000; resolve takes exactly one of url or path (lennar.com only); payment interest_rate is a
// decimal above 0 (values above 1 are refused).
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const MODES = ["homes", "communities"] as const;
const SORTS = ["featured", "newest", "distance", "price_asc", "price_desc", "sqft_asc", "sqft_desc"] as const;
const HOME_TYPES = ["single_family", "multi_family", "next_gen", "single_story"] as const;
const COMMUNITY_TYPES = ["active_adult", "lifestyle"] as const;
const AVAILABILITY = ["quick_move_in", "under_construction", "coming_soon", "future_release"] as const;
const COMMUNITY_STATUSES = ["active", "coming_soon", "sold_out"] as const;
const SCHOOL_TYPES = ["public", "private", "charter"] as const;
const SCHOOL_LEVELS = ["elementary", "middle", "high"] as const;
const SCHOOL_RATINGS = ["A", "B", "C", "D"] as const;
const MAX_PAGE_SIZE = 200;

const FIRST = "Lennar (lennar.com, the US homebuilder)";
const NAME = "Lennar";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_PII = "No sales consultant names are returned; the sales office phone is Lennar's public business number.";
const SLOW = "Answers usually arrive within about 15 seconds: allow up to 4 minutes.";
const HOME_CARD =
  "type homesite: lot_id (the input of get_lennar_home), status, address, beds, baths, half_baths, sqft, price, was_price, price_text, currency, badge, hot_of_the_week, offer_available, offer_end_date, estimated_monthly_payment (as Lennar shows it, where it shows one), image, url, plan {plan_number, name, starting_price, url}, community {comnum, name, city, market}; type plan: plan_number, name, status, beds, baths, half_baths, sqft, starting_price, price_text, available_homesites, active_adult, next_gen, image, url, community";
const COMMUNITY_CARD =
  "type community: comnum (the input of get_lennar_community), name, status, badge, brand, types, base_price, price_text, bed_range, bath_range, sqft_range, address, zip, latitude, longitude, city, market, url; type master_planned: mpc_id (the input of get_lennar_master_planned), name, status, price_text, search_price_text, ranges, city, market, url, communities [{comnum, base_price}]";

const marketCode = z.string().regex(/^[A-Za-z]{2,4}$/);
const comnum = z.string().regex(/^\d{2,8}$/)
  .describe("A Lennar community number (communities[].comnum or homes[].community.comnum of search_lennar, e.g. 22704).");
const lotId = z.string().regex(/^[A-Za-z0-9]{6,16}$/)
  .describe("A Lennar homesite lot id (homes[].lot_id of search_lennar, e.g. 22704535134).");
const int = (min: number, max: number) => z.number().int().min(min).max(max);

export function registerLennarTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/lennar/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_lennar",
    `Search new homes or communities on ${FIRST}. Places: a market code, a state, a city, Lennar's text search, latitude + longitude (+ radius in miles) or a map box (bounds). Filters: fewest beds and baths, price and square-foot ranges, home types, community types (active adult, lifestyle), homesite availability (quick move-in, under construction, coming soon, future release), community status, feature codes, school district, school type, school level and school rating; 7 sorts; 1-${MAX_PAGE_SIZE} results a page. Returns mode, the place echoed, sort, page, page_size, total, totals {communities, plans, homesites}, is_fallback (Lennar had no exact match and shows its fallback results), count, has_more, homes [${HOME_CARD}] or communities [${COMMUNITY_CARD}], notes. Captured 2026-11-26: homes in the Dallas / Ft. Worth market (DAL) by lowest price gave 890 homesites (60 communities, 372 plans), the first a move-in ready 1-bed, 661 sqft Henley homesite in The Alcove Dream, Princeton, at 117499 USD. US only, USD. ${NO_PII} ${ONE} ${SLOW}`,
    {
      mode: z.enum(MODES).optional()
        .describe("homes (default: homesites and floor plans) or communities (communities and master-planned communities)."),
      market: marketCode.optional().describe("A Lennar market code (get_lennar_markets states[].markets[].code, e.g. DAL, PHO, ORL, HOU)."),
      state: z.string().regex(/^[A-Za-z]{2}$/).optional().describe("Or a two-letter state code (e.g. TX)."),
      city: z.string().min(1).max(80).optional()
        .describe("Or a city name (get_lennar_market cities[].name, e.g. Katy), alone or with market or state."),
      text: z.string().min(1).max(100).optional()
        .describe("Or Lennar's text search (it matches community and plan names; use get_lennar_suggestions for places)."),
      latitude: z.number().min(17).max(72).optional().describe("Or a point: latitude, with longitude (e.g. 32.7767)."),
      longitude: z.number().min(-180).max(-60).optional().describe("Longitude, with latitude (e.g. -96.797)."),
      radius: int(1, 100).optional().describe("With latitude + longitude: miles, 1-100."),
      bounds: z.object({ north: z.number(), east: z.number(), south: z.number(), west: z.number() }).optional()
        .describe("Or a map box {north, east, south, west} (a suggestion's search.bounds)."),
      beds_min: int(1, 6).optional().describe("Fewest bedrooms, 1-6."),
      baths_min: int(1, 6).optional().describe("Fewest bathrooms, 1-6."),
      price_min: int(0, 50_000_000).optional().describe("Lowest price, USD."),
      price_max: int(1, 50_000_000).optional().describe("Highest price, USD (e.g. 400000)."),
      sqft_min: int(0, 50_000).optional().describe("Smallest living area, sqft."),
      sqft_max: int(1, 50_000).optional().describe("Largest living area, sqft."),
      home_types: z.array(z.enum(HOME_TYPES)).max(HOME_TYPES.length).optional()
        .describe(`Any of: ${HOME_TYPES.join(", ")}.`),
      community_types: z.array(z.enum(COMMUNITY_TYPES)).max(COMMUNITY_TYPES.length).optional()
        .describe("active_adult (55+) or lifestyle."),
      availability: z.array(z.enum(AVAILABILITY)).max(AVAILABILITY.length).optional()
        .describe("Homesite availability: quick_move_in (move-in ready), under_construction, coming_soon, future_release (e.g. [\"quick_move_in\"])."),
      community_status: z.array(z.enum(COMMUNITY_STATUSES)).max(COMMUNITY_STATUSES.length).optional()
        .describe("active, coming_soon or sold_out."),
      features: z.array(z.string().regex(/^[A-Za-z0-9_]{2,40}$/)).max(10).optional()
        .describe("Up to 10 feature codes as get_lennar_market gives them (features[].code, e.g. SSTORY, 3GAR, SWIMMING_POOL)."),
      school_district: z.string().min(2).max(120).optional()
        .describe("A school district as get_lennar_market gives it (school_districts[].code)."),
      school_types: z.array(z.enum(SCHOOL_TYPES)).max(3).optional().describe(`Any of: ${SCHOOL_TYPES.join(", ")}.`),
      school_levels: z.array(z.enum(SCHOOL_LEVELS)).max(3).optional().describe(`Any of: ${SCHOOL_LEVELS.join(", ")}.`),
      school_rating: z.enum(SCHOOL_RATINGS).optional().describe("Lennar's school rating filter: A, B, C or D."),
      sort: z.enum(SORTS).optional()
        .describe("featured (default), newest, distance (needs latitude + longitude), price_asc, price_desc, sqft_asc, sqft_desc."),
      page: int(1, 1000).optional().describe("Page, from 1; has_more says whether another exists."),
      page_size: int(1, MAX_PAGE_SIZE).optional().describe(`Results per page, 1-${MAX_PAGE_SIZE} (default 25).`),
    },
    post("search"),
  );

  server.tool(
    "get_lennar_community",
    `One ${NAME} community by community number: comnum, name, status, brand, types, address, city, state, zip, latitude, longitude, market, master_planned, base_price, price_range {min, max}, price_text, sqft_range, bed_range, bath_range, stories_range, homesites_count, tourable, hoa_fee, hoa_fee_is_monthly, development_fee, tax_rate_percent, deposit_amount, overview, hours [{day, opening, closing, by_appointment}] (the sales center), sales_office {phone, time_zone, phone_hours}, schools [{name, grades, district, public}], amenities, image, url, plans [{plan_number (the input of get_lennar_plan), name, beds, baths, sqft, garages, starting_price, available_homesites, url, homesites [{lot_id, status, address, price, was_price, est_move_in_date, hot_of_the_week, url}]}]. Captured 2026-11-26: Kresston in Montgomery, TX (comnum 22704, Houston market) from 339990 USD, with 48 homesites across 7 plans, an HOA fee of 100 USD and a 3% tax rate. An unknown community is a charged 404. ${NO_PII} ${ONE}`,
    { comnum },
    post("community"),
  );

  server.tool(
    "get_lennar_plan",
    `One ${NAME} floor plan by community number + plan number: plan_number, name, status, beds, baths, half_baths, sqft, garages, starting_price, was_starting_price, price_text, next_gen, available_homesites, tourable, virtual_tour_url, video_tour_url, overview, image, floor_plans [{name, image}], included_features [{category, items}], homesites [{lot_id, status, address, sqft, price, was_price, url}], other_homes [{name, starting_price, available_homesites, url}], community, url. Captured 2026-11-26: the Melrose II plan (4504) in Kresston (comnum 22704): 4 beds, 3 baths, 2731 sqft, from 424990 USD, 2 homesites available. An unknown plan is a charged 404. ${ONE}`,
    {
      comnum,
      plan_number: z.string().regex(/^[A-Za-z0-9]{1,10}$/)
        .describe("A plan number (get_lennar_community plans[].plan_number, e.g. 4504)."),
    },
    post("plan"),
  );

  server.tool(
    "get_lennar_home",
    `One ${NAME} homesite (a quick move-in or to-be-built home) by lot id: lot_id, homesite_number, name, status, address, latitude, longitude, price, was_price, price_text, beds, baths, half_baths, garages, stories, sqft, closing_cost_incentive, incentive_disclaimer, est_move_in_date, reserved, hot_of_the_week, badge, offer_available, offer_end_date, tourable, virtual_tour_url, overview, estimated_monthly_payment, image, url, plan, community {comnum, name, city, market, hoa_fee, tax_rate_percent, url}. Captured 2026-11-26: homesite 22704535134, a move-in ready Melrose II in Kresston at 384990 USD, was 424990 USD (4 beds, 3 baths, 2731 sqft). An unknown or sold homesite is a charged 404. ${ONE}`,
    { lot_id: lotId },
    post("home"),
  );

  server.tool(
    "get_lennar_master_planned",
    `One ${NAME} master-planned community by id: mpc_id, name, status, brand, overview, price_text, search_price_text, bed_range, bath_range, sqft_range, latitude, longitude, city, market, url, communities [{comnum, name, status, types, base_price, price_range, homesites_count, hoa_fee, tax_rate_percent, url}]. Captured 2026-11-26: Samara in League City (mpc_id 1916, Houston market), $256,990 - $699,990 across 11 communities. An unknown id is a charged 404. ${ONE}`,
    {
      mpc_id: z.number().int().positive()
        .describe("A master-planned community id (communities[].mpc_id of search_lennar with mode communities, e.g. 1916)."),
    },
    post("master-planned"),
  );

  server.tool(
    "get_lennar_markets",
    `Every state and metro market ${FIRST} builds in: state_count, market_count, states [{code, name, markets [{code (the market input of search_lennar, get_lennar_market and get_lennar_promotions), name, plan_count, latitude, longitude, url}]}]. Captured 2026-11-26: 104 markets in 32 states. ${ONE}`,
    {},
    post("markets"),
  );

  server.tool(
    "get_lennar_market",
    `One ${NAME} metro market by market code: code, name, state, plan_count, latitude, longitude, phone, promo_url, url, cities [{name, url}], features [{name, code}] and school_districts [{name, code}] (the search filter codes for the market). Captured 2026-11-26: Phoenix (PHO), AZ: 263 plans, 14 cities, 24 feature codes and 20 school districts. An unknown code is a charged 404. ${ONE}`,
    { market: marketCode.describe("A Lennar market code (get_lennar_markets states[].markets[].code, e.g. PHO).") },
    post("market"),
  );

  server.tool(
    "get_lennar_suggestions",
    `The places, communities and plans ${NAME} suggests for a few letters: query, market, count, suggestions [{category, type, text, search (the search_lennar input the suggestion stands for: market, state, city, bounds, beds_min), path (for resolve_lennar_url), url}], notes. Captured 2026-11-26: Katy gave 10 suggestions, the first the Katy Area, TX region with its state and map box as the search input. ${ONE}`,
    {
      query: z.string().min(2).max(80)
        .describe("Required. The start of a city, ZIP code, region, community or plan name (e.g. Katy)."),
      market: marketCode.optional().describe("Favor one market (a market code)."),
      limit: int(1, 20).optional().describe("Suggestions, 1-20 (default 10)."),
    },
    post("suggestions"),
  );

  server.tool(
    "resolve_lennar_url",
    `What a lennar.com link is: path, type (community, plan, home or master_planned), page_type, ids {comnum, plan_number, lot_id, mpc_id} (the inputs of get_lennar_community, get_lennar_plan, get_lennar_home and get_lennar_master_planned). Captured 2026-11-26: the link of the Melrose II plan in Kresston resolved to type plan with comnum 22704 and plan_number 4504. A link that is no such page is a charged 404. ${ONE}`,
    {
      url: z.string().min(10).max(400).optional()
        .describe("A lennar.com community, plan, home or master-planned community link. Send url or path."),
      path: z.string().min(10).max(400).optional().describe("Or its path (/new-homes/...)."),
    },
    post("resolve"),
  );

  server.tool(
    "get_lennar_promotions",
    `The market-wide promotion ${NAME} shows for a market: market, promo_url, promotion {title, legal, offers [{header, type, title, incentives, legal, legal_details}], homesites [{lot_id, community, comnum, city, plan, plan_number, address, zip, beds, baths, sqft, price, was_price, status, est_move_in_date, url}]} (offers and legal copy exactly as Lennar shows them), or promotion null when none runs, notes. Captured 2026-11-26: Dallas / Ft. Worth (DAL) ran "Black Friday Deals!" with an offer of up to a $20,000 price reduction; Orlando (ORL) ran "Black Friday Sale!" listing 18 homesites. ${ONE}`,
    { market: marketCode.describe("A Lennar market code (get_lennar_markets states[].markets[].code, e.g. DAL).") },
    post("promotions"),
  );

  server.tool(
    "get_lennar_payment",
    `The monthly payment estimate Lennar's calculator gives for a homesite with a down payment and an interest rate: lot_id, comnum, input, currency, estimate {principal_and_interest, property_tax, property_tax_rate, home_insurance, home_insurance_rate, mortgage_insurance, mortgage_insurance_rate, hoa_fee, community_development_fee, down_payment, down_payment_percent, interest_rate, legal_disclaimer}, notes. Amounts are Lennar's calculator's (Lennar Mortgage, LLC), not a quote. Captured 2026-11-26: homesite 22704535134 in Kresston with 20000 USD down at 0.07 gave 2428.29 USD principal and interest, 962.47 property tax, 160.41 home insurance, 237.24 mortgage insurance and a 100 USD HOA fee a month. A homesite with no estimate is a charged 404. ${ONE}`,
    {
      lot_id: lotId,
      comnum,
      down_payment: z.number().min(0).max(50_000_000).describe("Required. Down payment, USD (e.g. 40000)."),
      interest_rate: z.number().gt(0).max(1)
        .describe("Required. Interest rate as a decimal: 0.065 for 6.5% (values above 1 are refused)."),
    },
    post("payment"),
  );
}
