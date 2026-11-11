import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/fanatics.ts (fanatics.com + 7 country
// storefronts, local currency, plus 4 US league stores via site). Merchandise
// and product data only: no odds or sportsbook data. Cross-field rules the
// backend enforces and zod here does not: product and reviews take product_id
// or url; browse takes url or ids (a league alone needs another id or a
// filter); language only applies to ca; site (other than fanatics) only with
// country us; price_band and deals under_25 are not on jp; filters take one
// value per filter (at most 12). No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const COUNTRIES = ["us", "gb", "de", "fr", "es", "it", "jp", "ca"] as const;
const SITES = ["fanatics", "nflshop", "mlbshop", "nhlshop", "mlsstore"] as const;
const SORTS = ["top_sellers", "price_low_to_high", "price_high_to_low", "newest"] as const;
const GENDERS = ["men", "women", "kids", "baby"] as const;
const PRICE_BANDS = ["under_25", "25_50", "50_100", "100_150", "over_150"] as const;
const DEAL_TYPES = ["sale", "clearance", "under_25"] as const;
const REVIEW_SORTS = ["highest_rated", "lowest_rated", "most_recent", "most_helpful"] as const;

const MARKETS = "us (fanatics.com, USD, default), gb (GBP), de, fr, es, it (EUR), jp (JPY) or ca (CAD; language en or fr)";
const STORES = "fanatics (default), nflshop (NFL Shop), mlbshop (MLB Shop), nhlshop (NHL Shop) or mlsstore (MLS Store)";
const ITEM_FIELDS = "id (for get_fanatics_product and get_fanatics_reviews), title, brand, url, image, price (current), regular_price, sale_price, clearance_price, with_code_price and code_percent_off (the price with the site's current promo code, when it applies), price_label (none, coupon or clearance), percent_off, top_seller, customizable, ready_to_ship, ship_by, est_delivery, urgency signals and is_sponsored";
const GRID = `Items with ${ITEM_FIELDS}. Also returns total (the US site counts at most 9000: total_capped is true when the real number is 9000 or more), page, page_size, total_pages, the sort, every facet (id, label, values with label, filter, value and count: send {filter: value} in filters), country, language, currency, site and data_as_of (when Fanatics built the page; listings can be a few minutes old)`;
const GRID_SHORT = "The same item fields, totals (9000 cap on the US site), facets and data_as_of as search_fanatics";
const WHERE = `Storefronts (country): ${MARKETS}. US league stores (site): ${STORES}.`;
const CHARGE = "Failed upstream calls are not charged (they are retried automatically); a not-found is charged. 1 credit.";

const country = () => z.enum(COUNTRIES).optional()
  .describe(`The storefront: ${MARKETS}. Defaults to us. Titles come in the storefront's language, prices in its currency.`);
const language = () => z.enum(["en", "fr"]).optional()
  .describe("ca only: en (default) or fr.");
const site = () => z.enum(SITES).optional()
  .describe(`US only: the store to read, ${STORES}. Same product ids on every store; each store writes its own titles.`);
const idField = (description: string) =>
  z.union([z.number().int().min(0), z.string().regex(/^\d{1,9}(-\d{1,9})?$/)]).optional().describe(description);
const gender = () => z.enum(GENDERS).optional().describe("men, women, kids or baby.");

const gridFields = {
  page: z.number().int().min(1).max(375).optional()
    .describe("Results page, 1-based. Defaults to 1. Fanatics lists at most 9000 products per listing."),
  page_size: z.union([z.literal(24), z.literal(48), z.literal(72)]).optional()
    .describe("Items per page: 24, 48 or 72. Defaults to 72."),
  sort: z.enum(SORTS).optional()
    .describe("top_sellers (default), price_low_to_high, price_high_to_low or newest. Price sorts follow the site's lowest price, which is the with-code price when a promo code applies."),
};

const filters = () => z.record(z.string(), z.union([z.string(), z.number()])).optional()
  .describe("Filters from a previous response: {facets[].values[].filter: facets[].values[].value}, one value per filter (up to 12). E.g. {\"ga\": \"2\"} (Women), {\"ks\": \"126\"} (a kids size), {\"cs\": \"2\"} (Fashion), {\"fa\": \"1\"} (Autographed), {\"t\": \"3433\"} (a team).");

export function registerFanaticsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/fanatics/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  const productTarget = {
    product_id: z.string().regex(/^\d{3,14}$/).optional()
      .describe("A Fanatics product id: a search result's id, e.g. '3892922'. The same id works on every league store."),
  };

  server.tool(
    "search_fanatics",
    `Search Fanatics merchandise (jerseys, hats, fan gear, collectibles; product data, not odds or betting) by keyword on 8 storefronts and 4 US league stores. Narrow by gender, league_id, department_id or any facet value through filters (team, player, size, color style, autographed...). Sort by top sellers, price or newest. Misspellings come back corrected (corrected_query). ${GRID}. ${WHERE} Price filters are on browse_fanatics and get_fanatics_deals (on a keyword search the site loosens the match). ${CHARGE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'chiefs jersey'. Misspellings are corrected by the site (corrected_query)."),
      country: country(),
      language: language(),
      site: site(),
      gender: gender(),
      league_id: idField("Narrow to one league (an id from facets: NFL 25, MLB 19, NBA 23, NHL 26, College 5)."),
      department_id: idField("Narrow to one department (an id from facets: Jerseys 8011, Hats 8008, T-Shirts 8022)."),
      filters: filters(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_fanatics_product",
    `One Fanatics product by id or URL: title, brand, league, team, player, gender, categories, breadcrumb, description, details, images, the price block (price, regular_price, sale_price, clearance_price, with_code_price, code_percent_off, percent_off, price_label), the site's current promo code (code, percent_off, tiered, ends_on, applies_to_product), in_stock, every size (item_id, available, stock_level low / out, price, with_code_price, ship_by, estimated delivery window, promise_ship_days), every colorway, personalization (name / number fields with their rules and the team roster; the price already includes personalization), flags (jersey_assurance, non_returnable, exclusive, authentic for autographed / authenticated items), the rating (average, count, distribution, fit, value, quality), review_count and data_as_of. Stock is a level, never a unit count. ${WHERE} ${CHARGE}`,
    {
      ...productTarget,
      url: z.string().min(1).max(800).optional()
        .describe("A product URL on any covered storefront or league store (its storefront is used). Alternative to product_id."),
      country: country(),
      language: language(),
      site: site(),
    },
    post("product"),
  );

  server.tool(
    "browse_fanatics",
    `Browse a Fanatics listing by its URL or by ids: a team (Lakers 5,000+ products), a player (Mahomes), a league section (NFL hats), a department, a brand ('47, Nike, New Era) or a collection, with price_band, on_sale, gender and any facet as filters (sizes, color style, autographed). The facets list the listing's teams, players (up to 100 on a team page), departments, brands, collections and sizes with their ids. browse names the league, team, player, department, brand and collection the page shows. Send url or ids, not both; a league alone is a landing page: combine it with another id or a filter. ${GRID_SHORT}. ${WHERE} ${CHARGE}`,
    {
      url: z.string().min(1).max(800).optional()
        .describe("A Fanatics listing URL: a team, player, league section, department, brand or collection page, e.g. 'https://www.fanatics.com/nba/los-angeles-lakers/o-23+t-3372'. Alternative to the ids."),
      league_id: idField("League id (NFL 25, MLB 19, NBA 23, NHL 26, College 5). A league alone is a landing page: combine it with another id or a filter."),
      team_id: idField("Team id (from facets: Los Angeles Lakers 3372, Kansas City Chiefs 3433)."),
      player_id: idField("Player id (from facets.players: Patrick Mahomes 12072, Aaron Judge 31)."),
      department_id: idField("Department id (Hats 8008, Jerseys 8011), or parent-child for a sub-department ('8008-8084')."),
      brand_id: idField("Brand id (from facets.brands: '47 479, Nike 76, New Era 127)."),
      collection_id: idField("Collection id (from facets.productGroups: City Edition 11552)."),
      country: country(),
      language: language(),
      site: site(),
      on_sale: z.boolean().optional()
        .describe("Only sale items."),
      price_band: z.enum(PRICE_BANDS).optional()
        .describe("under_25, 25_50, 50_100, 100_150 or over_150: the site's bands in the storefront's currency, applied to its lowest price (the with-code price when a promo code applies, so a few items list a little above the band). Not on jp."),
      gender: gender(),
      filters: filters(),
      ...gridFields,
    },
    post("browse"),
  );

  server.tool(
    "get_fanatics_deals",
    `Fanatics deal listings: sale (default: the site's Sale listing, coupon-eligible items and clearance markdowns), clearance (each sale page's clearance-priced items; total counts the whole sale listing) or under_25 (items under 25 in the storefront's currency, by the site's lowest price; not on jp), optionally for one league, team, department or brand. ${GRID_SHORT}. No price history: to track jersey sale prices over time, poll and store your own. ${WHERE} ${CHARGE}`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("sale (default), clearance or under_25 (not on jp)."),
      league_id: idField("Only one league (NFL 25, MLB 19, NBA 23, NHL 26, College 5)."),
      team_id: idField("Only one team (Los Angeles Lakers 3372, Kansas City Chiefs 3433)."),
      department_id: idField("Only one department (Hats 8008, Jerseys 8011)."),
      brand_id: idField("Only one brand ('47 479, Nike 76, New Era 127)."),
      country: country(),
      language: language(),
      site: site(),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_fanatics_reviews",
    "Customer reviews of one Fanatics (fanatics.com, US) product by id or URL, 1-50 per call (default 10), sorted highest rated (default, the site's order), lowest rated, most recent or most helpful, optionally only one star rating. Returns stats (review_count, rating_count, average, distribution, fit, quality and value averages), the site's own AI-written review summary (ai_summary) and the features reviewers mention. Each review has id, product_id and product_title, rating, fit, quality, value, recommended, title, text, author nickname, submitted_at, updated_at, incentivized, helpful and unhelpful votes, features with sentiment and photos. Fanatics pools reviews across a style: the list (and matching_reviews) covers sibling products of the same cut, so check each review's product_id. Slow: usually 20-90 s, up to about 4 minutes when a call is retried; when busy it returns 503 with Retry-After. Failed calls are not charged; an unknown product is a charged 404. US only. 1 credit.",
    {
      ...productTarget,
      url: z.string().min(1).max(800).optional()
        .describe("A fanatics.com product URL. Alternative to product_id."),
      country: z.enum(["us"]).optional()
        .describe("us only."),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("highest_rated (default, the site's order), lowest_rated, most_recent or most_helpful."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this many stars (1-5)."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Reviews to return, 1-50. Defaults to 10. More than 10 takes a few seconds longer per 8."),
    },
    post("reviews"),
  );
}
