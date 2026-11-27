import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/uhaul.ts (U-Haul, uhaul.com, US and Canada; English, Spanish es.uhaul.com, French
// fr.uhaul.com). Rules the backend enforces and zod here does not: location and storage_facility take an id or a
// uhaul.com link (an id and a link must agree, and so must language and the link's site); reviews take location_id or
// url; supplies take category or url, not both; the quote date must be today or later and within 330 days, and dropoff
// must differ from pickup. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE = "U-Haul (uhaul.com, the US and Canada truck rental and self-storage company)";
const ONE = "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const MARKET = "The market (US: USD and miles, or Canada: CAD and km) follows the place.";

const LANGUAGES = ["en", "es", "fr"] as const;
const SERVICES = ["truck_rentals", "trailer_rentals", "moving_supplies", "self_storage"] as const;
const STORAGE_SORTS = ["distance", "price", "rating"] as const;
const STORAGE_FEATURES = ["climate_control", "indoor", "drive_up", "portable", "rent_now_online", "vehicle"] as const;
const REVIEW_SORTS = ["newest", "highest", "lowest"] as const;
const REVIEW_SERVICES = ["all", "trucks", "storage", "ubox"] as const;

const language = z.enum(LANGUAGES).optional()
  .describe("en (default, www.uhaul.com), es (es.uhaul.com, U-Haul's Spanish site) or fr (fr.uhaul.com, U-Haul's French site). The market follows the place.");
const place = z.string().min(2).max(80);
const entityId = z.string().regex(/^\d{5,7}$/);
const link = z.string().min(20).max(400);

export function registerUhaulTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/uhaul/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_uhaul_truck_quote",
    `${SITE} truck rental rates for one move, read from U-Haul's public quote form: pickup and optional drop-off (leave dropoff out for an in-town quote) and a pickup day, US or Canada, in English, Spanish or French. Returns language, country, currency, distance_unit, move_type (one_way or in_town), pickup {query, city, state}, dropoff, date, includes {days, distance, distance_unit, text} (one-way: the days and distance the rate includes), allowed_miles (U-Haul's own figure in miles), ubox_from, count, available_count, trucks [model_code, name, moving_type, available, availability_text, inventory_note (U-Haul's own text, e.g. Limited Availability), rate, rate_with_fees (Canada: the price with fees as U-Haul shows it), rate_kind (one_way_total or in_town_base), per_distance_rate, per_distance_unit, per_distance_text, inside_dimensions, specs], truck_with_labor {model_code, truck_rate, truck_rate_with_fees, labor_from, labor_text, estimated_total_from} (U-Haul's truck + moving labor estimate, starting prices as given), notes. One-way rates are U-Haul's total for the truck on that route and date; in-town rates are a base rate plus the per-mile or per-km rate. This is a price quote, never a reservation: nothing is reserved, and no pickup location is returned (U-Haul picks it in its reservation step, after a truck is chosen). Trailer, towing and U-Box quotes are not covered. ${MARKET} Captured 2026-11-27: Dallas, TX to Austin, TX on 2026-12-11 included 2 days and 229 miles, 4 of 6 trucks available, the 10' Truck at 212 USD and the 26' Truck at 335 USD; an in-town Chicago quote listed the 8' Pickup Truck at 19.95 USD plus 1.59 USD a mile; Montreal, QC to Quebec City, QC on fr.uhaul.com included 2 days and 306 km, the 10-foot truck at 395 CAD. Takes about 25 s: allow a client timeout of at least 120 s. A move U-Haul will not quote is a charged not-found with U-Haul's own message. ${ONE}`,
    {
      pickup: place
        .describe("Pickup: a city with its state or province (Dallas, TX; Toronto, ON), a US ZIP or a Canadian postal code. get_uhaul_suggestions returns valid values."),
      dropoff: place.optional()
        .describe("Drop-off for a one-way move (e.g. 'Austin, TX'). Leave it out for an in-town quote (return to the same area). Must differ from pickup."),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Pickup day, YYYY-MM-DD: today or later, up to 330 days ahead (U-Haul quotes up to 11 months out)."),
      language,
    },
    post("truck-quote"),
  );

  server.tool(
    "search_uhaul_locations",
    `${SITE} locations near a city, ZIP or postal code, for truck rentals, trailer rentals, moving supplies or self-storage: language, near, service, country, distance_unit, heading, layout (paged: 6 a page; single: every nearby location on page 1, no phone numbers, hours by day), page, per_page, has_more, count, locations [rank, location_id (what get_uhaul_location and get_uhaul_reviews take), name, location_type (U-Haul's own label, e.g. U-Haul Neighborhood Dealer; none means a U-Haul company location), url, address {street, city, state, postal_code, country}, phone (paged layout), rating, review_count, distance, distance_text, open_today, hours [{days, hours}], special_hours [{date, hours}], services, flags (e.g. 24 hour customer return), latitude, longitude], notes. Dealer and center contact is the business's public contact. For storage starting rates and features use search_uhaul_storage. ${MARKET} Captured 2026-11-27: truck rentals near 75201 listed 6 locations on page 1 with more pages, the nearest 1.0 miles away. A place U-Haul cannot find is a charged not-found. ${ONE}`,
    {
      near: place
        .describe("A city with its state or province (Dallas, TX), a ZIP or a postal code (M5V 2T6)."),
      service: z.enum(SERVICES).optional()
        .describe("truck_rentals (default), trailer_rentals, moving_supplies or self_storage."),
      page: z.number().int().min(1).max(50).optional()
        .describe("Page from 1 (1 to 50; 6 locations a page where U-Haul pages, some places list every location on page 1). Defaults to 1."),
      language,
    },
    post("locations"),
  );

  server.tool(
    "get_uhaul_location",
    `One ${SITE} location by id or link: language, country, currency, location_id, name, url, address {street, city, state, postal_code, country}, latitude, longitude, phone, hours, payment_accepted, rating, review_count, image, rate_card (Canadian locations: per truck the weekday (Sun-Thur) and weekend (Fri-Sat) day rates and per-km rates, and the daily / weekly / monthly plans with the kilometers included, in CAD, with price_valid_until), listed_from_prices (US dealers: the 'from' prices the page lists, which are not quotes; use get_uhaul_truck_quote for a move's price), notes. Phone and address are the location's public business contact. Captured 2026-11-27: location 741028 in Dallas, TX rated 4 from 10582 reviews; location 848027 in Toronto, ON listed the Pickup Truck at 19.95 CAD a weekday day plus 0.99 CAD a km. An unknown id is a charged not-found. ${ONE}`,
    {
      location_id: entityId.optional()
        .describe("A U-Haul location id, 5-7 digits as the site writes them (locations[].location_id), e.g. '741028'. Send location_id or url."),
      url: link.optional()
        .describe("Or the location link (locations[].url), e.g. https://www.uhaul.com/Locations/Truck-Rentals-near-Dallas-TX-75206/741028/."),
      language,
    },
    post("location"),
  );

  server.tool(
    "search_uhaul_storage",
    `${SITE} self-storage facilities near a city, ZIP or postal code: up to 18 facilities (U-Haul lists them on one page), sorted by distance, starting rate or rating and filtered by features: language, near, country, currency, distance_unit, sort, features, listed (what U-Haul listed), count (what matched), facilities [rank (U-Haul's own order, by distance), facility_id (what get_uhaul_storage_facility takes), name, url, affiliate (a U-Haul Self-Storage Affiliate), address, distance, distance_text, starting_rate (the card's monthly Starting at rate), rating, review_count, price_lock (U-Haul's 1-Year Price Lock badge), features (as given), feature_keys, office_hours_today, access_hours_today, special_hours], notes. ${MARKET} Captured 2026-11-27: near Phoenix, AZ 85004 sorted by price, 18 facilities listed, the lowest starting rate 50 USD a month 7.9 miles away; climate control plus Rent Now online matched 12 of 18. A place U-Haul cannot find is a charged not-found. ${ONE}`,
    {
      near: place
        .describe("A city with its state or province (Phoenix, AZ), a ZIP or a postal code."),
      sort: z.enum(STORAGE_SORTS).optional()
        .describe("distance (default), price (starting rate, low to high) or rating (high to low)."),
      features: z.array(z.enum(STORAGE_FEATURES)).max(6).optional()
        .describe("Facilities with every one of these features: climate_control (Climate Control), indoor (Indoor Storage), drive_up (Outdoor/Drive Up), portable (Portable Storage), rent_now_online (Online Move-In/Rent Now), vehicle (RV/Boat/Vehicle Storage)."),
      language,
    },
    post("storage-search"),
  );

  server.tool(
    "get_uhaul_storage_facility",
    `One ${SITE} self-storage facility in full by id or link: language, country, currency, facility_id, name, url, affiliate, address, latitude, longitude, phone, rating, review_count, units_count, vacant_units_total, units [unit_id, section, size_class, dimensions, width_ft, length_ft, use, attributes, monthly_rate (U-Haul's one monthly rate per unit as the page shows it), rent_now (offered for online move-in), reserve_only, vacant_units (the vacant count U-Haul's page carries), reserve_from, reserve_until, free_lock_with_rent_now], sections, promotions [{name, text}] (as given, can change between visits), office_hours, access_hours, special_hours, features, amenities, notes. Phone and address are the facility's public business contact. Captured 2026-11-27: facility 741065 in Dallas, TX listed 43 unit types with 139 vacant units, a 5' x 5' indoor unit at 64.95 USD a month. An unknown id is a charged not-found. ${ONE}`,
    {
      facility_id: entityId.optional()
        .describe("A U-Haul storage facility id, 5-7 digits (facilities[].facility_id), e.g. '741065'. Send facility_id or url."),
      url: link.optional()
        .describe("Or the facility link (facilities[].url), e.g. https://www.uhaul.com/Locations/Self-Storage-near-Dallas-TX-75231/741065/."),
      language,
    },
    post("storage-facility"),
  );

  server.tool(
    "get_uhaul_reviews",
    `U-Haul's own customer reviews of one ${SITE} location or storage facility: every text review its page shows, filtered by service and stars, sorted and paged: location_id, location_name, overall_rating, counts {all, trucks, storage, ubox}, service, stars, sort, total, page, page_size, pages, has_more, count, reviews [{rating, date, review_type (U-Haul's own label: FirstImpressions, OverallExperience, Unknown), service (trucks, storage, ubox), text}], notes. No reviewer name is returned. Captured 2026-11-27: location 741028 in Dallas, TX had 178 reviews (100 trucks, 78 storage), overall 4. An unknown id is a charged not-found. ${ONE}`,
    {
      location_id: entityId.optional()
        .describe("A U-Haul location or storage facility id, 5-7 digits, e.g. '741028'. Send location_id or url."),
      url: link.optional()
        .describe("Or the location link."),
      page: z.number().int().min(1).max(200).optional()
        .describe("Page from 1 (1 to 200). Defaults to 1."),
      page_size: z.number().int().min(1).max(100).optional()
        .describe("Reviews per page, 1-100. Defaults to 20."),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("newest (default), highest or lowest rating."),
      stars: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this many stars (1-5)."),
      service: z.enum(REVIEW_SERVICES).optional()
        .describe("all (default), trucks, storage or ubox."),
    },
    post("reviews"),
  );

  server.tool(
    "get_uhaul_suggestions",
    `U-Haul's own place suggestions for the start of a city, ZIP or postal code (US and Canada) on ${SITE}: term, count, suggestions [{label, value, kind (place or postal_code)}], notes. value is the input for pickup and dropoff (get_uhaul_truck_quote) and near (search_uhaul_locations, search_uhaul_storage). Captured 2026-11-27: 'dall' gave 15 suggestions, the first Dallas, TX. ${ONE}`,
    {
      term: z.string().min(2).max(60)
        .describe("The start of a city, a ZIP or a postal code, e.g. 'dall'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_uhaul_supplies",
    `${SITE} moving supplies prices, US (USD) or Canada (CAD, U-Haul's own CAD prices), by category or product link. A category returns country, currency, kind (category), category, name, count, products [product_id, name, url, price, price_text, as_low_as (the price is U-Haul's As low as bundle price per item, not the single-item price), pickup_only, free_in_store_pickup, next_day_delivery]; a product link returns country, currency, kind (product), product_id, name, url, category, description, brand, image, sku, price (single item), as_low_as_price, bundle {quantity, price, unit_price, text}, availability, rating, review_count, dimensions, sizes, notes. Supplies pages are in English. Captured 2026-11-27: Boxes listed 47 products, the Medium Moving Box as low as 1.99 USD (3.21 CAD in Canada); in Canada it was 3.46 CAD single or a bundle of 20 for 64.20 CAD. An unknown category or product is a charged not-found. ${ONE}`,
    {
      country: z.enum(["us", "ca"]).optional()
        .describe("us (default, USD) or ca (U-Haul's CAD prices)."),
      category: z.string().min(2).max(150).optional()
        .describe("A moving supplies category as U-Haul's link writes it: Boxes, Packing-Supplies, Tape, Boxes/Standard-Sized-Moving-Boxes. Send category or url, not both."),
      url: link.optional()
        .describe("Or a www.uhaul.com moving supplies category or product link (products[].url), e.g. https://www.uhaul.com/MovingSupplies/Boxes/Standard-Sized-Moving-Boxes/Medium-Moving-Box/?id=2793."),
    },
    post("supplies"),
  );
}
