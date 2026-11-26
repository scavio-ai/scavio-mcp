import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/hotpads.ts (US only incl. DC and Puerto Rico, USD; HotPads Canada is refused).
// Rules the backend enforces and zod here does not: area is a suggestions resource_id or a place such as "Austin, TX"
// (a ZIP has 5 digits); beds (exact) and beds_min are not sent together; baths_min is one of 1, 1.5, 2, 3, 4;
// *_min <= *_max; one amenity per search; listing takes exactly one of url or id; listing_alias is 6-20 lowercase
// letters and digits. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const TYPES = ["apartments", "houses", "condos", "townhomes", "rooms", "sublets", "by_owner"] as const;
const SORTS = ["default", "price_low", "price_high", "newest"] as const;
const PETS = ["dogs", "cats"] as const;
const AMENITIES = ["parking", "furnished"] as const;

const FIRST = "HotPads (hotpads.com, Zillow Group's rental search site)";
const NAME = "HotPads";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_PII = "Landlord and agent names, phones and emails are not returned; company_name is given for property-managed listings.";
const CARD =
  "alias (the listing_alias of get_hotpads_fees), url (the url of get_hotpads_listing), property_type, listing_type, title, unit, address {street, city, state, zip}, beds_min, beds_max, baths_min, baths_max, sqft_min, sqft_max, price_min, price_max, currency, unit_count, new_unit_count, price_drop_count, special_offer, tags (HotPads' card tags, e.g. New Today, Price Drop), labels, total_monthly_price, room {furnished, private_bath, roommates, room_sqft}, photo_count, photos, activated, updated";

const alias = z.string().min(6).max(20);

export function registerHotpadsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/hotpads/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_hotpads",
    `Search rentals on ${FIRST}: apartments, houses, condos, townhomes, rooms, sublets or for-rent-by-owner listings in a US city, neighborhood, borough or ZIP code, filtered by beds (exact or minimum), baths, rent, square feet, dogs or cats, in-unit laundry, parking or furnished and keywords, sorted 4 ways, 40 buildings a page. Returns area, type, currency, filters, applied_filters (the filters HotPads applied), sort, applied_sort, title, total_units, total_buildings, min_price, page, page_size, pages, has_more, count, listing_count, buildings [{id (the id of get_hotpads_listing), url, latitude, longitude, listing_count, listings [{${CARD}}]}], notes. Rents are USD a month. A page past the last one is an empty page with a note. Captured 2026-11-26: for-rent-by-owner listings in dallas-tx gave 775 units in 600 buildings over 15 pages, from 750 USD a month. An area HotPads does not have is a charged 404. ${NO_PII} ${ONE}`,
    {
      area: z.string().min(2).max(160)
        .describe("Required. A HotPads area: a get_hotpads_suggestions areas[].resource_id (brooklyn-new-york-ny, austin-tx, 90012), or a place such as Austin, TX. US only."),
      type: z.enum(TYPES).optional()
        .describe("apartments (default), houses, condos, townhomes, rooms (rooms for rent), sublets or by_owner (for rent by owner)."),
      beds: z.number().int().min(0).max(8).optional().describe("An exact bedroom count (0 is a studio). Send beds or beds_min."),
      beds_min: z.number().int().min(1).max(8).optional().describe("Or at least this many bedrooms."),
      baths_min: z.number().optional().describe("At least this many bathrooms: 1, 1.5, 2, 3 or 4."),
      price_min: z.number().int().min(0).max(100_000).optional().describe("Lowest monthly rent, USD."),
      price_max: z.number().int().min(1).max(100_000).optional().describe("Highest monthly rent, USD (e.g. 3000)."),
      sqft_min: z.number().int().min(0).max(50_000).optional().describe("Smallest size, sqft."),
      sqft_max: z.number().int().min(1).max(50_000).optional().describe("Largest size, sqft."),
      pets: z.enum(PETS).optional().describe("dogs or cats: listings that allow them (HotPads takes one per search)."),
      in_unit_laundry: z.boolean().optional().describe("Only listings with an in-unit washer and dryer."),
      amenity: z.enum(AMENITIES).optional().describe("parking or furnished (the amenity filters HotPads applies; one per search)."),
      keywords: z.string().min(1).max(80).optional().describe("Keywords HotPads matches in listings, e.g. balcony."),
      sort: z.enum(SORTS).optional().describe("default (HotPads' own order), price_low, price_high or newest."),
      page: z.number().int().min(1).max(200).optional().describe("Page of 40 buildings, from 1; pages says how many."),
    },
    post("search"),
  );

  server.tool(
    "get_hotpads_listing",
    `One ${NAME} listing in full by link or id (a single home, a unit, or a building with its floor plans): id, alias (the listing_alias of get_hotpads_fees), url, building_url, title, name, property_type, listing_type, is_building, unit, active, address, latitude, longitude, currency, price_min, price_max, price_text, beds / baths / sqft ranges, unit_count, new_unit_count, price_drop_count, description, is_mls, mls_disclaimer, furnished, lease_terms, office_hours, special_offer, special_offers, amenities, highlights, amenity_summary, pet_policies {cats, dogs [{allowed, size, deposit, one_time_fee, monthly_fee, max_allowed, max_weight, comment, restriction}]}, floorplans [{model_id, name, beds, baths, sqft, price_min, price_max, price_text, availability_date, layouts, unit_count, units [{id, name, beds, baths, sqft, price_min, price_max, availability_date, is_new, price_drop, listed}]}], total_monthly_price [{id, text}], history {created, activated, updated}, popularity {since, views, inquiries, favorites}, area_comparison [{type, name, area_average_price, listing_price, difference, vs_area_pct}] (HotPads' comparison with neighborhood, ZIP, city and county averages), schools [{name, type, grades, rating, is_private, students, city}], similar_listings, photo_count, photos, price_history {listing_alias, model_id} (the inputs of get_hotpads_price_history; null when HotPads publishes none), company_name (property-managed listings only), paid_multifamily, trusted, rental_application, notes. Captured 2026-11-26: Lincoln at Bankside, 5 Lincoln Ave, Bronx, NY 10454 (Mott Haven), 350 units across 54 floor plans at 2687 to 5667 USD a month. A listing HotPads does not have is a charged 404. ${NO_PII} ${ONE}`,
    {
      url: z.string().min(20).max(400).optional()
        .describe("A HotPads listing link: search_hotpads buildings[].listings[].url or buildings[].url (/pad, /building or /<unit>/pad). Send url or id."),
      id: z.string().min(4).max(300).optional()
        .describe("Or a building id (search_hotpads buildings[].id, get_hotpads_suggestions listings[].id), e.g. skrzz0."),
    },
    post("listing"),
  );

  server.tool(
    "get_hotpads_price_history",
    `The rent history ${NAME} publishes for one listing: listing_alias, model_id, currency, truncated, count, events [{date, type (listedForRent, priceChanged, listingRemoved), price, price_per_sqft, change_pct, currency, source}], notes. Send the listing's price_history.listing_alias and price_history.model_id from get_hotpads_listing (price_history is null there when HotPads publishes none). Captured 2026-11-26: listing alias 5759ydyqtn49h had 22 events, the latest a price change on 2026-11-25 to 2450 USD (down 18.3%). A wrong alias or model id is a charged 404. ${ONE}`,
    {
      listing_alias: alias.describe("Required. The listing's price_history.listing_alias (e.g. 5759ydyqtn49h)."),
      model_id: z.union([z.string().min(1).max(40), z.number().int().nonnegative()])
        .describe("Required. The listing's price_history.model_id (e.g. 738529)."),
    },
    post("price-history"),
  );

  server.tool(
    "get_hotpads_fees",
    `The costs and fees the property manager lists for one ${NAME} listing: listing_alias, currency, move_in_total, monthly_total, base_rent {min, max, text}, move_in_fees and monthly_fees {required, optional [{type, name, amount {min, max, text}, count {min, max}, notes}]}, usage_fees (late fees and others charged when they apply), unit_count, disclaimer, notes. Captured 2026-11-26: listing alias 24ga0pwypzg8y had a base rent of 2680 to 5160 USD, a monthly total of 2686.25 to 5166.25 USD and 33.90 USD due at move-in. An unknown alias is a charged 404. ${ONE}`,
    {
      listing_alias: alias
        .describe("Required. A HotPads listing alias: get_hotpads_listing alias, or search_hotpads buildings[].listings[].alias."),
    },
    post("fees"),
  );

  server.tool(
    "get_hotpads_suggestions",
    `${NAME}'s location suggestions for a text: text, areas [{type (city, neighborhood, borough, county, zip, school), label, resource_id (the area of search_hotpads), region_id, city, county, state}], listings [{id (the id of get_hotpads_listing), label, city, state}], count, notes. US only. Captured 2026-11-26: brooklyn gave 5 suggestions, the first the borough Brooklyn, New York, NY (resource_id brooklyn-new-york-ny). ${ONE}`,
    {
      text: z.string().min(3).max(80)
        .describe("Required. A city, neighborhood, borough, county, ZIP code, school or address (3+ characters, e.g. brooklyn)."),
      limit: z.number().int().min(1).max(10).optional().describe("Suggestions to return, 1-10 (default 6)."),
    },
    post("suggestions"),
  );
}
