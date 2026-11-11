import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/footlocker.ts (footlocker.com + 12 country
// storefronts, local currency). Cross-field rules the backend enforces and zod
// here does not: product, store availability, reviews and questions take
// product_id or url; category takes path, url or collection_id; brand takes
// brand or url; stores take zip, city + state or lat + lng; store availability
// takes zip or lat + lng. language only applies to ca (en / fr) and be
// (nl / fr). No zod `.default()`: the MCP SDK would post a defaulted field on
// every call.

const COUNTRIES = ["us", "ca", "gb", "de", "fr", "it", "es", "nl", "be", "at", "ie", "au", "nz"] as const;
const RELEASE_COUNTRIES = ["us", "ca", "gb"] as const;
const SORTS = ["relevance", "price_low_to_high", "price_high_to_low", "new_arrivals", "top_rated", "name_az", "brand_az"] as const;
const DEAL_TYPES = ["sale", "exclusives", "discount_eligible"] as const;
const RELEASE_STATUSES = ["all", "upcoming", "launched"] as const;
const REVIEW_SORTS = ["most_recent", "most_helpful", "highest_rating", "lowest_rating", "relevance"] as const;

const MARKETS = "us (footlocker.com, USD, default), ca (CAD, language en or fr), gb (GBP), de, fr, it, es, nl, be (language nl or fr), at, ie (EUR), au (AUD) or nz (NZD)";
const ITEM_FIELDS = "id (the SKU, for get_footlocker_product), base_product, title, brand, URL, image, price, list_price, percent_off, lowest_price_30d (European storefronts: the lowest price of the last 30 days), on_sale, is_new, is_launch, member_only_sale, rating, review_count, color_count and colors (sku, color, price, list_price per colorway)";
const GRID = `48 items per page, each with ${ITEM_FIELDS}. Also returns total, page, page_size, total_pages, the sort applied, applied_filters, every facet (id, label, values with value, label, count; any of them works in filters), country, language, currency and data_as_of: listings can be a few hours old, data_as_of says when this one was built`;
const GRID_SHORT = "48 items per page with the same item fields, facets, totals and data_as_of as search_footlocker";
const SLOW = "Slow: usually 25-90 s, up to about 3-4 minutes when a call is retried; failed calls are not charged. A product without an online page is a charged 404. US only.";
const NOT_FOUND = "Failed upstream calls are not charged; a not-found is charged.";

const country = () => z.enum(COUNTRIES).optional()
  .describe(`The storefront: ${MARKETS}. Titles come in the storefront's language, prices in its currency.`);
const language = () => z.enum(["en", "fr", "nl"]).optional()
  .describe("Only for ca (en default, fr) and be (nl default, fr).");
const usOnly = () => z.enum(["us"]).optional()
  .describe("us only (the only storefront this tool covers).");
const textList = (description: string) =>
  z.union([z.string().min(1).max(100), z.array(z.string().min(1).max(100)).min(1).max(20)]).optional().describe(description);
const brandFilter = () =>
  textList("Only this brand (or any of several), e.g. \"Nike\", \"Jordan\", \"adidas\", \"New Balance\", \"HOKA\"; case does not matter.");
const zip = () => z.union([z.string().regex(/^\d{5}(-\d{4})?$/), z.number().int().min(0).max(99999)]);

const gridFields = {
  page: z.number().int().min(1).max(200).optional()
    .describe("Results page, 1-based (48 items per page). A page past the last one returns an empty items list with the real total. Defaults to 1."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (the site's Featured order, default), price_low_to_high, price_high_to_low, new_arrivals, top_rated, name_az or brand_az."),
  gender: textList("Gender filter value(s) as facets.gender lists them (\"Men's\", \"Women's\"; in the storefront's language)."),
  color: textList("Color filter value(s) as facets.primaryColor lists them, e.g. \"Black\"."),
  price_range: textList("Price bucket value(s) as facets.price lists them (25-50, 50-75, 75-100, 100-150, 150-inf)."),
  on_sale: z.boolean().optional()
    .describe("Only items on sale."),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()])).max(20)])).optional()
    .describe("Any filter from a previous response: {facets[].id: facets[].values[].value, or a list of values}. Values of one filter are OR, filters combine (AND). E.g. {\"mensShoesSize\": \"10.0\"}, {\"womensShoesSize\": \"8.0\"}, {\"style\": \"Casual Sneakers\"}, {\"sport\": \"Running\"}, {\"eligibleForDiscount\": \"True\"}."),
};

const whereFields = {
  zip: zip().optional()
    .describe("US ZIP code to search around, e.g. '10001'."),
  lat: z.number().min(-90).max(90).optional()
    .describe("Latitude (with lng), instead of zip."),
  lng: z.number().min(-180).max(180).optional()
    .describe("Longitude (with lat)."),
  radius: z.number().int().min(1).max(120).optional()
    .describe("Search radius in miles, 1-120. Defaults to 25."),
  limit: z.number().int().min(1).max(50).optional()
    .describe("Stores to return, nearest first, 1-50. Defaults to 10."),
  country: usOnly(),
};

export function registerFootlockerTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/footlocker/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  const productTarget = {
    product_id: z.string().regex(/^[A-Za-z0-9]{5,14}$/).optional()
      .describe("A Foot Locker SKU: a search result's id, the last part of a product URL (Q5495005 in the US, 12 digits such as 316707025504 in Europe)."),
    url: z.string().min(1).max(800).optional()
      .describe("A Foot Locker product URL on any covered storefront (its storefront and SKU are used). Alternative to product_id."),
  };

  server.tool(
    "search_footlocker",
    `Search Foot Locker by keyword on any of 13 storefronts (${MARKETS}), filtered by brand, gender, color, price bucket, on_sale and any facet (shoe size per gender, style, sport, rating...), sorted by relevance, price, new arrivals, top rated, name or brand. ${GRID}. A bare brand keyword (nike, hoka) is answered by the site with a landing page: the brand's listing is returned instead and redirected_to says which. A keyword the site sends to a landing page without a product listing (samba, clearance) is an unbilled 400: use get_footlocker_brand, get_footlocker_category or get_footlocker_deals instead. 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'nike dunk'."),
      country: country(),
      language: language(),
      brand: brandFilter(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_footlocker_product",
    `One Foot Locker product by SKU or URL on any of the 13 storefronts: title, brand, description, genders, sports, category, color, style code, images, rating, review_count, the price block (price, list_price, percent_off, lowest_price_30d on European storefronts), availability online / to ship / for pickup, launch info (is_launch, launch_type, launch_date, web_only), flags, the size chart, every colorway (sku, color, price, availability) and every size: available, ship, pickup, stores_available (how many stores show that size as available: a store count, not units), UPC and store SKU. Availability is yes / no per size: Foot Locker publishes no unit counts. A SKU without an online page (unknown, store-only or not launched yet) is a 404. ${NOT_FOUND} 1 credit.`,
    { ...productTarget, country: country(), language: language() },
    post("product"),
  );

  server.tool(
    "get_footlocker_category",
    `Browse one Foot Locker category by its page path, URL or collection id (Men's Shoes, Women's Clothing, Kids...), in the site's order by default, with the same filters and sorts as search_footlocker. ${GRID_SHORT}. Also returns the category's id (collection id), name, path and URL. An unknown category is a 404. ${NOT_FOUND} 1 credit.`,
    {
      path: z.string().min(1).max(300).optional()
        .describe("A Foot Locker category page path (/category/<path>.html), as the site's category links carry it, e.g. '/category/mens/shoes.html'."),
      url: z.string().min(1).max(800).optional()
        .describe("A Foot Locker category URL (its storefront and page are used)."),
      collection_id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/).optional()
        .describe("A collection id: a previous response's category.id, e.g. 'men-s-shoes' (saves time on page 2+)."),
      country: country(),
      language: language(),
      brand: brandFilter(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_footlocker_brand",
    `Every Foot Locker product of one brand by name or brand page URL (Nike, Jordan, adidas, New Balance, HOKA...), optionally narrowed by a keyword, with the same filters and sorts as search_footlocker (except brand). ${GRID_SHORT}. brand echoes the brand as the site writes it, brand_id its id. An unknown brand is a 404. ${NOT_FOUND} 1 credit.`,
    {
      brand: z.string().min(1).max(80).optional()
        .describe("A brand name, e.g. 'Nike', 'Jordan', 'adidas', 'New Balance', 'HOKA', 'PUMA'; case does not matter."),
      url: z.string().min(1).max(800).optional()
        .describe("A Foot Locker brand page URL (/category/brands/<brand>.html). Alternative to brand."),
      query: z.string().min(1).max(200).optional()
        .describe("Narrow the brand to a keyword, e.g. 'running shoes'."),
      country: country(),
      language: language(),
      ...gridFields,
    },
    post("brand"),
  );

  server.tool(
    "get_footlocker_deals",
    `Foot Locker deal listings: sale (default; every storefront), Foot Locker Exclusives (us and ca only) or discount_eligible (the items a promo code applies to), with the same filters and sorts as search_footlocker. ${GRID_SHORT}. No price history: to track prices over time, poll and store your own. 1 credit.`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("sale (default; every storefront), exclusives (Foot Locker Exclusives; us and ca only) or discount_eligible (items a promo code applies to)."),
      country: country(),
      language: language(),
      brand: brandFilter(),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_footlocker_releases",
    `The Foot Locker sneaker release calendar as monitoring data (us, ca, gb): sku, title, brand, colorway (style), style_code, gender, launch_at, online_at, heat_level, in_stock, image, url, retail_price and currency (us and ca; gb has no prices), the reservation status and windows where the storefront runs them (status open / closed / store_only, starts_at, ends_at, assignment_at, awarding_at, online_reveal_at, store procedures; not on gb) and sizes (us, eu, uk, participating channels). Also returns total, count and data_as_of. Filter by status (upcoming / launched), a date window and brand. Read-only: nothing here enters, reserves or buys a release. 1 credit.`,
    {
      country: z.enum(RELEASE_COUNTRIES).optional()
        .describe("us (default), ca or gb."),
      language: z.enum(["en", "fr"]).optional()
        .describe("ca only: en (default) or fr."),
      status: z.enum(RELEASE_STATUSES).optional()
        .describe("all (default), upcoming (launch date ahead) or launched."),
      from: z.string().max(40).optional()
        .describe("Only releases launching on or after this ISO date, e.g. '2026-11-01'."),
      to: z.string().max(40).optional()
        .describe("Only releases launching on or before this ISO date, e.g. '2026-12-31'."),
      brand: z.string().min(1).max(80).optional()
        .describe("Only this brand, e.g. 'Nike' (case does not matter)."),
    },
    post("releases"),
  );

  server.tool(
    "get_footlocker_stores",
    `Foot Locker stores near a US ZIP code, a city + state or a point (lat + lng), nearest first (up to 50, default 10, within 25 miles by default, up to 120): store_id, name, name_secondary, address, city, state, ZIP, phone, lat / lng, distance_miles, weekly hours, opened_at, alert and closure notices, and the store page URL. Foot Locker banner stores only (no Kids Foot Locker or Champs). Pass one location. US only. 1 credit.`,
    {
      ...whereFields,
      city: z.string().min(1).max(60).optional()
        .describe("US city (with state), instead of zip, e.g. 'Atlanta'."),
      state: z.string().length(2).optional()
        .describe("2-letter US state code (with city), e.g. 'GA'."),
    },
    post("stores"),
  );

  server.tool(
    "get_footlocker_store_availability",
    `Which Foot Locker stores near a US ZIP code or a point (lat + lng) show a product (or one size) as available: each store (as in get_footlocker_stores) with available and sizes_available, plus per size whether it ships online, can be picked up and in how many of the listed stores it shows (stores_in_results), and stores_with_availability. Yes / no only: Foot Locker publishes no unit counts. Foot Locker banner stores only. US only, prices in USD. ${NOT_FOUND} 1 credit.`,
    {
      ...productTarget,
      size: z.union([z.string().min(1).max(20), z.number()]).optional()
        .describe("One size as get_footlocker_product sizes[].size lists it (10.0, 10, XL). Without it, every size."),
      ...whereFields,
    },
    post("store-availability"),
  );

  server.tool(
    "get_footlocker_reviews",
    `Customer reviews of one Foot Locker (US) product by SKU or URL, 1-98 per call (default 38), sorted most recent (default), most helpful, highest or lowest rating, or relevance, optionally only one star rating. Returns the review statistics: total_reviews (every language), displayed_reviews (the English reviews the site pages through), average_rating, rating_distribution, recommended_percent, secondary rating averages (fit, comfort, quality...) and photo_count, plus matching_reviews. Each review has id, rating, title, text, author nickname, submitted_at, recommended, helpful and unhelpful votes, verified_purchaser, incentivized, syndicated and its source, secondary ratings, photos, videos and the brand's response. Reviewer age, gender, location and IP are never returned. More reviews take longer (about 4 s per 30). ${SLOW} 1 credit.`,
    {
      ...productTarget,
      country: usOnly(),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("most_recent (default), most_helpful, highest_rating, lowest_rating or relevance."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this many stars (1-5)."),
      limit: z.number().int().min(1).max(98).optional()
        .describe("Reviews to return, 1-98. Defaults to 38."),
    },
    post("reviews"),
  );

  server.tool(
    "get_footlocker_questions",
    `Shopper questions about one Foot Locker (US) product by SKU or URL, 1-50 per call (default 10), newest answered first, with every answer: question, details, author, submitted_at, answer_count, helpful votes, and per answer its text, author, author_type (brand, retailer or customer), best-answer flag, date and votes. Also returns total_questions. ${SLOW} 1 credit.`,
    {
      ...productTarget,
      country: usOnly(),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Questions to return, 1-50. Defaults to 10."),
    },
    post("questions"),
  );
}
