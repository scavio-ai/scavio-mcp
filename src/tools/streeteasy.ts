import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/streeteasy.ts (NYC's five boroughs and North New Jersey, USD, no country). Rules
// the backend enforces and zod here does not: area must be a StreetEasy area (a borough, neighborhood, NJ city, nyc
// or an area id); home_types and sale_types apply to mode sale and sold only, by_owner to mode rent only, status to
// mode sale only; *_min <= *_max; listing takes one of url or id, and id needs listing_type; building takes one of
// slug or url; market metric must belong to the type (sales or rentals) and be published for the filter
// (price_index and rental_index for all only); market data covers New York City only (a New Jersey area is refused);
// start_month <= end_month.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const MODES = ["sale", "rent", "sold"] as const;
const SORTS = ["recommended", "newest", "recently_updated", "price_desc", "price_asc", "sqft_desc", "sqft_asc"] as const;
const HOME_TYPES = ["condo", "coop", "house", "multifamily"] as const;
const SALE_TYPES = ["sponsor", "resale", "foreclosure", "restricted"] as const;
const AMENITIES = [
  "washer_dryer", "dishwasher", "elevator", "doorman", "laundry", "gym", "parking", "pool", "storage",
  "private_outdoor_space", "public_outdoor_space", "central_ac", "furnished", "fireplace", "loft", "city_view",
  "garden_view", "park_view", "skyline_view", "waterview", "guarantor_ok", "pied_a_terre", "childrens_playroom", "smoke_free",
] as const;
const STATUSES = ["active", "in_contract"] as const;
const LISTING_TYPES = ["sale", "rent"] as const;
const DIRECTORY_TYPES = ["condo", "coop", "rental"] as const;
const MARKET_TYPES = ["sales", "rentals"] as const;
const SALES_METRICS = ["price_index", "inventory", "sale_to_list_ratio", "recorded_sales", "median_sale_price", "median_asking_price", "median_days_on_market", "share_of_price_cuts"] as const;
const RENTALS_METRICS = ["rental_index", "inventory", "median_asking_rent", "share_of_rent_cuts"] as const;
const MARKET_FILTERS = ["all", "condo", "coop", "single_family", "studio", "one_bedroom", "two_bedrooms", "three_plus_bedrooms"] as const;
const THIS_YEAR = new Date().getUTCFullYear();

const FIRST = "StreetEasy (streeteasy.com, Zillow Group's New York City real estate site, covering NYC's five boroughs and North New Jersey)";
const NAME = "StreetEasy";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PEOPLE = "No agent or private landlord names, emails, phones or photos are returned; the brokerage is.";
const CARD =
  "id (with listing_type, the input of get_streeteasy_listing), url, placement (organic, featured or sponsored: StreetEasy's paid placements come first), address, unit, area, area_id, zip, state, latitude, longitude, price (USD; rent per month), currency, sold_price, net_effective_rent, months_free, lease_term_months, total_monthly_price, price_change, beds, full_baths, half_baths, sqft, building_type, sale_type, status, available_date, off_market_date, is_new_development, furnished, has_videos, has_3d_tour, source_type, listed_by_owner, brokerage, open_house {start, end, appointment_only}, photo, photos";

const area = z.union([z.string().min(1).max(80), z.number().int().positive()]);
const usd = z.number().int().min(0).max(1_000_000_000);
const year = z.number().int().min(1700).max(THIS_YEAR + 5);
const month = z.string().regex(/^\d{4}-\d{2}$/);

export function registerStreeteasyTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/streeteasy/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_streeteasy",
    `Search homes for sale, rentals or past sales in an NYC or North NJ area on ${FIRST}: price, bedrooms, bathrooms, size, home type, sale type, year built, StreetEasy's amenity filters, pets, ZIP, by owner (rent) and in contract (sale), 7 sorts, up to 100 pages (sale pages hold about 38 cards, rent pages 14). Returns mode, area {id, name, slug, borough}, criteria (StreetEasy's search criteria as it read them), sort, page, total, pages, has_more, count, listings [${CARD}], notes. The sort orders the organic results; featured and sponsored cards come first. Captured 2026-11-26: rentals in Jersey City gave 2927 listings; homes for sale in Manhattan gave 6304. ${PEOPLE} USD. ${ONE}`,
    {
      area: area.describe("Required. A StreetEasy area by name, slug or id: a borough (Manhattan, Brooklyn, Queens, Bronx, Staten Island), a neighborhood (Williamsburg, Upper West Side), a New Jersey city (Jersey City, Hoboken), or nyc for all of NYC and NJ. Ids: 100 Manhattan, 300 Brooklyn, 400 Queens, 302 Williamsburg, 1001000 Jersey City. The answer returns the area id."),
      mode: z.enum(MODES).optional().describe("sale (homes for sale, default), rent (rentals) or sold (past sales)."),
      price_min: usd.optional().describe("Lowest price (rent per month on mode rent), USD."),
      price_max: usd.optional().describe("Highest price (rent per month on mode rent), USD (e.g. 4000)."),
      beds_min: z.number().int().min(0).max(10).optional().describe("Fewest bedrooms (0 = studio)."),
      beds_max: z.number().int().min(0).max(10).optional().describe("Most bedrooms. beds_min = beds_max asks for exactly that many."),
      baths_min: z.number().int().min(1).max(10).optional().describe("Fewest bathrooms."),
      sqft_min: z.number().int().min(1).max(100_000).optional().describe("Smallest size in square feet (listings without a size are left out)."),
      home_types: z.array(z.enum(HOME_TYPES)).max(HOME_TYPES.length).optional().describe(`Mode sale and sold: ${HOME_TYPES.join(", ")}.`),
      sale_types: z.array(z.enum(SALE_TYPES)).max(SALE_TYPES.length).optional().describe(`Mode sale and sold: ${SALE_TYPES.join(", ")} (sponsor = a sponsor unit, sold by the developer).`),
      year_built_min: year.optional().describe("Earliest year built."),
      year_built_max: year.optional().describe("Latest year built."),
      amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length).optional().describe(`StreetEasy's amenity filters, all required: ${AMENITIES.join(", ")}.`),
      pets_allowed: z.boolean().optional().describe("Only listings that allow pets."),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional().describe("Only listings in this ZIP code (with area nyc to search every borough)."),
      by_owner: z.boolean().optional().describe("Mode rent: only listings posted by the owner (no broker)."),
      status: z.enum(STATUSES).optional().describe("Mode sale: active (default: on the market) or in_contract (StreetEasy's pending)."),
      sort: z.enum(SORTS).optional().describe("recommended (StreetEasy's default; mode sold defaults to newest), newest, recently_updated, price_desc, price_asc, sqft_desc, sqft_asc."),
      page: z.number().int().min(1).max(100).optional().describe("Page, from 1 (default 1); pages and has_more say how deep the results go."),
    },
    post("search"),
  );

  server.tool(
    "get_streeteasy_listing",
    `One ${NAME} listing in full (for sale, sold or for rent) by link or by id with listing_type: id, url, listing_type, status, address {street, unit, city, state, zip, full}, area, building {id, name, slug, url, type, status, year_built, floors, units, area, latitude, longitude, amenities, policies}, sale_type, description, days_on_market, listed_date, available_date, off_market_date, sold_date, updated_at, status_changes, rooms, beds, full_baths, half_baths, sqft, amenities, features, views, pricing {price, currency, sold_price, rented_price, price_changes [{price, at}], monthly_maintenance, monthly_taxes, monthly_common_charges, estimated_monthly_payment, max_financing_percent, net_effective_rent, months_free, lease_term_months, security_deposit, move_in_fees, monthly_fees, additional_fees}, property_history [{listing_id, brokerage, sold_date, off_market_date, events [{date, price, status, price_change_percent}]}] (the unit's past listings), open_houses, media {photos, floor_plans, video_count, has_3d_tour}, area_price_stats {beds, sale {min, median, max, listings}, rental {min, median, max, listings}} (StreetEasy's recent-listing prices for that bedroom count in the area), source_type, listed_by_owner, mls_number, brokerage {name, listed_as, license_type, license_address}, agent_brokerages. Captured 2026-11-26: a one-bedroom rental at 99 Provost Street, Jersey City, at 4730 USD a month, net effective rent 4336 USD with 2 months free on a 24-month lease, 40 days on market; one-bedroom rentals in the area had a median of 3865 USD across 381 listings. ${PEOPLE} An unknown listing is a charged 404. ${ONE}`,
    {
      url: z.string().min(5).max(400).optional().describe("A StreetEasy listing link or path (listings[].url), e.g. /building/<building>/<unit> or /sale/<id>. Send url or id."),
      id: z.union([z.string().regex(/^\d{1,10}$/), z.number().int().positive()]).optional().describe("Or a StreetEasy listing id (listings[].id), with listing_type."),
      listing_type: z.enum(LISTING_TYPES).optional().describe("Required with id: sale (for sale and sold listings) or rent."),
    },
    post("listing"),
  );

  server.tool(
    "get_streeteasy_building",
    `One NYC or North NJ building on ${NAME} by slug or link: id, name, slug, url, address, area, neighborhood, type, unit_type, status, year_built, floors, units, latitude, longitude, description, amenities, policies (pets, sublets, pied-a-terre, ...), pets, details {developer, architect, interiors, manager, marketing_team, owner (the deed owner when a business), sales_office, leasing_office, website, sales_start_date}, nyc {building_class, building_class_description, community_district, council_district, police_precinct, hurricane_evacuation_zone, has_abatements}, inventory {sales, rentals: per bedroom count the available and past listing counts with min / max price; active_sale_ids, active_rental_ids}, sales, rentals (the building's listed units with price, status and brokerage), schools, transit, nearby {parks, colleges, museums}, similar_buildings, photo_count, photos. Captured 2026-11-26: Everton at 99 Provost Street, Jersey City, a rental building built in 2026 with 60 floors and 802 units. An unknown building is a charged 404. ${ONE}`,
    {
      slug: z.string().min(1).max(160).optional().describe("A StreetEasy building slug (building.slug or buildings[].slug, e.g. eastlight-condominium). Send slug or url."),
      url: z.string().min(5).max(400).optional().describe("Or the building's StreetEasy link (a listing link in the building works too)."),
    },
    post("building"),
  );

  server.tool(
    "get_streeteasy_buildings",
    `The building directory of ${NAME} for an area, about 11 buildings a page: area, building_type, page, total, pages, has_more, count, buildings [{id, name, slug (the input of get_streeteasy_building), url, address, active_sales, active_rentals, units, floors, year_built, status, buildings_in_complex, type, neighborhood, latitude, longitude, photo}]. Captured 2026-11-26: Williamsburg listed 5775 buildings, among them One Domino Square - Condos (160 units, 45 floors, built 2024, 13 units for sale). ${ONE}`,
    {
      area: area.describe("Required. A StreetEasy area by name, slug or id (as in search_streeteasy, e.g. Williamsburg)."),
      building_type: z.enum(DIRECTORY_TYPES).optional().describe("Only condo, coop or rental buildings."),
      page: z.number().int().min(1).max(1000).optional().describe("Page, from 1 (default 1)."),
    },
    post("buildings"),
  );

  server.tool(
    "get_streeteasy_market",
    `The monthly market data ${NAME} publishes for New York City from 2010-01 (its neighborhoods, the five boroughs and NYC; the price and rental indexes for Brooklyn, Manhattan, Queens and NYC, from 2005 and 2007), as StreetEasy publishes it. New Jersey areas have no published series. Sales metrics: ${SALES_METRICS.join(", ")}, by home type (all, condo, coop, single_family). Rentals metrics: ${RENTALS_METRICS.join(", ")}, by bedrooms (all, studio, one_bedroom, two_bedrooms, three_plus_bedrooms). Returns type, metric, metric_label, filter, filter_label, first_month, last_month, months, count, areas [{area, area_id, area_slug, borough, area_type (neighborhood, borough or city), latest {month, value}, values (aligned with months; null where none is published)}], notes. Captured 2026-11-26: the median sale price in Williamsburg was 1450000 USD in 2026-10, and its median asking rent for one bedroom 4695 USD. An area StreetEasy publishes no series for is a charged 404. ${ONE}`,
    {
      type: z.enum(MARKET_TYPES).optional().describe("sales (default) or rentals."),
      metric: z.enum([...new Set([...SALES_METRICS, ...RENTALS_METRICS])] as [string, ...string[]]).optional()
        .describe(`sales: ${SALES_METRICS.join(", ")} (default median_sale_price). rentals: ${RENTALS_METRICS.join(", ")} (default median_asking_rent).`),
      filter: z.enum(MARKET_FILTERS).optional()
        .describe("sales by home type: all (default), condo, coop, single_family. rentals by bedrooms: all, studio, one_bedroom, two_bedrooms, three_plus_bedrooms. price_index and rental_index are published for all only."),
      area: area.optional().describe("One area by name, slug or id (a neighborhood, a borough, or NYC; e.g. Williamsburg); every published area when omitted."),
      start_month: month.optional().describe("First month, YYYY-MM (e.g. 2024-01); the series start in 2010-01 (price_index in 2005-01, rental_index in 2007-01)."),
      end_month: month.optional().describe("Last month, YYYY-MM."),
    },
    post("market"),
  );
}
