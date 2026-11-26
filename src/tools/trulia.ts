import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/trulia.ts (US only, USD, no country). Rules the backend
// enforces and zod here does not: neighborhood takes one of location_id or url; property one of
// zpid, building_id or url; school one of url or school_id, and school_id needs state; search
// location is a ZIP, "City, ST" or "Neighborhood, City, ST"; *_min <= *_max; keyword is letters,
// digits and spaces; pets needs listing_status for_rent; hoa_max is refused on for_rent; language es
// exists only where Trulia publishes Spanish pages (rental searches, buildings, neighborhoods) and
// is refused elsewhere.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const STATUSES = ["for_sale", "for_rent", "sold"] as const;
const SORTS = ["default", "newest", "price_low", "price_high", "sqft", "beds", "baths"] as const;
const PROPERTY_TYPES = ["single_family", "townhouse", "condo", "coop", "apartment", "multi_family"] as const;
const PETS = ["cats", "small_dogs", "large_dogs"] as const;
const SUGGEST_TYPES = ["for_sale", "for_rent"] as const;
const MAX_YEAR = new Date().getUTCFullYear() + 2;

const FIRST = "Trulia (trulia.com, Zillow Group's home and neighborhood site)";
const NAME = "Trulia";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_PII = "No listing-agent names, phones, emails or license numbers and no reviewer names are returned; brokerage company names are.";
const LISTING =
  "id, zpid (the input of get_trulia_property), building_id (rental buildings: also its input), url, status (for_sale, for_rent, sold, rented, off_market), listing_type, price (USD; sold rows read from the sale price Trulia prints), price_min, price_max (rental buildings), price_display, price_note (e.g. Total price) and price_note_details, currency, price_change_direction, address, street_address, city, state, zip_code, community_name, latitude, longitude, beds, beds_min, beds_max, baths, baths_min, baths_max, living_area (sqft), living_area_min, living_area_max, lot_size_display, home_type, tags, date_listed, sold_date, open_houses, brokerage (company), has_3d_tour, has_video, image, images";

const id = z.union([z.string().regex(/^\d{1,12}$/), z.number().int().positive()]);
const year = z.number().int().min(1700).max(MAX_YEAR);

export function registerTruliaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/trulia/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_trulia_neighborhood",
    `One ${FIRST} neighborhood page by location id or link: location_id, region_id, name, city, state, county, zip_code, url, search_urls, what_locals_say {title, minimum_responses, statements [{type, statement, percent}]} (Trulia's 16 "What Locals Say" survey results), safety {minimum_responses, statements}, reviews {total, shown, categories [{id, name, count}], items [{id, text, category, category_name, reviewer_type (Resident, Prev. Resident), date, helpful}]} (Trulia's page shows up to 40 reviews; total and the category counts cover all), facts {homes_for_sale, homes_for_rent, for_sale_price_range, for_rent_price_range, commute {destination, minutes}}, amenities {categories, count, items [{name, category, subcategory, website, latitude, longitude}]}, schools {levels, items [{id, name, url (the input of get_trulia_school), district, type, levels, grades, students, rating (GreatSchools, of 10), parent_rating, review_count, address, reviews [{rating, text, type, date}]}]}, geo {centroid, bounding_box, encoded_polygon, wkt}, nearby_neighborhoods, homes_for_sale {total, listings}, market (default on) {snapshot {scope (neighborhood or city, as Trulia scopes it), area, last_updated, avg_sale_price, sale_to_list_ratio, price_per_sqft, active_listings (each {value, display, mom_change, mom_direction}), market_condition, market_temperature_index, source}, median_sale_price_history {scope, area, last_updated, points [{month, median_sale_price}]}, rental_snapshot, rent_history, read_from}, notes. Survey results, safety statements and market figures are Trulia's, as Trulia gives them; crime data is no longer on Trulia. Captured 2026-11-26: Upper East Side, New York (location_id 85381): 1480 survey responses, 94% say it is walkable to grocery stores, 277 resident reviews (40 shown), 1885 homes for sale, a 22-minute commute to Downtown New York, and a neighborhood market snapshot for October 2026 with an average sale price of $1.47M and a 98.2% sale-to-list ratio. ${NO_PII} ${ONE}`,
    {
      location_id: id.optional()
        .describe("A Trulia neighborhood location id (e.g. 85381): get_trulia_property neighborhood.location_id, or the location_id of a neighborhood in get_trulia_suggestions. Send location_id or url."),
      url: z.string().min(20).max(400).optional()
        .describe("Or the neighborhood's trulia.com link (https://www.trulia.com/n/<st>/<city>/<neighborhood>/<location id>/)."),
      include_market_snapshot: z.boolean().optional()
        .describe("Add market: Trulia's market snapshot and monthly median sale price history, read from a home for sale in the neighborhood (default true; same 1 credit). false answers faster."),
      language: z.enum(["en", "es"]).optional().describe("en (default) or es: Trulia's US Spanish neighborhood page."),
    },
    post("neighborhood"),
  );

  server.tool(
    "search_trulia",
    `Search ${FIRST} for homes for sale, for rent or recently sold in a ZIP code, city or neighborhood: beds_min, baths_min, price, sqft and year-built ranges, hoa_max, property_types, keyword, pets (rentals); 7 sorts; 40 homes a page, up to page 50. Returns listing_status, location {city, state, zip_code, neighborhood, location_id}, url, language, total, page, page_size, total_pages, has_more, sort, applied_filters (the filters Trulia says it applied), neighborhoods [{name, id, count}], count, listings [{${LISTING}}], notes. Captured 2026-11-26: homes for sale in Austin, TX gave 2146 over 54 pages; rentals in Brooklyn, NY 2264; recently sold in Seattle, WA by newest 7547. ${NO_PII} US only, USD. ${ONE}`,
    {
      location: z.string().min(2).max(120)
        .describe('Required. A ZIP code (78701), "City, ST" (Austin, TX) or "Neighborhood, City, ST" (Upper East Side, New York, NY). get_trulia_suggestions returns search_location values.'),
      listing_status: z.enum(STATUSES).optional().describe("for_sale (default), for_rent or sold (recently sold)."),
      beds_min: z.number().int().min(0).max(10).optional().describe("Fewest bedrooms (e.g. 3)."),
      baths_min: z.number().int().min(1).max(10).optional().describe("Fewest bathrooms."),
      price_min: z.number().int().min(0).optional().describe("Lowest price, USD (monthly rent on for_rent)."),
      price_max: z.number().int().min(0).optional().describe("Highest price, USD (monthly rent on for_rent; e.g. 1000000)."),
      sqft_min: z.number().int().min(0).max(1_000_000).optional().describe("Smallest living area, sqft."),
      sqft_max: z.number().int().min(0).max(1_000_000).optional().describe("Largest living area, sqft."),
      year_built_min: year.optional().describe("Earliest year built."),
      year_built_max: year.optional().describe("Latest year built."),
      hoa_max: z.number().int().min(0).max(100_000).optional().describe("Highest monthly HOA fee, USD (for_sale and sold only)."),
      property_types: z.array(z.enum(PROPERTY_TYPES)).max(PROPERTY_TYPES.length).optional()
        .describe(`Any of: ${PROPERTY_TYPES.join(", ")} (e.g. ["single_family", "townhouse"]).`),
      keyword: z.string().min(1).max(40).optional()
        .describe("A listing keyword Trulia filters on (letters, digits, spaces), e.g. pool, hardwood floors."),
      pets: z.array(z.enum(PETS)).max(PETS.length).optional().describe(`Rentals only (listing_status for_rent): ${PETS.join(", ")}.`),
      sort: z.enum(SORTS).optional()
        .describe("default (Trulia's order: newest on for_sale, its own ranking on for_rent, latest sale on sold), newest, price_low, price_high, sqft (largest), beds (most), baths (most)."),
      page: z.number().int().min(1).max(50).optional().describe("Page, from 1 (40 homes a page, up to page 50); has_more says whether another exists."),
      language: z.enum(["en", "es"]).optional().describe("en (default) or es: Trulia's US Spanish pages exist for rental searches (for_rent) only."),
    },
    post("search"),
  );

  server.tool(
    "get_trulia_property",
    `One ${NAME} home (for sale, sold, for rent) by zpid or link, or one rental building by building_id or link: id, zpid, building_id, url, language, name, status, status_label, listing_type, address parts, latitude, longitude, price, price_min, price_max, price_display, price_note, currency, beds, baths, baths_summary, living_area, lot_size_display, home_type, date_listed, tags, insights, description, zestimate and rent_zestimate (Zillow's estimates as Trulia shows them), home_value {current_display, since_last_month, since_last_year, since_last_sale, history}, price_history [{date, event, price, source, details}], last_sold, taxes {assessment, history [{year, tax, assessment}]}, features {highlights, categories [{name, attributes, groups}]}, open_houses, brokerage (company), mls, payment_estimate {monthly_total, principal_and_interest, property_taxes, homeowners_insurance, hoa, down_payment_percent, text} and price_vs_median {percent, direction, median_display, area, text} (read from Trulia's FAQ answers), faqs, market_snapshot and median_sale_price_history (Trulia's neighborhood or city market, with its scope), rental_market_snapshot, rent_history, seller_net_proceeds, neighborhood {location_id (the input of get_trulia_neighborhood), region_id, url, search_url, what_locals_say}, schools_summary, and for buildings floor_plans {groups [{title, beds, plans [{id, name, availability, beds, baths, price_min, price_max, sqft_display, units [{name, availability, available_now, price_display}]}]}]}, fees {monthly_required, one_time_required, monthly_optional, one_time_optional [{name, min, max, amount, amount_text}], disclaimer}, total_monthly_fee_included, pet_policy, special_offers, ideal_income, units {total, available}, plus photo_count, images (up to 50). Captured 2026-11-26: a 1-bed co-op at 345 E 93rd Street #8F, New York (zpid 119917817) for sale at 610000 USD; The Janis rental building in Austin (building_id 2775825120) at $1,524 - $2,310/mo total price, base rent plus 75 USD of required monthly fees. An id Trulia does not have is a charged 404. ${NO_PII} ${ONE}`,
    {
      zpid: id.optional().describe("A home's zpid (the id Trulia shares with Zillow; listings[].zpid, e.g. 339349810). Send one of zpid, building_id or url."),
      building_id: id.optional().describe("Or a rental building's id (listings[].building_id)."),
      url: z.string().min(20).max(400).optional()
        .describe("Or the trulia.com link (https://www.trulia.com/home/<address>-<zpid> or /building/<name>-<id>)."),
      language: z.enum(["en", "es"]).optional().describe("en (default) or es: Spanish is available on building pages only."),
    },
    post("property"),
  );

  server.tool(
    "get_trulia_school",
    `One school on ${NAME} by link, or by school id and state: id, name, url, type, levels, grades, students, district, district_url, address, latitude, longitude, website, greatschools_url, ratings {overall, max, test_scores, equity, academic_progress, college_readiness, student_growth, source (GreatSchools)}, student_teacher_ratio, student_counselor_ratio, certified_teachers_percent, parent_rating, review_count, reviews [{rating, rating_max, text, type, date}] (parent reviews, no names), nearby_schools, assigned_homes {for_sale, for_rent: {total, listings}}, notes. Captured 2026-11-26: Dever Elementary School, Chicago (school_id 279445, IL), public, PK-8, 728 students, GreatSchools overall rating 4 of 10, 12 parent reviews. An unknown school is a charged 404. ${ONE}`,
    {
      url: z.string().min(20).max(400).optional()
        .describe("A Trulia school link (get_trulia_neighborhood schools.items[].url). Send url, or school_id with state."),
      school_id: id.optional()
        .describe("Or the number at the end of the school link (get_trulia_suggestions schools[].school_id, e.g. 279445), with state."),
      state: z.string().length(2).optional().describe("The school's two-letter state code (e.g. IL), with school_id."),
      language: z.literal("en").optional().describe("en only: Trulia's school pages are English."),
    },
    post("school"),
  );

  server.tool(
    "get_trulia_suggestions",
    `${NAME}'s place suggestions for the start of a city, neighborhood, ZIP code, address or school name: query, listing_status, count, places [{title, details, type (city, neighborhood, zipcode, address, ...), city, state, zip_code, location_id (a neighborhood's is the input of get_trulia_neighborhood), region_id, zpid (addresses: the input of get_trulia_property), url, search_location (the location input of search_trulia), latitude, longitude}], schools [{title, subtitle, details, type, school_id, city, state, latitude, longitude}]. Captured 2026-11-26: Austin gave 7 suggestions, the first Austin, TX (search_location "Austin, TX"). ${ONE}`,
    {
      query: z.string().min(2).max(80)
        .describe("Required. The start of a city, neighborhood, ZIP code, address or school name (e.g. Austin)."),
      listing_status: z.enum(SUGGEST_TYPES).optional().describe("for_sale (default) or for_rent: Trulia's suggestions for that kind of search."),
      include_schools: z.boolean().optional().describe("Add matching schools and districts (default true)."),
      language: z.literal("en").optional().describe("en only: Trulia's suggestions are English."),
    },
    post("suggestions"),
  );
}
