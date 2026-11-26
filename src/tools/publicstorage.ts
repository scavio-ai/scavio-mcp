import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/publicstorage.ts (US and Canada, USD / CAD, English and French in Canada). Rules
// the backend enforces and zod here does not: search takes location or slug, not both; location is a ZIP or postal
// code, a city with its state or province, or a street address, never latitude / longitude; a page past 1 needs the
// slug of page 1; language fr needs market ca (the US site is English only); facility takes store_id or url, and when
// both are sent the url's store id, market and language must match; reviews has no sort (newest first only) and covers
// US facilities only.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const MARKETS = ["us", "ca"] as const;
const LANGUAGES = ["en", "fr"] as const;
const SORTS = ["recommended", "distance", "price_low"] as const;
const UNIT_SIZES = ["5x5", "5x10", "5x15", "10x10", "10x15", "10x20", "10x25", "10x30"] as const;

const FIRST = "Public Storage (publicstorage.com, the largest US self-storage operator, now also in Canada)";
const NAME = "Public Storage";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const UNIT =
  "id, name, size_class, size, dimension, vehicle, features, currency, in_store_rent (In-Store Rent), online_price (Online price), first_month_rent, first_month_after_promotion, second_month_after_promotion, move_in_cost, admin_fee, lock_charge, promotion {id, name, label, reward_type, amount, length_months, promotion_months_label, in_store_months_label}, availability, units_left (only where the page says so)";
const PRICES =
  "Prices are the page's own per unit, in the market's currency (In-Store Rent and Online price); promotions are Public Storage's as given and can vary between visits. Public Storage does not publish occupancy.";

const storeId = z.union([z.string().regex(/^\d{1,6}$/), z.number().int().positive()]);
const language = () =>
  z.enum(LANGUAGES).optional().describe("en (default) or fr: Public Storage Canada's French pages (market ca). The US site is English only.");

export function registerPublicstorageTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/publicstorage/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_publicstorage",
    `Self-storage facilities on ${FIRST} near a ZIP or postal code, a city or an address, in the US or Canada (English or French), sorted recommended, by distance or by price, with filters (climate controlled, drive-up, 24/7 access, business, vehicle, RV or boat storage, a unit size) applied to the facilities on the page. Returns market, language, currency, distance_unit, location {query, slug, heading}, sort, filters, page, pages, has_more, listed, count, facilities [{rank, store_id (the input of get_publicstorage_facility and get_publicstorage_reviews), site_number, name, url, address, city, state, postal_code, country, phone, latitude, longitude, distance, distance_unit, today_hours {opens, closes}, starting_from, currency, features {climate_controlled, drive_up, access_24_7, business_storage, vehicle_storage, rv_storage, boat_storage, manager_on_site, electronic_gate, instant_booking}, unit_sizes, units_shown, units [{${UNIT}}]}], notes. 9-19 facilities a page; a ZIP search pages through its slug, while a city or a Canadian place lists every facility on page 1. ${PRICES} Captured 2026-11-26: ZIP 75201 by lowest price gave 10 facilities on page 1 of 2 (slug dallas-tx-75201), the first Dallas/ Swiss Ave - Deep Ellum, 0.5 miles away, from 32 USD, its 5'x5' unit at an In-Store Rent of 32 USD and an Online price of 16 USD (50% off for 4 months); Toronto, ON on market ca gave 18 facilities, the first 3.3 km away from 106 CAD. A place Public Storage cannot find is a charged 404. ${ONE}`,
    {
      location: z.string().min(2).max(120).optional()
        .describe("A ZIP or postal code (e.g. 75201), a city with its state or province (Austin, TX; Toronto, ON) or a street address. Not latitude / longitude. Send location or slug."),
      slug: z.string().min(3).max(120).optional()
        .describe("Or the search slug an earlier answer gave (location.slug, e.g. dallas-tx-75201): needed for page 2 and later."),
      market: z.enum(MARKETS).optional().describe("us (default, USD, miles) or ca (Public Storage Canada, CAD, km)."),
      language: language(),
      sort: z.enum(SORTS).optional().describe("recommended (Public Storage's default order), distance or price_low."),
      page: z.number().int().min(1).max(20).optional()
        .describe("Page from 1 (with slug past page 1, up to 20). Public Storage pages shallowly: pages says how many."),
      climate_controlled: z.boolean().optional().describe("Only facilities with climate-controlled units."),
      drive_up: z.boolean().optional().describe("Only facilities with drive-up access."),
      access_24_7: z.boolean().optional().describe("Only facilities with 24/7 access."),
      business_storage: z.boolean().optional().describe("Only facilities offering business storage."),
      vehicle_storage: z.boolean().optional().describe("Only facilities with vehicle storage."),
      rv_storage: z.boolean().optional().describe("Only facilities with RV storage."),
      boat_storage: z.boolean().optional().describe("Only facilities with boat storage."),
      unit_size: z.enum(UNIT_SIZES).optional().describe(`Only facilities with this unit size: ${UNIT_SIZES.join(", ")}.`),
    },
    post("search"),
  );

  server.tool(
    "get_publicstorage_facility",
    `One ${NAME} facility in full by store id or link: store_id, site_number, name, url, market, language, country, currency, phone, address {street, city, state, postal_code, country}, latitude, longitude, market_area, rating, review_count (US; Canadian pages show no reviews), office_hours, access_hours, rental_support_hours [{day, hours}], hours_labels, amenities, images, payment_accepted, admin_fee_note, units_count, units [{${UNIT}}], notes. ${PRICES} Captured 2026-11-26: store 2044, Public Storage - Dallas at 2420 N Haskell Ave, Dallas, TX 75204, rated 4.7 from 422 reviews with 20 unit types, its 5'x5' climate-controlled unit at an In-Store Rent of 66 USD and an Online price of 39.60 USD (40% off for 4 months), a 29 USD admin fee; store 7785, Public Storage - Dorval, Quebec, on Public Storage Canada's French pages in CAD. An unknown store id is a charged 404. ${ONE}`,
    {
      store_id: storeId.optional().describe("A Public Storage store id (facilities[].store_id of search_publicstorage, e.g. 2044). Send store_id or url."),
      url: z.string().min(20).max(400).optional()
        .describe("Or the facility link (facilities[].url, e.g. https://www.publicstorage.com/self-storage-<st>-<city>/<facility id>.html)."),
      market: z.enum(MARKETS).optional().describe("us (default) or ca. Read from url when sent."),
      language: language(),
    },
    post("facility"),
  );

  server.tool(
    "get_publicstorage_reviews",
    `Every customer review ${NAME} shows for one US facility, newest first (its only order), in one answer, optionally only one star rating: store_id, stars, count, reviews [{rating, date, date_iso, source (as given: Google), text}], notes. No reviewer name is returned. US only (Canadian facility pages show none). Captured 2026-11-26: store 2223 had 819 five-star reviews, the newest dated 2026-11-24; store 2044 had 12 four-star reviews. ${ONE}`,
    {
      store_id: storeId.describe("Required. A Public Storage store id (facilities[].store_id, e.g. 2044)."),
      stars: z.number().int().min(1).max(5).optional().describe("Only reviews with this many stars (1-5)."),
      site_number: z.string().regex(/^\d{3,6}$/).optional().describe("Optional: the facility's site number (facilities[].site_number)."),
      market: z.literal("us").optional().describe("us only: Public Storage Canada's pages show no reviews."),
    },
    post("reviews"),
  );
}
