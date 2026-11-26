import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/rentcafe.ts (US and Canada, USD / CAD, English and French). Rules the backend
// enforces and zod here does not: search takes one of location, city (with state) or zip (with state), and state
// goes with city or zip only; zip is US only; market must match the location's state or province; RentCafe filters
// ONE of beds, rent_specials, short_term, furnished, utilities_included or amenity per search (price_min, price_max,
// pet_friendly and sort combine with any); price_min <= price_max; property takes one of url or slug; a url must be
// a rentcafe.com listing link ending in default.aspx; market on floorplan-units must match the url's state; reviews
// take no sort or star filter; rent-trends is US cities only.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const MARKETS = ["us", "ca"] as const;
const LANGUAGES = ["en", "fr"] as const;
const PROPERTY_TYPES = ["apartments", "houses", "condos", "townhomes"] as const;
const SORTS = ["default", "rent", "rent_desc", "rating_desc", "newest"] as const;
const BEDS = ["studio", "1", "2", "3", "4"] as const;
const AMENITIES = [
  "washer-dryer", "pool", "garage", "fitness-center", "balcony", "air-conditioning", "dishwasher", "fireplace",
  "hardwood-floors", "walk-in-closets", "wheelchair-accessible", "controlled-access", "playground",
  "public-transportation", "recent-build", "tennis-court", "yard", "cheap", "luxury",
] as const;

const FIRST = "RentCafe (rentcafe.com, Yardi's US and Canada rental listing site)";
const NAME = "RentCafe";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const LISTING =
  "id (the property_id of get_rentcafe_reviews and get_rentcafe_floorplan_units), name, url (the input of get_rentcafe_property), address, city, state, zip, latitude, longitude, beds, baths, rent_min, rent_max, currency, rent_by_bed [{beds, rent, rent_text}], rating, review_count, pets_allowed, rent_specials, units_available, tags, badges, featured_type, management_company, image, image_count";

const propertyId = z.union([z.string().regex(/^\d{1,10}$/), z.number().int().positive()]);
const listingUrl = z.string().min(20).max(400);
const language = z.enum(LANGUAGES).optional()
  .describe("en (default) or fr: RentCafe's French pages (French labels over the same listings). Prices stay in the market's currency.");

export function registerRentcafeTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/rentcafe/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_rentcafe",
    `Search rentals on ${FIRST}: apartments, houses, condos or townhomes in a city, ZIP code, neighborhood or state (US and Canada), with ONE of beds, rent specials, short-term, furnished, utilities included or an amenity per search, plus a price range and pet-friendly (these combine with any filter), sorted 5 ways, 25 a page; English or French. Returns market, language, currency, property_type, location, filters, sort, title, total (RentCafe's count), page, page_size, pages, has_more, count, listings [${LISTING}], notes. Rents are in the market's currency (USD or CAD); a rent RentCafe does not state is null. RentCafe pages through about 15-20 pages at most: narrow with filters for more. Captured 2026-11-26: 2-bedroom apartments in austin-tx gave 4228 listings; toronto-on 8559 listings in CAD; montreal-qc in French 1160. A location RentCafe does not have is a charged 404. ${ONE}`,
    {
      location: z.string().min(2).max(160).optional()
        .describe("A RentCafe location as its search links write it (austin-tx, 78704-tx, downtown-toronto-toronto-on, a state such as tx), or a get_rentcafe_suggestions places[].seo_url (us/tx/austin). Send one of location, city (with state) or zip (with state)."),
      city: z.string().min(2).max(80).optional().describe("Or a city name, with state (e.g. Chicago)."),
      zip: z.string().regex(/^\d{5}$/).optional().describe("Or a US ZIP code, with state (e.g. 78704)."),
      state: z.string().length(2).optional().describe("With city or zip: the 2-letter US state or Canadian province code (TX, ON, QC)."),
      market: z.enum(MARKETS).optional().describe("us or ca. Read from the location's state or province when left out (a mismatch is refused)."),
      language,
      property_type: z.enum(PROPERTY_TYPES).optional().describe("apartments (default), houses, condos or townhomes."),
      beds: z.union([z.enum(BEDS), z.number().int().min(0).max(4)]).optional().describe("studio, 1, 2, 3 or 4 bedrooms (0 is studio). A path filter: one per search."),
      rent_specials: z.boolean().optional().describe("Only listings with a rent special. A path filter: one per search."),
      short_term: z.boolean().optional().describe("Only short-term leases. A path filter: one per search."),
      furnished: z.boolean().optional().describe("Only furnished rentals. A path filter: one per search."),
      utilities_included: z.boolean().optional().describe("Only rentals with utilities included. A path filter: one per search."),
      amenity: z.enum(AMENITIES).optional().describe(`One amenity filter as RentCafe links it: ${AMENITIES.join(", ")}. A path filter: one per search.`),
      pet_friendly: z.boolean().optional().describe("Only pet-friendly listings (combines with any filter)."),
      price_min: z.number().int().min(0).max(100_000).optional().describe("Lowest monthly rent, in the market's currency."),
      price_max: z.number().int().min(0).max(100_000).optional().describe("Highest monthly rent, in the market's currency (e.g. 2000)."),
      sort: z.enum(SORTS).optional()
        .describe("default (RentCafe's Best Match), rent (low to high; listings without a stated rent come first), rent_desc, rating_desc or newest (listings with new units at the top, as RentCafe sorts them)."),
      page: z.number().int().min(1).max(50).optional().describe("Page of 25, from 1 (default 1); pages says how many."),
    },
    post("search"),
  );

  server.tool(
    "get_rentcafe_property",
    `One ${NAME} listing in full by link or slug: id, name, url, market, language, currency, address {street, city, state, zip, country}, latitude, longitude, rent_min, rent_max, rent_text, beds, baths, rating, rating_label, review_count, badges, great_deal (RentCafe's bare Great deal badge; its basis is not stated), price_drop, rent_special, units_available, images, floorplans [{id (the floorplan_id of get_rentcafe_floorplan_units), name, beds, baths, size, rent, rent_text, has_units, price_drop, units_shown, units [{id, name, size, rent, rent_text, availability}]}], policies [{name, items [{label, value, amount}], text}] (deposit, application fees, pet fees and pet policy as RentCafe lists them), amenities {apartment, community}, services, building_details, category_ratings [{category, rating}], renters_summary {text, source} (RentCafe's own What renters are saying summary), reviews [{rating, date, text}] (no reviewer names), office_hours [{day, hours}], office_hours_note, phone (the leasing office), management_company, description, notes. Captured 2026-11-26: Bridge At Indigo in Austin, TX, rents 1130 to 2880 USD across 9 floor plans, rated 4 from 39 reviews; Maddox Dorchester in Montreal in French, 1390 to 2400 CAD with 16 units available. A link RentCafe does not have is a charged 404. ${ONE}`,
    {
      url: listingUrl.optional()
        .describe("The listing link (search_rentcafe listings[].url), e.g. https://www.rentcafe.com/apartments/tx/austin/bridge-at-indigo/default.aspx. Send url or slug."),
      slug: z.string().min(5).max(300).optional()
        .describe("Or <st>/<city>/<name> as in the listing link (e.g. tx/austin/bridge-at-indigo; housing/... or single-family/... for those links)."),
      language,
    },
    post("property"),
  );

  server.tool(
    "get_rentcafe_floorplan_units",
    `Every unit of one floor plan of a ${NAME} listing (the property page shows up to 2): property_id, floorplan_id, name, beds, baths, size, rent, rent_text, currency, price_drop, selected_unit {id, base_rent, base_rent_text, availability} (with unit_id), count, units [{id, name, availability (RentCafe's move-in text: Now or a date), available_now, beds, baths, size, rent, rent_text, specials}], amenities, photos [{url, alt}], specials, notes. Rents are base rents as RentCafe shows them. Captured 2026-11-26: the 2 bedroom plus den floor plan at 390 Queens Quay West, Toronto, had 6 units from 2937 CAD, available now. An unknown floor plan is a charged 404. ${ONE}`,
    {
      property_id: propertyId.describe("Required. A RentCafe property id (listings[].id, properties[].id or property id, e.g. 1651075)."),
      floorplan_id: z.union([z.string().regex(/^\d{1,12}$/), z.number().int().positive()]).describe("Required. A floor plan id (get_rentcafe_property floorplans[].id, e.g. 4746456)."),
      unit_id: z.union([z.string().regex(/^\d{1,12}$/), z.number().int().positive()]).optional()
        .describe("A unit id (floorplans[].units[].id): selected_unit gives its base rent and availability."),
      url: listingUrl.optional().describe("The listing link (listings[].url): sets the market (currency) from the listing."),
      market: z.enum(MARKETS).optional().describe("us (default) or ca: the currency of the rents. Read from url when sent."),
    },
    post("floorplan-units"),
  );

  server.tool(
    "get_rentcafe_reviews",
    `Resident reviews of one ${NAME} listing, 10 a page in RentCafe's order: property_id, page, page_size, total, pages, has_more, rating, rating_label, category_ratings, renters_summary (RentCafe's own summary; page 1), count, reviews [{rating, resident_type (e.g. Verified Resident), date, text}], notes. RentCafe offers no review sort or star filter. No reviewer name is returned. Captured 2026-11-26: Bridge At Indigo in Austin had 39 reviews over 4 pages, rating 4. An unknown property id is a charged 404. ${ONE}`,
    {
      property_id: propertyId.describe("Required. A RentCafe property id (listings[].id, e.g. 1651075)."),
      page: z.number().int().min(1).max(200).optional().describe("Page of 10 reviews, from 1 (default 1); pages says how many."),
      url: listingUrl.optional().describe("The listing link (listings[].url), optional."),
    },
    post("reviews"),
  );

  server.tool(
    "get_rentcafe_suggestions",
    `${NAME}'s location and property suggestions for a city, neighborhood, ZIP code or property name: query, market, places [{name, label, seo_url, location (the location input of search_rentcafe)}], properties [{id (the property_id of get_rentcafe_reviews and get_rentcafe_floorplan_units), name, address, city, state, zip, seo_url, location}], notes. Captured 2026-11-26: Toronto on ca gave 5 places (toronto-on first) and 3 properties. ${ONE}`,
    {
      query: z.string().min(2).max(80).describe("Required. A city, neighborhood, ZIP code or property name (e.g. Austin)."),
      market: z.enum(MARKETS).optional().describe("us (default) or ca."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_rentcafe_rent_trends",
    `${NAME}'s rent trends for a US city, as it publishes them: city, state, currency, url, title, last_updated, source (as RentCafe states it), average_rent, average_rent_previous_year, yoy_change_pct, highlights, by_bed_type [{type, average_rent, average_sqft}], budget_share [{range, share_pct}], households {renter_occupied, renter_pct, owner_occupied, owner_pct}, most_affordable_neighborhoods and most_expensive_neighborhoods [{name, average_rent, location (the location input of search_rentcafe)}], rent_by_neighborhood [{name, average_rent}], compared_cities [{name, average_rent}], notes. Captured 2026-11-26 (last updated October 30, 2026): Austin, TX averaged 1643 USD (1664 a year earlier, -1.26%); Chicago, IL 2531 USD (+3.91%). US only (RentCafe has no Canada rent trends pages). A city with no rent trends page is a 404, not charged. Costs 1 credit (credits_used is what was charged); failed upstream calls and refused inputs are not charged.`,
    {
      city: z.string().min(2).max(80).describe("Required. A US city (e.g. Austin)."),
      state: z.string().length(2).describe("Required. Its 2-letter state code (e.g. TX)."),
    },
    post("rent-trends"),
  );
}
