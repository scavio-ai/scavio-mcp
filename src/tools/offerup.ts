import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/offerup.ts (US only, no country). Rules the backend enforces
// and zod here does not: radius and max_mileage take OfferUp's steps only; year_min <= year_max,
// min_price <= max_price; seller_type on search limits it to Cars & Trucks (category_id 5.1, any
// other category_id is a 400); listing takes listing_id or url. No zod `.default()`: the MCP SDK
// would post a defaulted field on every call.

const SORTS = ["best_match", "newest", "distance", "price_low", "price_high", "newest_year", "lowest_mileage"] as const;
/** Category feeds have no best_match order. */
const CATEGORY_SORTS = ["newest", "distance", "price_low", "price_high", "newest_year", "lowest_mileage"] as const;
const CONDITIONS = ["new", "open_box", "refurbished", "used", "for_parts", "other"] as const;
const RADII = [5, 10, 20, 25, 30, 50, 80, 100, 200, 1500];
const MILEAGES = [0, 25_000, 50_000, 75_000, 100_000, 125_000, 150_000, 175_000, 200_000];

const FIRST = "OfferUp (offerup.com, the US local marketplace for buying and selling used items, cars and trucks)";
const NAME = "OfferUp";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRIVATE =
  'Private sellers: no seller names (a dealer or business account\'s name only), usernames, avatars, phone numbers, emails, street addresses, coordinates or VINs are returned; phone numbers, emails and VIN-like codes inside titles and descriptions read "[removed]". Locations are city and state. Prices are asking prices in USD, not sold prices.';
const NOT_AVAILABLE =
  "Not available: sold listings or sold prices (OfferUp does not show them publicly), shipping (OfferUp ended nationwide shipping in 2025: listings are local pickup), search suggestions, a total result count, a seller's listings past the first 20, messaging or offers. For the same item's new price use the Amazon and Walmart tools, for sold prices Mercari's sold search (match on model and title).";
const TILE =
  "listing_id (the input of get_offerup_listing), title, price (asking price, USD; null with call_for_price), call_for_price, city, state, url, image, firm_price, sponsored (a promoted OfferUp listing), local_pickup, vehicle_miles";
const FEED = `page, sort (as OfferUp applied it), location {zip, requested, resolved (the place OfferUp names for the ZIP), radius_miles}, filters_applied, filters_not_applied (filters OfferUp did not apply to this feed, e.g. vehicle filters on a non-vehicle search; also said in notes), has_more, count, items [{${TILE}}], market {country, currency}, notes. 44-50 listings a page, no total count; tiles carry no posted date or condition (read get_offerup_listing)`;
const FILTERS =
  "around a US ZIP with a radius, filtered by asking price, condition and, for vehicles, dealer or private seller, make, model year and mileage, paged up to page 50";

const feedShape = {
  zip: z.union([z.string().min(5).max(10), z.number().int()])
    .describe("Required. A 5-digit US ZIP code (e.g. 98101): OfferUp lists local items, so results are around this ZIP. An unknown ZIP is a 400, not charged."),
  radius: z.number().int().optional()
    .describe(`Miles around the ZIP: one of ${RADII.join(", ")} (OfferUp's own radii: 5-80 for goods, default 30; 5, 25, 80 (default), 100, 200, 1500 for vehicles). location.radius_miles says which radius OfferUp applied.`),
  page: z.number().int().min(1).max(50).optional()
    .describe("Page (default 1, at most 50); 44-50 listings a page."),
  min_price: z.number().int().min(0).max(1_000_000).optional().describe("Lowest asking price, whole USD."),
  max_price: z.number().int().min(0).max(1_000_000).optional().describe("Highest asking price, whole USD."),
  condition: z.union([z.enum(CONDITIONS), z.string().max(80), z.array(z.enum(CONDITIONS)).min(1).max(6)]).optional()
    .describe("Condition (one, a list, or comma-separated): new, open_box, refurbished, used, for_parts, other (OfferUp's condition filter)."),
  seller_type: z.enum(["dealer", "private"]).optional()
    .describe("Cars and trucks: dealer (OfferUp's verified dealers) or private (private sellers). On search it limits the results to Cars & Trucks (category_id 5.1), where OfferUp applies it."),
  make: z.string().max(40).optional()
    .describe("Vehicles: the make as OfferUp lists it (Toyota, Ford, Honda ...; 61 makes)."),
  year_min: z.number().int().min(1936).max(2027).optional().describe("Vehicles: earliest model year (1936-2027)."),
  year_max: z.number().int().min(1936).max(2027).optional().describe("Vehicles: latest model year (1936-2027)."),
  max_mileage: z.number().int().optional()
    .describe(`Vehicles: most miles, one of OfferUp's steps: ${MILEAGES.join(", ")}.`),
};

export function registerOfferupTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/offerup/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_offerup",
    `Search the listings of ${FIRST} by keywords ${FILTERS}, sorted (best match, newest, distance, price low or high, and for vehicles newest model year and lowest mileage). Returns query, ${FEED}. The same keyword in two ZIPs gives the asking prices in two US metros. Captured 2026-11-25: "iphone 15" around 98101 resolved to Seattle (30 miles, 47 listings on page 1); "toyota tacoma" around 75201 (Dallas, 80 miles) with seller_type dealer, year_min 2018, max_mileage 100000 and sort lowest_mileage listed a 2025 Toyota Tacoma 2WD at 35495 USD with 10017 miles. ${PRIVATE} ${NOT_AVAILABLE} ${ONE}`,
    {
      q: z.string().min(1).max(200).describe("Keywords (e.g. iphone 15)."),
      ...feedShape,
      sort: z.enum(SORTS).optional()
        .describe("best_match (default), newest, distance, price_low, price_high; vehicle searches also newest_year and lowest_mileage."),
      category_id: z.string().max(10).optional()
        .describe("Only listings in this category: categories[].id or children[].id from get_offerup_categories (e.g. 2.1 Furniture, 5.1 Cars & Trucks)."),
    },
    post("search"),
  );

  server.tool(
    "get_offerup_listing",
    `One ${NAME} listing by id or link: listing_id, title, price, original_price (as given), currency, firm_price, status (listed or sold, as given), removed, condition (new, refurbished, open_box, used, for_parts, other: OfferUp's grade), posted_at, updated_at, quantity, description, photos, category {id, l1, l2}, attributes [{name, label, values}] (OfferUp's category attributes, no VIN), vehicle {make, model, year, mileage, trim, body, color, drivetrain, fuel, transmission, cylinders, mpg_city, mpg_highway} (cars and trucks; no VIN), city, state, local_pickup, seller {id (the input of get_offerup_seller), seller_type (individual, business or dealer), business_name (dealer and business accounts only), rating, rating_count, items_sold, items_purchased, joined, response_time, last_active, verified_badges (null here: read get_offerup_seller)}, url, market, notes. Captured 2026-11-25: a dealer's 2021 Toyota Tacoma SR Double Cab in Fort Worth, TX at 27224 USD with 65692 miles, condition used, local pickup. ${PRIVATE} An unknown id is a charged 404. Costs 1 credit; a listing that needs a second, costlier fetch is 2 (credits_used says which). Failed upstream calls and refused inputs are not charged.`,
    {
      listing_id: z.string().max(40).optional()
        .describe("An OfferUp listing id (items[].listing_id, e.g. 7a392126-fb9d-34c2-a6d8-1b94698428df). Send listing_id or url."),
      url: z.string().min(10).max(2000).optional()
        .describe("An OfferUp listing link (https://offerup.com/item/detail/<listing id>) instead of listing_id."),
    },
    post("listing"),
  );

  server.tool(
    "get_offerup_category",
    `Browse one category of ${FIRST} by slug or id ${FILTERS}, sorted (newest by default, distance, price low or high; cars-and-trucks also newest model year and lowest mileage; no best_match order). Returns category {id, name, slug, url, parent}, ${FEED}. Captured 2026-11-25: furniture around 90012 resolved to Los Angeles (30 miles, 49 listings on page 1). ${PRIVATE} An unknown category is a charged 404. ${ONE}`,
    {
      category: z.string().min(1).max(80)
        .describe("Required. A category slug (categories[].slug or children[].slug from get_offerup_categories, e.g. furniture, cars-and-trucks) or id (e.g. 2.1). An unknown slug is a charged 404."),
      ...feedShape,
      sort: z.enum(CATEGORY_SORTS).optional()
        .describe("newest (default), distance, price_low, price_high; cars-and-trucks also newest_year and lowest_mileage. Category feeds have no best_match order."),
    },
    post("category"),
  );

  server.tool(
    "get_offerup_categories",
    `The category tree of ${FIRST}: count (top-level), total, categories [{id, name, slug, url, children [{id, name, slug, url}]}], market, notes. 14 top-level categories, 151 in all (captured 2026-11-25). Slugs and ids are get_offerup_category's category; ids are search_offerup's category_id. ${ONE}`,
    {},
    post("categories"),
  );

  server.tool(
    "get_offerup_seller",
    `A seller's public profile on ${FIRST} by seller id (a listing's seller.id): seller_id, seller_type (individual, business or dealer), business_name (dealer and business accounts only), rating, rating_count, rating_attributes [{label, count}], items_sold, items_purchased, followers, joined, city, state, response_time, last_active, verified_badges, website and opening_hours (dealer and business accounts only), count, listings [{listing_id, title, price, status, city, state, url, image, vehicle_miles}] (the first 20 the profile shows), url, market, notes. Captured 2026-11-25: a Dallas dealer (seller id 8668343) rated 4.5 from 17 ratings with 925 items sold. ${PRIVATE} An unknown id is a charged 404. ${ONE}`,
    {
      seller_id: z.union([z.string().min(1).max(200), z.number().int().positive()])
        .describe("Required. A seller id (a listing's seller.id; digits, e.g. 8668343) or an offerup.com/p/<id> link."),
    },
    post("seller"),
  );
}
