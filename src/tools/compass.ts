import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/compass.ts (US only, USD, English). Rules the backend enforces and zod here does
// not: area is a Compass area slug from suggestions or a place written as "City, ST"; open_house and coming_soon
// apply to mode for_sale only and are not sent together; price_min, beds_max, year built and lot size filters are
// refused with a 400 (Compass does not apply them), so they are not offered here; listing takes exactly one of url or
// id. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const MODES = ["for_sale", "for_rent", "sold"] as const;
const SORTS = ["default", "price_asc", "price_desc"] as const;
const PROPERTY_TYPES = ["homes", "condos", "townhomes", "co_ops", "multi_family", "land"] as const;

const FIRST = "Compass (compass.com, the US real estate brokerage)";
const NAME = "Compass";
const TWO = "Costs 2 credits (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_PII = "No agent names, emails, phones, license numbers or photos are returned; the listing brand (Compass, Corcoran, Coldwell Banker, Sotheby's International Realty) is.";
const CARD =
  "id (the input of get_compass_listing), url, property_url, address, neighborhood, city, state, zip, latitude, longitude, price (USD; rent per month on for_rent), price_text, price_period, currency, beds, baths, baths_detail, sqft, lot_size, property_types, status (active, pending, sold, coming_soon), status_code, sold_date, brand, badges, open_houses [{start, end, by_appointment_only, virtual}], photo, thumbnail";

export function registerCompassTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/compass/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_compass",
    `Search homes for sale, rentals or homes sold in the last 90 days in a US area on ${FIRST}. Filters: highest price, fewest bedrooms, bathrooms and square feet, property type, open house this weekend, coming soon; sorts: default, price_asc, price_desc; 41 a page, up to 9 pages. Compass does not apply a minimum price or a maximum bedroom count next to other filters, nor year built or lot size, so those are not offered. Returns mode, area {slug, location_id}, sort, page, per_page, total (Compass's count), reachable (at most 369: Compass pages through the first 369 results), pages, has_more, count, criteria (the filters as Compass applied them), listings [{${CARD}}], nearby_areas [{name, slug}], notes. A page past the end answers with no listings and a note. Days on market, the MLS number and the source MLS are on get_compass_listing. Captured 2026-11-26: homes for sale in manhattan-ny up to 2000000 USD with 2 or more bedrooms gave 1219 (369 reachable over 9 pages); rentals in los-angeles-ca up to 4000 USD a month with 1 or more bedrooms 2550; single-family homes sold in austin-tx in the last 90 days 1857. An unknown area is a charged 404. ${NO_PII} ${TWO}`,
    {
      area: z.string().min(2).max(160)
        .describe('Required. A Compass area slug from get_compass_suggestions (areas[].slug): a city (austin-tx, manhattan-ny), a city and ZIP (los-angeles-ca-90012), a neighborhood (brooklyn-heights-brooklyn-ny), a county or a school (school/<slug>, school-district/<slug>). A place written as "Austin, TX" reads as its slug.'),
      mode: z.enum(MODES).optional().describe("for_sale (default), for_rent, or sold (homes sold in the last 90 days)."),
      price_max: z.number().int().min(1).max(1_000_000_000).optional()
        .describe("Highest price, USD (on for_rent the monthly rent; e.g. 900000)."),
      beds_min: z.number().int().min(1).max(10).optional().describe("Fewest bedrooms."),
      baths_min: z.number().int().min(1).max(10).optional().describe("Fewest bathrooms."),
      sqft_min: z.number().int().min(1).max(100_000).optional().describe("Smallest size in square feet."),
      property_type: z.enum(PROPERTY_TYPES).optional()
        .describe(`One of ${PROPERTY_TYPES.join(", ")} (homes = single family).`),
      open_house: z.boolean().optional().describe("Mode for_sale: only homes with an open house this weekend."),
      coming_soon: z.boolean().optional().describe("Mode for_sale: only Coming Soon listings."),
      sort: z.enum(SORTS).optional().describe("default (Compass's own order), price_asc or price_desc."),
      page: z.number().int().min(1).max(9).optional()
        .describe("Page, from 1 (41 listings a page). Compass pages through the first 369 results of a search (9 pages)."),
    },
    post("search"),
  );

  server.tool(
    "get_compass_listing",
    `One ${NAME} listing in full (for sale, coming soon, sold or for rent) by link or id: id, url, property_url, property_code, mls_number, listing_type (sale or rent), status, mls_status, address {street, city, state, zip, neighborhood, county, full}, latitude, longitude, timezone, beds, baths, full_baths, half_baths, total_baths, rooms, sqft, lot_sqft, lot_size, stories, property_types, mls_property_type, description (phone numbers and emails taken out), pricing {price, price_text, price_period, currency, listed_price, last_asking_price, sold_price, sold_price_verification, price_per_sqft, monthly_charges, monthly_charges_incl_taxes, max_financing_percent, min_down_payment_percent, last_property_sale_price}, dates {listed, contract, sold, available, updated, last_property_sale}, days_on_market, cumulative_days_on_market, history [{date, event (Listed, Price Change, Contract Signed, Sold, Sold (Public Record), Expired, ...), price, source, public_record, record_url}], key_details, regional_details, details [{category, sections [{name, fields [{key, values}]}]}], amenities, schools [{name, distance_miles, types, grades, rating, url}], school_districts, building {id, name, address, floors, units, year_built, url, key_details}, rental {lease_term, lease_term_min_months, lease_term_max_months, broker_fee_percent}, tax {tax_year, tax, monthly_tax, assessment_year, land_value, improvement_value}, parcel_number, badges, photos, photo_count, brand, source_mls (the MLS the listing comes from), disclaimer and mls_disclaimer (as Compass shows them with the listing). Captured 2026-11-26: 77 Bleecker Street, Unit 121, Manhattan, NY 10012 (Greenwich Village), a 2-bed, 2-bath home for sale at 1875000 USD, 24 days on market, 16 photos, brand Compass. An unknown listing is a charged 404. ${NO_PII} ${TWO}`,
    {
      url: z.string().min(5).max(400).optional()
        .describe("A Compass listing link (search_compass listings[].url or property_url: /homedetails/<address>/<id>_lid/ or /<code>_pid/; get_compass_suggestions /listing/<id>/view links work too). Send url or id."),
      id: z.union([z.string().regex(/^\d{6,25}$/), z.number().int().positive()]).optional()
        .describe("Or a Compass listing id (listings[].id), as a string (e.g. 2244607538793554409)."),
    },
    post("listing"),
  );

  server.tool(
    "get_compass_suggestions",
    `The ${NAME} search box suggestions for a place, ZIP code, school or address: q, count, areas [{name, region, slug (the area input of search_compass), kind (city, zip, neighborhood, school, school_district or area), location_id, url}], listings [{id (the id input of get_compass_listing), address, region, url}]. Agent suggestions are left out. Captured 2026-11-26: "Austin, TX" gave 10 suggestions, the first the city of Austin, TX (slug austin-tx). ${TWO}`,
    {
      q: z.string().min(2).max(80).describe('Required. A city, neighborhood, ZIP code, school or address (e.g. "Austin, TX").'),
    },
    post("suggestions"),
  );
}
