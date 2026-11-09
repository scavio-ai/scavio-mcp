import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/macys.ts (macys.com, US only, USD).
// Cross-field rules the backend enforces and zod here does not: product takes
// product_id, url or product_ids; reviews and store availability take
// product_id or url; category takes category_id or url; brand takes brand_id
// or url; stores and store availability take one location (zip, lat + lng, or
// city + state), and store availability takes store_id OR a location, not
// both. No zod `.default()`: the MCP SDK would post a defaulted field on every
// call.

const SORTS = ["featured", "price_low_to_high", "price_high_to_low", "top_rated", "best_sellers", "newest"] as const;
const REVIEW_SORTS = ["newest", "highest_rated", "lowest_rated", "with_photos"] as const;
const SPECIAL_OFFERS = [
  "limited_time_special",
  "gift_with_purchase",
  "black_friday_deal",
  "clearance",
  "last_act",
  "our_lowest_price",
  "sales_and_discounts",
  "special_offer",
  "today_only",
] as const;
const DEAL_TYPES = ["sale", "clearance", "today_only", "last_act", "limited_time_special", "black_friday"] as const;

const ITEM_FIELDS = "id, title, brand, URL, image, price (price_max when the item sells at a range), regular price, sale price, percent off, price label (Sale, Now, Only...), on-sale flag, sale end date, deal label (Black Friday Deal, Clearance, LAST ACT, Today Only...), promotions, rating, review count, colors and is_sponsored";
const GRID_SHORT = "60 organic items per page with the same item fields, facets, totals and sponsored handling as search_macys";
const GRID = `60 organic items per page, each with ${ITEM_FIELDS}. Also returns total, page, total_pages, the sort applied, the facets (name, label and values with counts; any value works in filters) and applied_filters. Ad-only sponsored tiles are dropped (sponsored_dropped counts them) unless include_sponsored; organic items that also hold a paid slot are kept and flagged is_sponsored. Totals can differ between sorts, as on the site. Prices in USD`;

const numericId = (max: number) => z.union([z.number().int().positive(), z.string().regex(new RegExp(`^\\d{1,${max}}$`))]);
const productId = () => numericId(10).optional()
  .describe("Macy's product id: a search result's id, or the ID= number in a macys.com product URL, e.g. 25822310.");
const productUrl = () => z.string().min(1).max(600).optional()
  .describe("A macys.com product URL (its ID= is used). Alternative to product_id.");
const textOrList = (description: string) =>
  z.union([z.string().min(1).max(100), z.array(z.string().min(1).max(100)).max(20)]).optional().describe(description);
const specialOffer = () => z.union([z.enum(SPECIAL_OFFERS), z.array(z.enum(SPECIAL_OFFERS)).max(9)]).optional()
  .describe(`Only items with this offer: ${SPECIAL_OFFERS.join(", ")}. A list matches any of them.`);

const gridFields = {
  page: z.number().int().min(1).max(1000).optional()
    .describe("Results page, 1-based (60 organic items per page). Defaults to 1."),
  sort: z.enum(SORTS).optional()
    .describe("featured (default), price_low_to_high, price_high_to_low, top_rated, best_sellers or newest."),
  brand: textOrList("Only these brands, spelled as the BRAND facet lists them, e.g. \"Levi's\" or [\"Levi's\", \"Calvin Klein\"]. A list matches any of them."),
  color: textOrList("Only these colors, as the COLOR_NORMAL facet lists them (Black, Blue, Red...). A list matches any of them."),
  min_price: z.number().min(0).optional()
    .describe("Minimum price in USD. Any bound works, not only the site's price buckets."),
  max_price: z.number().min(0).optional()
    .describe("Maximum price in USD."),
  pickup_store_id: numericId(6).optional()
    .describe("Only items available for pickup at this store (a store_id from get_macys_stores), e.g. 4592."),
  filters: z.record(z.string(), z.union([z.string().min(1).max(100), z.array(z.string().min(1).max(100)).max(20)])).optional()
    .describe("Any other facet from a previous response's facets: its name to one value or a list, e.g. {\"GENDER\": \"Women\", \"CUSTRATINGS\": \"4 stars & up\"}."),
  include_sponsored: z.boolean().optional()
    .describe("Keep ad-only sponsored tiles (flagged is_sponsored). Defaults to false: they are dropped."),
};

const locationFields = {
  zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
    .describe("US ZIP code to search around, e.g. '10001'."),
  lat: z.number().min(-90).max(90).optional()
    .describe("Latitude (with lng), instead of zip."),
  lng: z.number().min(-180).max(180).optional()
    .describe("Longitude (with lat)."),
  city: z.string().min(1).max(60).optional()
    .describe("US city (with state), instead of zip, e.g. 'Atlanta'."),
  state: z.string().length(2).optional()
    .describe("2-letter US state code (with city), e.g. 'GA'."),
  radius: z.number().int().min(1).max(100).optional()
    .describe("Search radius in miles, 1-100. Defaults to 100."),
};

export function registerMacysTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/macys/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_macys",
    `Search macys.com (US) by keyword, filtered by brand, color, special offer (clearance, Last Act, Today Only, Black Friday deal...), any price range, a pickup store and any other facet, sorted by featured (default), price, top rated, best sellers or newest. ${GRID}. A keyword the site maps to a category comes back with redirected_to_category (its id works with get_macys_category). Use an item's id with get_macys_product, get_macys_reviews or get_macys_store_availability. 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'jeans'."),
      special_offer: specialOffer(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_macys_product",
    `One macys.com product by id or URL, or up to 10 by product_ids in one call: title, brand (with brand_page_id for get_macys_brand), type, description, bullets, category path, price, regular and sale price, percent off, on-sale flag, sale end, promotions, rating, review_count and text_review_count (ratings without text count in review_count only), rating_distribution, recommended count, fit slider, AI review summary, purchased message, question and answer counts, images, colors with their prices, sizes and every variant (UPC, color, size, available, availability message, low-stock flag, ship days). A product that belongs to a collection answers with the collection product, and requested_id echoes the id asked for. In a batch, unknown ids are listed in not_found and Macy's serves its summary view: rating and review_count but no rating histogram, and a collection without its members' variants. An unknown id is a 404. 1 credit per call.`,
    {
      product_id: productId(),
      url: productUrl(),
      product_ids: z.union([z.array(numericId(10)).min(1).max(10), z.string().min(1).max(200)]).optional()
        .describe("Up to 10 product ids in one call (array or comma-separated), instead of product_id / url, e.g. [25822310, 719388]."),
    },
    post("product"),
  );

  server.tool(
    "get_macys_reviews",
    `Customer reviews of one macys.com product by id or URL, newest (default), highest rated, lowest rated or with photos first, up to 100 per page, optionally only one star rating or only reviews mentioning a word: rating, title, text, date, nickname, location as the reviewer gave it, recommended, helpful yes / no votes, incentivized and syndicated flags (and the site it came from), badges, fit and other slider ratings, photo URLs and the brand's response. Also total, total_pages and has_more. total counts written reviews only: ratings without text are not returned (get_macys_product has the full rating histogram). Reviewer = nickname only. 1 credit.`,
    {
      product_id: productId(),
      url: productUrl(),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("newest (default), highest_rated, lowest_rated or with_photos."),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based. Defaults to 1."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Reviews per page, 1-100. Defaults to 20."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this star rating, 1-5."),
      query: z.string().min(1).max(100).optional()
        .describe("Only reviews mentioning this text, e.g. 'soft'."),
    },
    post("reviews"),
  );

  server.tool(
    "get_macys_category",
    `Browse one macys.com category by id or URL, with the same filters and sorts as search_macys. ${GRID_SHORT}. Also returns the category's id, name and URL. An unknown id is a 404. 1 credit.`,
    {
      category_id: numericId(9).optional()
        .describe("Macy's category id: the id= of a macys.com /shop/ URL, a product's categories[].id, or a search's redirected_to_category.id, e.g. 3763 (Men's Coats & Jackets)."),
      url: z.string().min(1).max(600).optional()
        .describe("A macys.com category URL with its id=. Filters, page and sort already in the URL are kept."),
      special_offer: specialOffer(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_macys_brand",
    `Browse one brand's macys.com page by its page id or URL (a product's brand_page_id), with the same filters and sorts as search_macys. ${GRID_SHORT}. Also returns the brand's page id, name and URL. To filter by brand name instead, use search_macys with brand. 1 credit.`,
    {
      brand_id: numericId(9).optional()
        .describe("The brand page id: a product's brand_page_id, or the id= of a macys.com /shop/brands/ URL, e.g. 337747 (Calvin Klein)."),
      url: z.string().min(1).max(600).optional()
        .describe("A macys.com brand page URL with its id=."),
      special_offer: specialOffer(),
      ...gridFields,
    },
    post("brand"),
  );

  server.tool(
    "get_macys_deals",
    `Macy's sale listings: all Sales & Offers (default), Clearance, Today Only, Last Act (final-sale markdowns), Limited-Time Specials or Black Friday Deals, with the same filters and sorts as search_macys (except special_offer). ${GRID_SHORT}. sale_ends carries the end date when Macy's states one. 1 credit.`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("sale (all Sales & Offers, default), clearance, today_only, last_act, limited_time_special or black_friday."),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_macys_stores",
    `Macy's stores near a US ZIP code, a point (lat + lng) or a city + state, nearest first (up to 15, within 100 miles by default): store_id (what get_macys_store_availability and pickup_store_id take), name, address, phone, lat / lng, distance in miles, today's and tomorrow's hours, curbside hours and the order cut-off for same-day pickup. Pass one location. 1 credit.`,
    {
      ...locationFields,
    },
    post("stores"),
  );

  server.tool(
    "get_macys_store_availability",
    `Can a macys.com product be picked up in store? Near a ZIP, a point or a city + state: every store with available true / false and available_items_count (how many of the product's items it has). At one store (store_id): the store's hours, pickup cut-off and pickup options, and for every variant (UPC, color, size) pickup_available and in_store_available. Macy's publishes no unit quantities, so there are no stock counts. Pass store_id or a location, not both. An unknown store_id is a 404. 1 credit.`,
    {
      product_id: productId(),
      url: productUrl(),
      store_id: numericId(6).optional()
        .describe("One store (a store_id from get_macys_stores) for per-variant pickup and in-store flags, instead of a location, e.g. 4592."),
      ...locationFields,
    },
    post("store-availability"),
  );

  server.tool(
    "get_macys_suggestions",
    `The macys.com search-box autocomplete for a partial query: up to 7 suggested searches. Useful for keyword research and for building queries for search_macys. 1 credit.`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'jea'."),
    },
    post("suggestions"),
  );
}
