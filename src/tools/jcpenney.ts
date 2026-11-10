import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/jcpenney.ts (jcpenney.com, US incl. Puerto
// Rico stores, USD). Cross-field rules the backend enforces and zod here does
// not: product takes product_id, url or product_ids; category takes path or
// url; brand takes brand or url; stores take one location (zip, city + state,
// or lat + lng); store availability takes zip or lat + lng; reviews and
// questions take product_id or url. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "new_arrivals", "best_sellers", "rating", "price_low_to_high", "price_high_to_low"] as const;
const REVIEW_SORTS = ["most_recent", "most_helpful", "highest_rating", "lowest_rating", "relevance"] as const;
const DEAL_TYPES = ["clearance", "sale", "black_friday", "big_buy", "limited_time_special", "best_value", "gotta_have_it", "closeout", "bogo"] as const;

const ITEM_FIELDS = "id, title, brand, URL, image, sku_id, price and price_max (current), regular_price and regular_price_max, price_type (sale, clearance, original), percent_off, deal_label (BIG BUY!, CLEARANCE...), coupon_price with coupon_code (the price after today's coupon), rating, review_count, badge (Only at JCP, NEW, Few Left), availability_label (Same Day Pickup, Online Only...), colors with their SKU ids, and is_marketplace with the seller for third-party items";
const GRID_SHORT = "48 products per page (at most 25 pages) with the same item fields, facets and totals as search_jcpenney";
const GRID = `48 products per page (at most 25 pages = 1,200 items), each with ${ITEM_FIELDS}. Also returns total, page, total_pages, the sort applied, applied_filters and every facet (id, label and values with their value, count and a selected flag; any of them works in filters). Prices are product-level ranges: JCPenney does not expose a price per size or color. Average rating and review count here; review text is get_jcpenney_reviews. Prices in USD`;

const textOrList = (description: string) =>
  z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).min(1).max(20)]).optional().describe(description);
const brandFilter = () =>
  textOrList("Only this brand (or any of several), as the Brand facet lists it, e.g. \"levi's\", \"nike\", \"st. john's bay\".");
const dealFilter = () =>
  textOrList("Only items with this Deals & Promotions label (\"SALE\", \"CLEARANCE\", \"BIG BUY!\"...), as the facet lists it.");
const zip = () => z.union([z.string().regex(/^\d{5}(-\d{4})?$/), z.number().int().min(0).max(99999)]);
const productId = () => z.string().regex(/^[pP][pP][a-zA-Z]?\d{6,13}$/);

const gridFields = {
  page: z.number().int().min(1).max(25).optional()
    .describe("Results page, 1-based (48 items per page, at most 25 pages). A page past the last one returns an empty items list with the real total. Defaults to 1."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), new_arrivals, best_sellers, rating (highest rated first), price_low_to_high or price_high_to_low. The price orders are JCPenney's own and loose: sort the items by price yourself when you need a strict order."),
  color: textOrList("Only this color (or any of several), as the Color facet lists it (black, blue, beige...)."),
  size: textOrList("Only this size (or any of several), as the Size facet lists it (m, 12, 32x30...)."),
  price_range: textOrList("A Price Range facet value, e.g. \"under $5\", \"$20 - $24\"."),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])).max(20)])).optional()
    .describe("Any facet from a previous response: {facets[].id: facets[].values[].value, or a list of values (any of them)}, e.g. {\"gender\": \"women\"}, {\"store_availability\": \"same day pickup\"}, {\"average_rating\": \"4 rating\"}. Several facets combine (AND)."),
};

export function registerJcpenneyTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/jcpenney/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_jcpenney",
    `Search jcpenney.com (US) by keyword, filtered by brand, color, size, price range, deal label (SALE, CLEARANCE...) and any facet value (gender, store availability, rating, rise...), sorted by relevance (default), new arrivals, best sellers, rating or price. ${GRID}. When the site autocorrects the keyword, corrected_query says so; when it sends a keyword to a deal or category listing (doorbusters), redirected_to says where and the items are that listing's. Use an item's id with get_jcpenney_product, get_jcpenney_reviews or get_jcpenney_questions. 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'jeans'."),
      brand: brandFilter(),
      deal: dealFilter(),
      exact: z.boolean().optional()
        .describe("JCPenney narrows many keywords to a category on its own (jeans -> the Jeans category, visible in applied_filters). true searches the keyword across every category instead."),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_jcpenney_product",
    `One jcpenney.com product by id or URL, or up to 20 by product_ids in one call: title, brand, description, features, category and breadcrumbs, product and item type, images, average rating, review_count, question and answer counts (review text and Q&A: get_jcpenney_reviews and get_jcpenney_questions), the price block (regular, sale and clearance min / max ranges, percent off, price type, deal label, the after-coupon price with its coupon code, and when the price window starts and ends), channel (Omnichannel / OnlineOnly), in-store pickup, marketplace flag, and every variant: sku, UPC, color, size, all options, status, max per order and online_stock (high, low or out; single product only, a level, not a count). Prices are product-level ranges: JCPenney does not expose a price per size or color. A variants[].sku is what get_jcpenney_store_availability takes. An unknown id is a 404; unknown ids in a batch are listed in not_found. 1 credit.`,
    {
      product_id: productId().optional()
        .describe("A JCPenney product id (ppr / ppm / pp + digits): a search result's id, the last part of a product URL, e.g. 'ppr5008604049'."),
      url: z.string().min(1).max(800).optional()
        .describe("A jcpenney.com product URL (its product id is used). Alternative to product_id."),
      product_ids: z.array(productId()).min(1).max(20).optional()
        .describe("Up to 20 product ids in one call (still 1 credit). Batch results carry no online stock."),
    },
    post("product"),
  );

  server.tool(
    "get_jcpenney_category",
    `Browse one JCPenney category by its path or URL (Dresses, Sheets, Women's Boots...), with the same filters and sorts as search_jcpenney. The path needs its id=cat... part, the way jcpenney.com /g/ category links and a response's breadcrumbs carry it. ${GRID_SHORT}. Also returns the category's name, id, path, URL and breadcrumbs. A department page (dept...) lists no products by itself: it needs a deal or another filter. 1 credit.`,
    {
      path: z.string().min(1).max(800).optional()
        .describe("A JCPenney category path with its id=cat... part, e.g. '/g/women/dresses?id=cat100210008'."),
      url: z.string().min(1).max(1200).optional()
        .describe("A jcpenney.com category URL. Filters, a sort or a page in the URL are kept."),
      brand: brandFilter(),
      deal: dealFilter(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_jcpenney_brand",
    `Every JCPenney product of one brand by name (Nike, St. John's Bay, Carter's...) or a brand page URL, with the same filters and sorts as search_jcpenney (except brand). ${GRID_SHORT}. Also returns the brand's name, facet value and URL. An unknown brand is a 404. 1 credit.`,
    {
      brand: z.string().min(1).max(100).optional()
        .describe("A brand name as JCPenney lists it in the Brand facet, e.g. 'Nike', \"St. John's Bay\", \"Carter's\"."),
      url: z.string().min(1).max(1200).optional()
        .describe("A jcpenney.com brand page URL, e.g. 'https://www.jcpenney.com/g/brands/nike?id=cat11100023787' (JCPenney's curated brand page; its assortment can differ slightly from the brand name listing)."),
      deal: dealFilter(),
      ...gridFields,
    },
    post("brand"),
  );

  server.tool(
    "get_jcpenney_deals",
    `JCPenney deal listings across all products or one department: Clearance (default), Sale, Black Friday deals, Big Buy, Limited Time Special, Best Value, Gotta Have It, Closeout, Buy 1 Get 1, or any Deals & Promotions label, with the same filters and sorts as search_jcpenney. ${GRID_SHORT}. Seasonal labels (black_friday) list nothing once the event ends. To track clearance prices over time, poll and store your own: there is no price history. 1 credit.`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("clearance (default), sale, black_friday, big_buy, limited_time_special, best_value, gotta_have_it, closeout or bogo (every Buy 1 Get 1 offer)."),
      label: z.string().min(1).max(120).optional()
        .describe("Any Deals & Promotions label verbatim from a previous response's facets (s1_deals_and_promotions), instead of type, e.g. 'BUY 1 GET 1 50% OFF'."),
      department: z.string().regex(/^(?:cat|dept)\d{5,16}$/i).optional()
        .describe("Limit the deal to one department or category id (dept... / cat..., from breadcrumbs or a category URL), e.g. 'dept20000011'."),
      brand: brandFilter(),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_jcpenney_stores",
    `JCPenney stores near a US or Puerto Rico ZIP code, a city + state or a point (lat + lng), within 25 miles by default (up to 100), paged: store_id, name, address, city, state, ZIP, phone, lat / lng, distance in miles, weekly opening hours, timezone, services (Curbside Pickup, salon, portrait studio, JCPenney Beauty...), curbside and in-store pickup directions, bookable appointments (Sephora, salon) and the store page URL. Pass one location. 1 credit.`,
    {
      zip: zip().optional()
        .describe("US or Puerto Rico ZIP code to search around, e.g. '75024'."),
      city: z.string().min(1).max(60).optional()
        .describe("City (with state), instead of zip, e.g. 'Austin'."),
      state: z.string().length(2).optional()
        .describe("2-letter state code (with city), e.g. 'TX'."),
      lat: z.number().min(-90).max(90).optional()
        .describe("Latitude (with lng), instead of zip."),
      lng: z.number().min(-180).max(180).optional()
        .describe("Longitude (with lat)."),
      radius: z.number().int().min(1).max(100).optional()
        .describe("Search radius in miles, 1-100. Defaults to 25."),
      page: z.number().int().min(1).max(50).optional()
        .describe("Results page, 1-based. Defaults to 1."),
      page_size: z.number().int().min(1).max(20).optional()
        .describe("Stores per page, 1-20. Defaults to 10."),
    },
    post("stores"),
  );

  server.tool(
    "get_jcpenney_store_availability",
    `Real unit counts for one JCPenney SKU at the 5 nearest stores to a US or Puerto Rico ZIP code (or lat + lng): per store quantity, status (in_stock, low, out_of_stock, not_stocked), when the count was refreshed (updated_at), and the store's address, phone, distance and hours. Also returns how many of them have it (stores_with_stock) and total_quantity. in_stock_only drops the stores that have none. Take sku from get_jcpenney_product variants[].sku. 1 credit.`,
    {
      sku: z.union([z.string().regex(/^\d{8,16}$/), z.number().int().positive()])
        .describe("A JCPenney SKU id: a product's variants[].sku (or a search result's sku_id / colors[].sku_id), e.g. '84630160042'."),
      zip: zip().optional()
        .describe("US or Puerto Rico ZIP code: the 5 nearest stores are checked, e.g. '90012'."),
      lat: z.number().min(-90).max(90).optional()
        .describe("Latitude (with lng), instead of zip."),
      lng: z.number().min(-180).max(180).optional()
        .describe("Longitude (with lat)."),
      radius: z.number().int().min(1).max(100).optional()
        .describe("Search radius in miles. Defaults to 25."),
      in_stock_only: z.boolean().optional()
        .describe("Drop the stores (of the 5 nearest) that have none."),
    },
    post("store-availability"),
  );

  server.tool(
    "get_jcpenney_suggestions",
    `The jcpenney.com search-box suggestions for a partial query: keyword completions with their search URL and, where JCPenney offers them, department refinements (nike shoes women -> sneakers, running shoes...). Useful for keyword research and for building queries for search_jcpenney. 1 credit.`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'jea'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_jcpenney_coupons",
    `Today's public JCPenney coupons: code (null for in-store offers that need none), channel (online, in store or both), headline and details of each offer, start and end dates, the full disclaimer with its exclusions, and the URL of the eligible products. Public codes only, no account offers or JCPenney Rewards balances. No parameters. 1 credit.`,
    {},
    post("coupons"),
  );

  const productTarget = {
    product_id: productId().optional()
      .describe("A JCPenney product id (ppr / ppm / pp + digits): a search result's id, the last part of a product URL, e.g. 'ppr5008604049'."),
    url: z.string().min(1).max(800).optional()
      .describe("A jcpenney.com product URL (its product id is used). Alternative to product_id."),
  };

  server.tool(
    "get_jcpenney_reviews",
    `Real customer review text of one jcpenney.com (US) product by id or URL, up to 98 per call (default 38), sorted most recent (default), most helpful, highest or lowest rating, or relevance, optionally only one star rating. Returns the product's review statistics: total_reviews (every language), displayed_reviews (the English reviews JCPenney lists and pages through, often fewer than total_reviews), average_rating, rating_distribution (1-5), recommended_percent, secondary_ratings_averages (Quality, Value, Apparel...), photo_count, and matching_reviews for the sort and filter. Each review has id, rating, title, text, author nickname, location, submitted_at and updated_at, recommended, helpful and unhelpful votes, verified_purchaser and incentivized badges, syndicated with syndication_source (the brand site it came from, e.g. sharkninja.com), customer photos and videos, secondary ratings, the brand's public response (name, department, text, date) and the original product name. Reviewer age, gender and IP are never returned. Slower than the other JCPenney tools: usually 15-90s, up to about 3 minutes; failed calls are not charged. A product with no reviews returns an empty list; an unknown product is a 404. 1 credit.`,
    {
      ...productTarget,
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("most_recent (default), most_helpful, highest_rating, lowest_rating or relevance: the review list's own sort menu."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this star rating (1-5), e.g. 1 for the critical ones. A rating nobody gave returns an empty list."),
      max_reviews: z.number().int().min(8).max(98).optional()
        .describe("Reviews to return, 8-98. Defaults to 38. JCPenney loads 8, then 30 more per page, so 8, 38, 68 and 98 are the natural sizes; larger values take longer."),
    },
    post("reviews"),
  );

  server.tool(
    "get_jcpenney_questions",
    `Customer questions and every answer for one jcpenney.com (US) product by id or URL, up to 50 questions per call (default 10), newest answers first (JCPenney's order; there is no sort option). Returns total_questions and total_answers. Each question has id, question, details, author, submitted_at, answer_count and helpful_votes; each answer has id, text, author, author_type (brand for the manufacturer's product experts, retailer for JCPenney staff, ai for AI-generated answers, customer), ai_label (AI-Generated / AI-Assisted when JCPenney labels it), is_best_answer, submitted_at and helpful / unhelpful votes. Answerer IPs are never returned. Slower than the other JCPenney tools: usually 15-90s, up to about 3 minutes; failed calls are not charged. A product with no questions returns an empty list; an unknown product is a 404. 1 credit.`,
    {
      ...productTarget,
      max_questions: z.number().int().min(10).max(50).optional()
        .describe("Questions to return, 10-50 (10 per page). Defaults to 10."),
    },
    post("questions"),
  );
}
