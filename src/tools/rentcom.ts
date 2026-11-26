import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/rentcom.ts (US only, USD, no country). Rules the backend
// enforces and zod here does not: search takes city and state (optionally with neighborhood) or zip,
// never both; cheap and luxury are not combined; price_min <= price_max; sqft_min is one of the
// listed steps; amenities are names from the list below (at most 8); site apartmentguide takes only
// city and state (with one beds value) or zip, and page (every other filter is site rent);
// listing takes one of id or url, building one of building_id or url (a building id is refused on
// listing); site must match the url's host. building, rent-trends and cities read Rent.com only.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITES = ["rent", "apartmentguide"] as const;
const PROPERTY_TYPES = ["apartments", "houses", "condos", "townhouses", "rooms"] as const;
const SORTS = ["best_match", "price_low", "price_high", "beds", "sqft", "latest"] as const;
const PETS = ["pet_friendly", "dogs", "cats", "no_pets"] as const;
const SQFT = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600] as const;
const AMENITIES = [
  "air-conditioning", "assisted-living", "att-fiber", "available-now", "cable-ready", "college", "controlled-limited-access", "corporate-billing-available",
  "disability-access", "dishwasher", "elevator", "ev-charging", "extra-storage", "fitness-center", "furnished", "garage", "gated-access", "hardwood-floor",
  "best", "high-speed-internet-access", "income-restricted", "independent-living", "laundry-facility", "loft", "military", "new-construction", "remodeled",
  "no-credit-check", "onsite-personnel", "oversized-closets", "patio", "pool", "new", "senior-living", "short-term-available", "virtual-tours",
  "utilities-included", "view", "washer-dryer-connections", "washer-dryer-in-unit", "waterfront",
] as const;

const FIRST = "Rent.com (rent.com) and Apartment Guide (apartmentguide.com, the same rentals), the US rental listing sites run by Redfin";
const NAME = "Rent.com";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_CONTACT = "No phone number, email or agent / landlord name is returned; management_company is given only for listings a property manager pays to list.";
const CARD =
  "id (the input of get_rentcom_listing; ids of kind building are the input of get_rentcom_building), kind (listing or building), name, address, address_full, city, state, state_code, zip, latitude, longitude, property_type, price (lowest listed rent, USD a month), price_text, rent_min, rent_max, beds_min, beds_max, baths_min, baths_max, sqft_min, sqft_max, bed_text, bath_text, sqft_text, rent_by_beds [{beds, rent_min, rent_max, sqft_min, sqft_max}], units_available_text, availability, deals_text, deals [{category, description, expires}], special_terms, has_price_drops, price_drops (USD amounts), pet_friendly, amenities_highlighted, highlights, image, url, management_company, verified, private_listing, updated_at";

const site = z.enum(SITES).optional()
  .describe("rent (www.rent.com, default, 30 listings a page) or apartmentguide (www.apartmentguide.com, the same rentals, 50 a page).");
const rentSite = z.literal("rent").optional()
  .describe("rent (the default). This tool reads Rent.com's page; Apartment Guide lists the same rentals.");
const state = z.string().min(2).max(40).describe("Required. A US state: 2-letter code (TX) or name (Texas).");
const city = z.string().min(1).max(80)
  .describe("Required. A city name (Austin, New York, St. Louis) or its slug (new-york; get_rentcom_cities lists them).");
const bedValue = z.union([z.number().int().min(0).max(4), z.literal("studio")]);

export function registerRentcomTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/rentcom/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_rentcom",
    `Search rentals on ${FIRST}: by city and state, ZIP or neighborhood; property type (apartments, houses, condos, townhouses, rooms), beds, baths, monthly rent range, minimum square feet, pets, cheap / luxury, rent specials and up to 8 amenities; sorted 6 ways; 30 a page on rent.com, 50 on Apartment Guide. Apartment Guide takes city and state (with one beds value) or zip, and page, as its links do; send site rent for the other filters (the same rentals). Returns query (the inputs as read), site, location {name, type, city, state, state_code, zip, neighborhood, latitude, longitude}, total, available_units, page, page_size, pages, has_more, count, average_rent {studio, one_bedroom, two_bedroom: {average_rent, yoy_change_pct, yoy_change_text}}, listings [{${CARD}}], notes. Captured 2026-11-26: 2-bed apartments in Austin, TX by lowest price gave 1819 listings (20380 available units) over 61 pages, the first Karnes House in West Campus from 624 USD a month; on Apartment Guide, 1-bed apartments in Los Angeles, CA gave 3955 listings, 50 a page. A page past the last one is an empty page with a note (charged); an unknown city, ZIP or neighborhood is a charged 404. ${NO_CONTACT} US only, USD. ${ONE}`,
    {
      site,
      city: z.string().min(1).max(80).optional()
        .describe("With state: a city name (Austin, New York, St. Louis) or its slug (new-york; get_rentcom_cities lists them). Send city and state, or zip."),
      state: z.string().min(2).max(40).optional().describe("With city: a US state, 2-letter code (TX) or name (Texas)."),
      neighborhood: z.string().min(2).max(80).optional()
        .describe("With city and state (site rent): a neighborhood by name or slug (e.g. Downtown Manhattan, downtown-manhattan)."),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("Or a 5-digit US ZIP code (e.g. 78704), instead of city and state."),
      property_type: z.enum(PROPERTY_TYPES).optional()
        .describe("apartments (default), houses, condos, townhouses or rooms (rooms for rent). Site rent."),
      beds: z.union([bedValue, z.array(bedValue).min(1).max(5)]).optional()
        .describe("Bedrooms: studio or 0-4 (4 = 4 or more), or a list (site rent; apartmentguide takes one value with city and state). Listings with at least one matching floor plan."),
      baths: z.number().int().min(1).max(4).optional().describe("Bathrooms, 1-4 (4 = 4 or more). Site rent."),
      price_min: z.number().int().min(0).max(100_000).optional().describe("Lowest monthly rent, USD. Site rent."),
      price_max: z.number().int().min(1).max(100_000).optional().describe("Highest monthly rent, USD (e.g. 3000). Site rent."),
      sqft_min: z.number().int().optional().describe(`Smallest square feet, one of ${SQFT.join(", ")}. Site rent.`),
      pets: z.enum(PETS).optional().describe("pet_friendly, dogs, cats or no_pets. Site rent."),
      cheap: z.boolean().optional().describe("The site's cheap apartments filter (not with luxury). Site rent."),
      luxury: z.boolean().optional().describe("The site's luxury filter (not with cheap). Site rent."),
      deals: z.boolean().optional().describe("Only listings with rent specials. Site rent."),
      amenities: z.array(z.string().min(2).max(40)).max(8).optional()
        .describe(`Up to 8 amenities (e.g. pool, washer-dryer-in-unit): ${AMENITIES.join(", ")}. Site rent.`),
      sort: z.enum(SORTS).optional()
        .describe("best_match (default), price_low, price_high, beds (fewest first), sqft (smallest first) or latest (latest update). Site rent."),
      page: z.number().int().min(1).max(1000).optional().describe("Page, from 1; pages and has_more say how deep the results go."),
    },
    post("search"),
  );

  server.tool(
    "get_rentcom_listing",
    `One rental on ${NAME} or Apartment Guide in full by id or link: site, id, name, url, description, address, city, state, state_code, zip, neighborhoods, latitude, longitude, property_type, room_for_rent, total_units, units_available, price, price_text, rent_min, rent_max, beds / baths / sqft ranges, floor_plans [{id, name, beds, baths, half_baths, sqft, sqft_min, sqft_max, rent_min, rent_max, rent_text, available_count, availability_text, available_date, deposit, amenities, image, units [{unit_id, rent, rent_text, sqft, available_date, available, deposit, floor}]}], fees {admin_fee, application_fee, broker_fee, amenity_fee, utilities_included, utilities_notes, tenant_paid_utilities, insurance, sales_tax}, pet_policies [{type, label, comment, initial_fee, additional_rent, deposit, max_pets, weight_limit}], pet_friendly, parking [{type, assigned, assigned_fee, per_space_fee, total_spaces, comments}], amenities [{name, subcategory, category}], amenities_highlighted, highlights, office_hours [{day, hours [{open, close}]}], deals_text, deals, special_terms, has_price_drops, price_drops, price_drop_overall, lease_terms, income_restrictions, schools [{name, type, grades, rating, district, distance_miles, address}], nearby [{category, total, places [{name, type, distance_miles}]}], walk_score {walk, bike, transit with descriptions}, vibes, photos, management_company, verified, private_listing, updated_at, similar [{id, name, address_full, price_text, rent_min, rent_max, bed_text, url}], similar_ids, notes. Fields the site leaves empty are null or []. Captured 2026-11-26: Karnes House (lc5916981), 2222 Rio Grande St, Austin, 2-bed floor plans from 624 USD a month, walk score 95. An id the site does not have (or a listing taken down) is a charged 404. ${NO_CONTACT} ${ONE}`,
    {
      site,
      id: z.union([z.string().min(4).max(20), z.number().int().positive()]).optional()
        .describe("A listing id (listings[].id from search_rentcom: lc5898701, 206824305, lv3119690811). Apartment Guide's 5898701 and Rent.com's lc5898701 are the same listing; either works on either site. Send id or url."),
      url: z.string().min(20).max(400).optional()
        .describe("Or the listing's link on rent.com or apartmentguide.com (its host sets the site)."),
    },
    post("listing"),
  );

  server.tool(
    "get_rentcom_building",
    `One building on ${NAME} (the separate unit listings at one address) by building id or link: id, url, address, address_full, city, state, state_code, zip, neighborhoods, latitude, longitude, price_text, bed_text, bath_text, sqft_text, rent_min, rent_max, photos, count, listings [{${CARD}}], schools, notes. Captured 2026-11-26: building b147857, 8616 60th Ave, Elmhurst, NY, one 1-bed unit at 1188 USD a month. An unknown building is a charged 404. ${NO_CONTACT} ${ONE}`,
    {
      site: rentSite,
      building_id: z.union([z.string().min(2).max(20), z.number().int().positive()]).optional()
        .describe("A building id (listings[].id where kind is building, e.g. b147857). Send building_id or url."),
      url: z.string().min(20).max(400).optional()
        .describe("Or the building's rent.com link (https://www.rent.com/building/<address>-b<id>)."),
    },
    post("building"),
  );

  server.tool(
    "get_rentcom_rent_trends",
    `${NAME}'s rent trends for one city: location, current {studio, one_bedroom, two_bedroom, three_bedroom: {average_rent, yoy_change_pct, yoy_change_text}} (Rent.com's current averages, USD a month, and year-on-year change), listing_count, series {studio, one_bedroom, two_bedroom, three_bedroom: [{month, label, average_rent}]} (the monthly series as Rent.com publishes it on the page; series_range {from, to, points} says which months it covers, and it can end well before today), rent_distribution [{min, max, count, percent}], nearby_cities and nearby_neighborhoods [{name, url, listing_count, averages}], url, notes. Captured 2026-11-26: Los Angeles, CA had 3275 listings, a studio average of 1375 USD a month, and a series from 2024-04 to 2025-05 (13 months). A bed count with too few listings has a null average. An unknown city is a charged 404. ${ONE}`,
    {
      site: rentSite,
      city,
      state,
    },
    post("rent-trends"),
  );

  server.tool(
    "get_rentcom_suggestions",
    `The search-box suggestions of ${NAME} or Apartment Guide for the start of a place or property name: query, site, count, places [{name, type (city, zip, neighborhood, school, ...), id, path, url}], listings [{id (the input of get_rentcom_listing), name, address, address_full, city, state_code, property_type, url}], notes. Captured 2026-11-26: Austin gave 20 suggestions, the first Austin, TX. ${ONE}`,
    {
      site,
      query: z.string().min(2).max(80)
        .describe("Required. The start of a city, ZIP, neighborhood, school or property name (e.g. Austin)."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_rentcom_cities",
    `The cities ${NAME} links from a state page, A to Z (a smaller town can be missing and still have a search page): state, state_code, count, cities [{name, city (the city input of search_rentcom and get_rentcom_rent_trends), url}], notes. Captured 2026-11-26: Texas listed 600 cities. ${ONE}`,
    {
      site: rentSite,
      state,
    },
    post("cities"),
  );
}
