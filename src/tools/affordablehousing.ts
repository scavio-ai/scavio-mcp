import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/affordablehousing.ts (US only, USD, English). Rules the backend enforces and zod
// here does not: state is a US state code or name; search takes city (optionally with zip) or county, not both, and
// a zip needs its city and state (AffordableHousing.com searches a ZIP code within its city); price_min <= price_max;
// listing takes exactly one of url or id; housing-authority takes url, or id with state, not both; url inputs must be
// affordablehousing.com links of the right kind.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const PROPERTY_TYPES = ["apartment", "condo", "townhouse", "house"] as const;
const SORTS = ["default", "price_asc", "price_desc", "newest", "beds_asc", "beds_desc", "sqft_asc", "sqft_desc", "affordability"] as const;
const ACCESSIBILITY = ["physical", "visual_hearing"] as const;

const FIRST = "AffordableHousing.com (affordablehousing.com, the US affordable and Section 8 rental site run by Affordable Housing Network)";
const NAME = "AffordableHousing.com";
const BILL = "credits_used is what was charged. Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const ONE = `Costs 1 credit. ${BILL}`;
const TWO = `Costs 2 credits. ${BILL}`;
const NO_PII = "Private landlords are never named and their contact details are never returned; phone numbers and email addresses are cut out of listing text.";
const CARD =
  "id (the input of get_affordablehousing_listing), title, address, unit, city, county, state, zip, latitude, longitude, property_type, rent_min, rent_max, currency, beds_min, beds_max, baths_min, baths_max, sqft_min, sqft_max, year_built, unit_count, section8_accepted, trusted_owner, income_restricted, government_listing, special_offer, room_for_rent, tier (premium, spotlight or standard), availability, is_new, just_updated, url, photo, photo_count";

const state = z.string().min(2).max(40);
const oneOrMany = <T extends z.ZodTypeAny>(t: T) => z.union([t, z.array(t).max(10)]);

export function registerAffordablehousingTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/affordablehousing/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_affordablehousing",
    `Search affordable and Section 8 rentals on ${FIRST} in a state, city, county or ZIP code (with its city), with beds, baths, property type, rent range, pet friendly, Section 8, utilities included, age restricted and accessibility filters, sorted 9 ways, 42 a page. Returns state, city, county, zip, currency, filters, sort, title, total, page, page_size, pages, has_more, count, listings [${CARD}], notes. Premium and spotlight listings are placed first by ${NAME}; the sort applies within each tier. section8_accepted is the listing's badge for an owner with experience with the Section 8 / Housing Choice Voucher program. Captured 2026-11-26: Section 8 listings in Houston, TX gave 1183 over 29 pages, the first a 1-bedroom apartment at 1000 USD a month; 1- and 2-bedroom rentals in Los Angeles, CA by lowest rent gave 3751. ${NO_PII} US only, rents in USD a month. ${TWO}`,
    {
      state: state.describe("Required. A US state: 2-letter code (TX, CA, DC) or its name."),
      city: z.string().min(2).max(80).optional().describe("A city in the state (places[].search.city of get_affordablehousing_suggestions, e.g. Houston)."),
      county: z.string().min(2).max(80).optional()
        .describe("Or a county in the state, e.g. Harris (places[].search.county). Leave out city and county to search the whole state."),
      zip: z.string().regex(/^\d{5}$/).optional().describe("A 5-digit ZIP code, sent with its city and state (searched within its city)."),
      beds: oneOrMany(z.number().int().min(0).max(5)).optional()
        .describe("Bedrooms: 0 (studio) to 4, or 5 for 5+; one number or a list (2 and 3: [2, 3])."),
      baths_min: z.number().int().min(1).max(5).optional().describe("At least this many bathrooms (1 to 5)."),
      property_type: oneOrMany(z.enum(PROPERTY_TYPES)).optional()
        .describe("apartment, condo, townhouse or house (single family house); one or a list."),
      price_min: z.number().int().min(0).max(100_000).optional().describe("Lowest monthly rent, USD."),
      price_max: z.number().int().min(1).max(100_000).optional().describe("Highest monthly rent, USD (e.g. 1500)."),
      sort: z.enum(SORTS).optional()
        .describe("default (the site's own order), price_asc, price_desc, newest (last updated), beds_asc, beds_desc, sqft_asc, sqft_desc or affordability. Premium and spotlight listings come first in every sort."),
      page: z.number().int().min(1).max(500).optional().describe("Page of 42, from 1 (up to 500); pages says how many."),
      pet_friendly: z.boolean().optional().describe("Pet-friendly listings only."),
      section8: z.boolean().optional()
        .describe("Only listings whose owner has experience with the Section 8 / Housing Choice Voucher program."),
      utilities_included: z.boolean().optional().describe("Listings with utilities included only."),
      age_restricted: z.boolean().optional().describe("Only age-restricted (senior) housing."),
      accessibility: oneOrMany(z.enum(ACCESSIBILITY)).optional()
        .describe("physical (ramps, grab bars, roll-in showers) and / or visual_hearing (visual alarms and doorbells)."),
    },
    post("search"),
  );

  server.tool(
    "get_affordablehousing_listing",
    `One ${NAME} listing in full by link or id: id, url, name, title, listing_status, date_posted, address {street, city, county, state, zip, country}, latitude, longitude, property_type, currency, rent_min, rent_max, rent_text, beds, baths, sqft_min, sqft_max, section8_accepted, pets_allowed, pets_max, age_restriction, age_restricted, description, models [{id, name, beds, full_baths, half_baths, sqft, rent, rent_text, deposit, deposit_negotiable, year_built, property_type, available_date, accepting_applications, subsidized_units, description, units [{unit, rent, available_date, accepting_applications}]}], fees {move_in_total, move_out_total, estimated_monthly_total, estimated_one_time_total, application_fee, pet_rent, pet_deposit, pet_fee_one_time}, utilities {tenant_pays, owner_pays}, amenities and accessibility (by the listing's own groups), photos, listed_by (business owners such as property managers only), notes. Captured 2026-11-26: listing 1091545 in Los Angeles, CA 90045, an apartment listing at 2300 to 3985 USD a month across 4 models and 12 units, Section 8 accepted, with a 60 USD application fee; listing 762106 in Houston, TX 77017, a 1-bedroom at 1000 USD a month. An unknown id is a charged 404. ${NO_PII} ${ONE}`,
    {
      url: z.string().min(20).max(400).optional()
        .describe("The listing link (listings[].url of search_affordablehousing). Send url or id."),
      id: z.union([z.string().regex(/^\d{1,10}$/), z.number().int().positive()]).optional()
        .describe("Or the listing id (listings[].id, e.g. 766073)."),
    },
    post("listing"),
  );

  server.tool(
    "get_affordablehousing_suggestions",
    `${NAME}'s place suggestions for the start of a city, county or ZIP code: text, total, count, places [{label, type (city, county or zip), state, county, city, zip, population, search (the location input of search_affordablehousing: {state, city} or {state, county})}], notes. A ZIP code suggestion carries no city or state: search a ZIP code with its city and state. Captured 2026-11-26: Houston gave 18 places, the first Houston County, TX; Brooklyn gave Brooklyn, NY (search {state NY, city Brooklyn}). ${TWO}`,
    {
      text: z.string().min(2).max(80).describe("Required. The start of a city, county or ZIP code (e.g. Houston)."),
      limit: z.number().int().min(1).max(100).optional().describe("Most places to return, 1-100 (default 25)."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_affordablehousing_waiting_lists",
    `Open Section 8 and public housing waiting lists on ${NAME}, nationwide or for one state: state, title, count, open [{waitlist_id (null for an agency-level list the site gives no id), name, program, agency_id, agency_name, agency_url (the input of get_affordablehousing_housing_authority), state, online_application, status, opened_on (as the site gives it, MM/DD/YYYY)}], opening_soon_count, opening_soon, notes. Captured 2026-11-26: 753 open lists nationwide; 50 in Texas, among them the Abilene Housing Authority Section 8 (HCV) list, open since 10/31/2022. ${ONE}`,
    {
      state: state.optional().describe("A US state (code or name); leave out for every open list nationwide."),
    },
    post("waiting-lists"),
  );

  server.tool(
    "get_affordablehousing_housing_authority",
    `One housing authority (public housing agency) on ${NAME} by link, or by id and state: id, name, address, address2, city, county, state, zip, phone, fax, website, hcv_url, latitude, longitude, participant_code, waitlist_status, waitlist_open_date, waitlist_close_date, voucher_count, section8_inventory, programs, jurisdiction [{county, full_county}], waiting_lists [{id, name, program, selected_by, centralized}], url, notes. Phone, fax and website are the agency's public office contact only; no staff contact details are returned. ${NAME} explains payment standards and utility allowances in text only, so no payment standard or fair market rent numbers are given. Captured 2026-11-26: Somerville Housing Authority, Somerville, MA (id 674) had its waiting list open, 1193 vouchers and 12 waiting lists. An unknown id is a charged 404. ${ONE}`,
    {
      url: z.string().min(10).max(400).optional()
        .describe("The housing authority link (open[].agency_url of get_affordablehousing_waiting_lists, agencies[].url of get_affordablehousing_housing_authorities). Send url, or id with state."),
      id: z.union([z.string().regex(/^\d{1,8}$/), z.number().int().positive()]).optional()
        .describe("Or its id (agency_id, agencies[].id, e.g. 674), with state."),
      state: state.optional().describe("With id: the agency's state (code or name, e.g. MA)."),
    },
    post("housing-authority"),
  );

  server.tool(
    "get_affordablehousing_housing_authorities",
    `The housing authorities of a state as ${NAME}'s state page lists them: state, total (the site's count for the state), count, agencies [{id, name, address, waitlist_status (Open or Closed), programs, jurisdiction, url (the input of get_affordablehousing_housing_authority)}], notes. The page shows its first 14 agencies, in the site's order. Captured 2026-11-26: Texas had 346 housing authorities (14 shown), California 103, New York 164. ${ONE}`,
    {
      state: state.describe("Required. A US state: 2-letter code (TX, CA, DC) or its name."),
    },
    post("housing-authorities"),
  );
}
