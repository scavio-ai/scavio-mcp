import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/olx.ts (OLX Europe: olx.pl, olx.ro, olx.pt,
// olx.bg, olx.ua, olx.kz, olx.uz). Cross-field rules the backend enforces and
// zod here does not: search takes query, category_id or both; offer and
// similar take offer_id or url; page x page_size may not exceed 1000;
// language is kz / uz only (kk on kz, uz on uz, ru on both); olx_delivery is
// refused on kz and uz. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const COUNTRIES = ["pl", "ro", "pt", "bg", "ua", "kz", "uz"] as const;
const COUNTRIES_NO_KZ_UZ = ["pl", "ro", "pt", "bg", "ua"] as const;
const SORTS = ["relevance", "newest", "price_low_to_high", "price_high_to_low"] as const;
const DISTANCES = [0, 2, 5, 10, 15, 30, 50, 75, 100] as const;

const MARKETS = "pl (olx.pl, PLN, Polish, default), ro (olx.ro, RON, Romanian), pt (olx.pt, EUR, Portuguese), bg (olx.bg, EUR, Bulgarian), ua (olx.ua, UAH, Ukrainian), kz (olx.kz, KZT, Russian or Kazakh) or uz (olx.uz, UZS, Russian or Uzbek)";
const MARKETS_NO_KZ_UZ = "pl (olx.pl, PLN, Polish, default), ro (olx.ro, RON, Romanian), pt (olx.pt, EUR, Portuguese), bg (olx.bg, EUR, Bulgarian) or ua (olx.ua, UAH, Ukrainian); not kz or uz";
const SCOPE = "OLX Europe only (olx.pl, olx.ro, olx.pt, olx.bg, olx.ua, olx.kz, olx.uz); OLX Brasil, olx.in and other OLX-branded sites are not covered.";
const LANGUAGE = "Titles, parameters and labels come back in the site's language as the site writes them (Polish on pl; Russian by default on kz and uz).";
const PRIVACY = "Most OLX sellers are private individuals: a seller name is returned only for business sellers (business_name); private sellers come as an id only. No phone numbers, emails, last-seen times, profile photos or map positions are ever returned, and phone numbers and emails written into titles and descriptions are replaced with [phone removed] / [email removed].";
const PRICE = "price has value, currency, negotiable, type (price, free, exchange or budget), label as shown and previous_value when the seller lowered it; when the site converts a price (olx.uz y.e. to UZS, EUR to RON on ro, USD / EUR to UAH on ua) value is the converted figure and original_value with original_currency keep what the seller entered";
const ITEM = `id, url, title, description_snippet, ${PRICE}, salary (jobs: from, to, period, currency, gross), condition, params (key, name, value, normalized_value), category_id, location (city, district, region with their ids), created_at, refreshed_at, valid_to, status, is_promoted with promoted_position (the slot on the page), is_highlighted, is_business, olx_delivery and photos, seller (id; business_name for business sellers only)`;
const GRID = `Items with ${ITEM}. Also total (the site's count; null on kz and uz once a search reaches 1000 ads), total_capped (true when there are more ads than the 1000 OLX lets anyone page through), total_pages, page, page_size, has_next_page, count, promoted_count, sort, applied_filters, country, language and currency`;
const CHARGE = "1 credit. Failed upstream calls are not charged (they are retried automatically); a not-found is charged.";

const country = () => z.enum(COUNTRIES).optional()
  .describe(`The OLX site: ${MARKETS}. Defaults to pl. Titles and labels come in the site's language, prices in its currency.`);
const countryNoKzUz = () => z.enum(COUNTRIES_NO_KZ_UZ).optional()
  .describe(`The OLX site: ${MARKETS_NO_KZ_UZ}. Defaults to pl.`);
const language = () => z.enum(["ru", "kk", "uz"]).optional()
  .describe("kz and uz only: kk (Kazakh) on kz or uz (Uzbek) on uz; both sites default to ru (Russian). Refused on the other sites, which answer in their own language.");

const numericId = (description: string) => z.union([z.string().regex(/^\d{1,9}$/), z.number().int().min(1)]).optional()
  .describe(description);
const userId = () => z.union([z.string().regex(/^\d{1,12}$/), z.number().int().min(1)])
  .describe("An OLX seller id: items[].seller.id of a search or seller.id of an offer, e.g. '2547532895'.");
const offerTarget = {
  offer_id: z.union([z.string().regex(/^\d{1,12}$/), z.number().int().min(1)]).optional()
    .describe("An OLX ad id: items[].id of a search, e.g. '1107557408'. Alternative to url."),
  url: z.string().min(1).max(800).optional()
    .describe("An OLX ad link on any of the seven sites. Alternative to offer_id."),
};

const gridFields = {
  page: z.number().int().min(1).max(1000).optional()
    .describe("Results page, 1-based. OLX serves the first 1000 results of a search only, so page x page_size may not exceed 1000."),
  page_size: z.number().int().min(1).max(50).optional()
    .describe("Ads per page, up to 50 (default 40). Promoted ads come on top of these (40 asks return about 52 items)."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), newest (most recently posted or refreshed first: sellers can refresh an ad to the top), price_low_to_high or price_high_to_low. Promoted ads are not sorted."),
  min_price: z.number().min(0).optional()
    .describe("Lowest price, in the site's currency."),
  max_price: z.number().min(0).optional()
    .describe("Highest price, in the site's currency."),
  condition: z.enum(["new", "used", "refurbished", "damaged"]).optional()
    .describe("new, used, refurbished or damaged (in categories that have a condition)."),
  seller_type: z.enum(["private", "business"]).optional()
    .describe("private (individuals) or business."),
  olx_delivery: z.boolean().optional()
    .describe("Only ads that can be bought with OLX delivery. Not on kz or uz."),
  with_photos: z.boolean().optional()
    .describe("Only ads with photos."),
  region_id: numericId("Only ads in this region: region_id of search_olx_locations or of an item's location."),
  city_id: numericId("Only ads in this city: city_id of search_olx_locations or of an item's location, e.g. '17871'."),
  district_id: numericId("Only ads in this district of a city: district_id of search_olx_locations."),
  distance_km: z.union([z.literal(0), z.literal(2), z.literal(5), z.literal(10), z.literal(15), z.literal(30), z.literal(50), z.literal(75), z.literal(100)]).optional()
    .describe(`With city_id: include ads within this many km of the city (${DISTANCES.join(", ")}).`),
  filters: z.record(z.string(), z.union([z.number(), z.string().min(1).max(80), z.array(z.union([z.string().min(1).max(80), z.number()])).max(20)])).optional()
    .describe("The category's own filters, as listed by get_olx_filters (send_as keys): a range filter as filter_float_<name>:from / :to with a number (e.g. {\"filter_float_year:from\": 2018, \"filter_float_milage:to\": 100000}), a choice filter as filter_enum_<name> with one value or a list (e.g. {\"filter_enum_rooms\": [\"two\"]}). Up to 20 keys; other keys are refused."),
  include_promoted: z.boolean().optional()
    .describe("Keep the promoted ads the site places on each page (default true; each is flagged is_promoted with its slot)."),
};

export function registerOlxTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/olx/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_olx",
    `Search OLX classifieds (used goods, cars, real estate, jobs, services) by keyword and / or category. ${SCOPE} Sort by newest or price; filter by price range, condition, private or business seller, OLX delivery, photos, region / city / district with a radius, and the category's own filters (rooms, area, year, mileage ... discovered with get_olx_filters). Up to 1000 results per query (OLX's own cap). Promoted ads are interleaved and flagged (is_promoted, promoted_position). A query with no exact match returns the closest ads, never an empty list. ${GRID}. ${LANGUAGE} ${PRIVACY} Markets: ${MARKETS}. ${CHARGE}`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Search keywords, in any language, e.g. 'iphone'. query, category_id or both."),
      category_id: numericId("Search inside one category: categories[].id of get_olx_categories or an item's category_id, e.g. '84' = cars on olx.pl."),
      country: country(),
      language: language(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_olx_offer",
    `One OLX ad by id or link: title, the full description as plain text, ${PRICE}, salary for jobs, condition, every parameter (a car's VIN is never returned), category with breadcrumb, all photos, location (city, district, region with ids), created_at, refreshed_at, valid_to, status, is_active, is_promoted, olx_delivery, is_job and the seller (id, is_business, business_name for business sellers, member_since). An ad that does not exist and an ad that has ended answer the same 404 ("not found or no longer active"). No view counts, phone numbers or messaging. ${SCOPE} ${LANGUAGE} ${PRIVACY} Markets: ${MARKETS}. ${CHARGE}`,
    {
      ...offerTarget,
      country: country(),
      language: language(),
    },
    post("offer"),
  );

  server.tool(
    "get_olx_seller",
    `One OLX seller by id: is_business (from the seller's own ads), business_name (the registered business name, business sellers only; null otherwise), member_since, active_ads (number of live ads; null on kz and uz from 1000 ads up) and ads_url (the seller's page on OLX). OLX shows no seller ratings or reviews, so none are returned. ${SCOPE} ${PRIVACY} Markets: ${MARKETS}. ${CHARGE}`,
    {
      user_id: userId(),
      country: country(),
    },
    post("seller"),
  );

  server.tool(
    "get_olx_seller_ads",
    `One OLX seller's live ads, with the search_olx sorts and filters and an optional query. ${GRID}. ${LANGUAGE} ${PRIVACY} Markets: ${MARKETS}. ${CHARGE}`,
    {
      user_id: userId(),
      query: z.string().min(1).max(200).optional()
        .describe("Search within the seller's ads."),
      category_id: numericId("Only the seller's ads in this category."),
      country: country(),
      language: language(),
      ...gridFields,
    },
    post("seller-ads"),
  );

  server.tool(
    "get_olx_filters",
    `The filters one OLX category offers, ready to send as search_olx filters: each with key, label, type, kind (range or choice), unit, send_as (the filters keys to use), suggested range steps, and for choice filters every value with its label and the number of matching ads. Also the category's ad counts per region (or per city inside region_id) and per category. Markets: ${MARKETS_NO_KZ_UZ}. ${CHARGE}`,
    {
      category_id: z.union([z.string().regex(/^\d{1,9}$/), z.number().int().min(1)])
        .describe("The category (categories[].id of get_olx_categories), e.g. '14' = flats for sale on olx.pl, '84' = cars."),
      query: z.string().min(1).max(200).optional()
        .describe("Count values for this keyword inside the category."),
      region_id: numericId("Count values in this region only (locations then lists its cities)."),
      country: countryNoKzUz(),
    },
    post("filters"),
  );

  server.tool(
    "get_olx_categories",
    `The OLX category tree of one site: id, name, parent_id, level, path, url, type and count (active ads), with children. Without parent_id: the top-level categories and their direct children (children_count tells which go deeper); with parent_id: that category's whole subtree. Category names come in the site's language. Markets: ${MARKETS}. ${CHARGE}`,
    {
      parent_id: numericId("Return this category's whole subtree, e.g. '5'. Without it: the top-level categories with their direct children."),
      country: country(),
    },
    post("categories"),
  );

  server.tool(
    "search_olx_locations",
    `Place autocomplete for OLX location filters: cities and districts matching a name, with city_id, district_id and region_id to send to search_olx, plus the municipality, county and region names. Markets: ${MARKETS}. ${CHARGE}`,
    {
      query: z.string().min(2).max(100)
        .describe("At least 2 letters of a city or district name, e.g. 'Warszawa'."),
      country: country(),
    },
    post("locations"),
  );

  server.tool(
    "get_olx_suggestions",
    `The suggestions the OLX search box shows for what a user typed: popular searches, each with the category it is most searched in (category_id, name and its parent categories). Markets: ${MARKETS}. ${CHARGE}`,
    {
      query: z.string().min(1).max(100)
        .describe("What the user has typed so far, e.g. 'rower'."),
      country: country(),
    },
    post("suggestions"),
  );

  server.tool(
    "get_olx_similar",
    `The ads OLX recommends next to one ad (about 30), in the search_olx item shape: ${ITEM}. Also offer_id, count, country, language and currency. ${PRIVACY} Markets: ${MARKETS_NO_KZ_UZ}. ${CHARGE}`,
    {
      ...offerTarget,
      country: countryNoKzUz(),
    },
    post("similar"),
  );
}
