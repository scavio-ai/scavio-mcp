import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/apartmentlist.ts (US only, USD, no country). Rules the backend enforces and zod
// here does not: search and market-summary take exactly one of location, city (with state) or zip, and state goes with
// city or zip, never with location; rent-report and review-summaries take city_slug or city with state, not both, and
// city_slug is a city slug such as /tx/austin (not a metro, neighborhood or ZIP code); price_min <= price_max;
// move_in_date is a real calendar date; filters and sort are refused on a neighborhood location (search the
// neighborhood without them, or its city with them); market-summary takes beds and amenities only.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const AMENITIES = [
  "is_pet_friendly", "is_dog_friendly", "is_cat_friendly", "has_pool", "has_gym", "has_in_unit_laundry", "has_on_site_laundry", "has_laundry_connections", "has_garage", "has_parking",
  "has_hardwood_floors", "has_dishwasher", "has_air_conditioning", "has_balcony", "is_accessible", "has_bbq", "has_bathtub", "has_business_center", "has_elevator", "has_doorman",
  "has_walk_in_closet", "has_stainless_steel", "has_granite_counter", "has_garbage_disposal", "has_furnished_option", "has_fireplace", "has_hot_tub", "has_ceiling_fan",
] as const;
const OCCUPANCY_TYPES = ["affordable", "senior", "student", "military", "co-living"] as const;
const SORTS = ["best_match", "freshness", "price_asc", "price_desc"] as const;

const FIRST = "Apartment List (apartmentlist.com, the US rental search site)";
const NAME = "Apartment List";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_PII = "No reviewer names are returned.";
const CARD =
  "id, name, slug, url (the input of get_apartmentlist_listing), address, neighborhood, latitude, longitude, currency, show_price, price_min, price_max, price_by_beds [{beds, price_min, price_max}], bed_range, floor_plans [{id, name, beds, baths, sqft, sqft_max, price, price_max, photo, unit_count, units [{unit_id, name, price, base_price, total_price, required_fees, sqft, availability, available_on, available_now, lease_length_months, updated_at}]}], units_available, soonest_available, has_rent_special, fee_transparent, occupancy_types, amenities {community, unit}, amenities_text, photos, photo_count, highlight {title, text, tag}, unit_highlights [{unit_id, unit, unit_type, price, price_change, is_total_price, available_now, available_on, lease_length_months}], rating, value_rating, review_snippet, standout_category, updated_at";
const SUMMARY =
  "average_rent {studio, one_bedroom, two_bedroom, three_bedroom, pricing_date, trend (up, down or even)}, listings_summary {average_price, median_price, average_sqft, median_sqft, property_count, unit_count, amenity_shares (the share of listings with each amenity), price_histogram [{price, unit_count, property_count}]}";

const beds = z.union([z.number().int().min(0).max(3), z.array(z.number().int().min(0).max(3)).max(4)]);
const amenities = z.array(z.enum(AMENITIES)).max(10);

const place = {
  location: z.string().min(3).max(200).optional()
    .describe("A place slug: places[].slug of get_apartmentlist_suggestions, a city (/tx/austin), a neighborhood (/tx/austin/neighborhoods/riverside) or a ZIP code (/tx/austin/zip-78704). Send one of location, city with state, or zip."),
  city: z.string().min(2).max(80).optional().describe("Or a city name, with state (e.g. Chicago)."),
  state: z.string().length(2).optional().describe("With city: the 2-letter US state code (e.g. IL). Optional with zip; never with location."),
  zip: z.string().regex(/^\d{5}$/).optional().describe("Or a 5-digit US ZIP code (e.g. 78704); it is read under its city (see notes)."),
};
const cityPlace = {
  city_slug: z.string().min(3).max(200).optional()
    .describe("A city slug: places[].slug of a city in get_apartmentlist_suggestions (e.g. /tx/austin). Send city_slug or city with state."),
  city: z.string().min(2).max(80).optional().describe("Or a city name, with state (e.g. Austin)."),
  state: z.string().length(2).optional().describe("With city: the 2-letter US state code (e.g. TX)."),
};

export function registerApartmentlistTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/apartmentlist/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_apartmentlist_suggestions",
    `${FIRST}'s location suggestions for a city, neighborhood, ZIP code, county or state: query, count, places [{id, slug (the location input of search_apartmentlist and get_apartmentlist_market_summary; a city's slug is also the city_slug of get_apartmentlist_rent_report and get_apartmentlist_review_summaries), type (city, neighborhood, zip_code, county, state), name, display_name, long_name, metro_id, county_id, population, coordinates, bounds {ne, sw}, parents {state, metro, city, ...}, searchable (true marks a city, neighborhood or ZIP code)}], notes. Captured 2026-11-26: Austin gave 10 places, the first Austin, TX (slug /tx/austin, population 790390). US only. ${ONE}`,
    {
      query: z.string().min(2).max(80).describe("Required. A city, neighborhood, ZIP code, county or state (e.g. Austin)."),
    },
    post("suggestions"),
  );

  server.tool(
    "search_apartmentlist",
    `Search rentals on ${FIRST} in a city, neighborhood or ZIP code, 20 a page. Without filters or sort the answer is fast and lists every listing in ${NAME}'s map order; with beds, baths, price_min, price_max, move_in_date, amenities, occupancy_types or sort (city or ZIP code only) it reads ${NAME}'s filtered results, which can take up to about 2 minutes. A ZIP code search returns its city's listings inside the ZIP code's bounding box (said in notes). Returns location, zip and city (for a ZIP code), filters, sort, total_listings, total_units, page, page_size, pages, has_more, count, listings [${CARD}], location_summary {location_id, location_name, ${SUMMARY}}, notes. price_min, price_max and floor_plans cover every unit the listing shows, not only the units a filter matched. Captured 2026-11-26: Austin, TX (/tx/austin) gave 2197 listings and 20223 units over 110 pages; 1-bedroom rentals in Chicago up to 2000 USD by lowest price gave 442 listings (854 units) over 23 pages, the first from 660 USD a month; ZIP code 78704 gave 156 listings of the city of Austin. A place ${NAME} does not have is a charged 404. US only, rents in USD a month. ${ONE}`,
    {
      ...place,
      beds: beds.optional().describe("Bedrooms: 0 (studio), 1, 2 or 3 (3 or more), or a list of them (e.g. [1, 2])."),
      baths: z.number().int().min(1).max(3).optional().describe("Bathrooms: 1, 2 or 3 (or more)."),
      price_min: z.number().int().min(0).max(100_000).optional().describe("Lowest monthly rent, USD."),
      price_max: z.number().int().min(0).max(100_000).optional().describe("Highest monthly rent, USD (e.g. 2000)."),
      move_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Move-in date, YYYY-MM-DD."),
      amenities: amenities.optional().describe(`Amenity filters, all must match: ${AMENITIES.join(", ")}.`),
      occupancy_types: z.array(z.enum(OCCUPANCY_TYPES)).max(5).optional().describe(`Occupancy types: ${OCCUPANCY_TYPES.join(", ")}.`),
      sort: z.enum(SORTS).optional()
        .describe("best_match, freshness (newest), price_asc or price_desc. Without sort or filters, listings come in Apartment List's map order."),
      page: z.number().int().min(1).max(250).optional().describe("Page of 20, from 1 (up to 250); pages says how many."),
    },
    post("search"),
  );

  server.tool(
    "get_apartmentlist_listing",
    `One ${NAME} listing in full by link or slug: id, name, slug, url, rental_type, address {street, city, county, state, zip, formatted}, neighborhood, meta_neighborhood, latitude, longitude, description, year_built, year_remodeled, total_units, currency, show_price, price_by_beds [{beds, price_from}], floor_plan_count, available_unit_count, floor_plans (with every unit's price, base_price, total_price and required_fees), specials [{text, type, monthly_price_discount, estimated_value, expires_at, created_at, updated_at}], fees {fee_sheet_url, price_shown_plus_fees, application_fee, deposit, move_in_fees, additional_fees, utilities_included}, pet_policies {allowed, allowed_pets, details, general, cats, dogs}, parking, requirements {income, income_multiplier, evictions_allowed, evictions_policy, credit_check, criminal_check}, lease_terms, occupancy_types, amenities {top, unit, community}, office_hours [{day, opens, closes}], time_zone, website_url, phone (apartment communities only), source, availability_last_checked_at, updated_at, highlight, floor_plan_disclaimers, photos, photo_count, review_summary {rating, amenities_rating, value_rating, rating_count, best_rating, worst_rating, snippet, snippet_rating, snippet_date}, reviews_total, reviews [{date, text, rating, value, amenities, location, management, maintenance, parking, noise}] (where the listing page shows them), notes. Specials and fees are ${NAME}'s text, as given. Captured 2026-11-26: The Asher in Austin, TX 78717 (slug /tx/austin/the-asher), built 2023, 377 units, 32 floor plans and 40 available units, from 1381 USD for 1 bedroom. A listing no longer on ${NAME} is a charged 404. ${NO_PII} ${ONE}`,
    {
      url: z.string().min(20).max(400).optional()
        .describe("The listing link (listings[].url of search_apartmentlist, e.g. https://www.apartmentlist.com/<st>/<city>/<slug>). Send url or slug."),
      slug: z.string().min(5).max(300).optional().describe("Or the listing slug (listings[].slug, e.g. /tx/austin/riata--4)."),
    },
    post("listing"),
  );

  server.tool(
    "get_apartmentlist_rent_report",
    `${NAME}'s monthly rent report for a US city, as ${NAME} publishes it (its own rent estimates): city_slug, location, url, currency, at_a_glance {name, median_rent_1br, median_rent_2br, rent_growth_month, rent_growth_year} (growth as a fraction: -0.0133 is -1.33%), annual_trend {city, state, national} (the cumulative change over the last 12 months, monthly), ytd_growth {year, lines [{year, months [{month, label, growth}]}]} (the change since January of each year), metro_table [{city, slug, median_rent_1br, median_rent_2br, rent_growth_month, rent_growth_year}], top_rent_growth and top_rent_levels [{location_id, name, value}], sections [{name, text}], notes. Captured 2026-11-26: Chicago, IL had a median rent of 1723 USD for 1 bedroom and 1875 USD for 2, -1.12% on the month and +3.37% on the year. A city with no rent report is a charged 404. ${ONE}`,
    cityPlace,
    post("rent-report"),
  );

  server.tool(
    "get_apartmentlist_market_summary",
    `Average rents by bed count and a listings summary on ${NAME} for a city, neighborhood or ZIP code (a ZIP code reads its city), optionally for some bed counts and amenities: location, filters, currency, location_id, location_name, ${SUMMARY}, notes. Captured 2026-11-26: New York City filtered to 2 bedrooms had average rents of 4184 USD for a studio, 5148 for 1 bedroom, 7141 for 2 and 8374 for 3 (pricing date 2026-11-20); the listings summary covered 268 properties and 335 units at a median of 6510 USD. US only. ${ONE}`,
    {
      ...place,
      beds: beds.optional().describe("Bedrooms to summarize: 0 (studio), 1, 2 or 3 (3 or more), or a list of them."),
      amenities: amenities.optional().describe(`Amenity filters, all must match: ${AMENITIES.join(", ")}.`),
    },
    post("market-summary"),
  );

  server.tool(
    "get_apartmentlist_review_summaries",
    `Resident-review summaries on ${NAME} for every listing with reviews in a city, most reviewed first: city_slug, count, review_summaries [{listing_id (listings[].id of search_apartmentlist), rating, amenities_rating, value_rating, rating_count, best_rating, worst_rating, snippet, snippet_rating, snippet_date}], notes. Captured 2026-11-26: Austin, TX (/tx/austin) gave 217 listings with review summaries. ${NO_PII} ${ONE}`,
    cityPlace,
    post("review-summaries"),
  );
}
