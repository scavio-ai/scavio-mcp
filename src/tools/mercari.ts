import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/mercari.ts (Mercari US: mercari.com, USD,
// English; Mercari Japan: jp.mercari.com, JPY, Japanese). Markets per tool
// follow MERCARI_ENDPOINT_COUNTRIES: search, item, category, categories, brands
// and brand on us and jp; deals and trending us only; seller, seller-reviews
// and shop jp only. Cross-field rules the backend enforces and zod here does
// not: search needs query, category_id or brand_id; item takes exactly one of
// item_id or url; seller / seller-reviews one of seller_id or url; shop one of
// shop_id or url; a market an endpoint does not serve answers 400 before
// anything is charged. No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const STATUSES = ["on_sale", "sold", "all"] as const;
const SORTS = ["relevance", "newest", "price_asc", "price_desc", "likes", "recently_sold"] as const;
const SHIPPING = ["free", "buyer_pays"] as const;

const CHARGE = "Costs 1 credit. Failed upstream calls are not charged; a not-found is charged.";
const IDS = "Item, category, brand and seller ids are per market: an id from us is not valid on jp (a not-found, charged).";
const JP =
  "jp data is in Japanese as sellers wrote it (not translated), prices in yen; jp answers are slower than us (typically 10-20 s, up to about a minute).";
const PRICES =
  "Prices are numbers: US dollars on us, whole yen on jp; original_price is the seller's earlier price when above price, with discount_percent computed against it (never set on jp results).";
const ITEM =
  "item_id, title, url, price, original_price, discount_percent, currency, status (on_sale, trading = sold and in transit, sold), condition (new, like_new, good, fair, poor, bad) and condition_name, brand, category_id, size, thumbnail, seller_id, free_shipping (us: set only when you filter by shipping; jp: null on Mercari Shops rows), created_at; jp adds is_shop, shop_id, is_auction and updated_at. Grid results carry no likes, no sold time and on us no shipping payer (get_mercari_item has all three)";
const FILTERS =
  "Filters: status (on_sale default, sold, all), sort (relevance, newest, price_asc, price_desc; likes on jp, recently_sold on us; jp newest follows Mercari Japan's own order, where relisted items move up), price_min / price_max, condition, shipping (free, buyer_pays), size_id and deals_only (us), shops_only (jp).";
const DEPTH =
  "us 50 per page up to page 20 (later pages can repeat earlier items: dedupe by item_id), jp 120 per page up to page 91. total stops at 10,000 on us and 15,000 on jp (the cap means that many or more).";
const NOT_AVAILABLE =
  "Not available: US seller profiles and reviews, US search suggestions, price-drop history, buying or messaging; Mercari UK (closed).";

const market = (markets: readonly string[]) => {
  const desc =
    markets.length === 2
      ? "Market: us (default; mercari.com, USD, English) or jp (Mercari Japan, JPY, Japanese). Mercari UK closed (gb / uk answer 400); any other value answers 400 before anything is charged."
      : markets[0] === "us"
        ? "Market: us only (mercari.com, USD, English; the default). Any other value answers 400 before anything is charged."
        : "Market: jp only (Mercari Japan, JPY, Japanese; the default for this tool). Any other value answers 400 before anything is charged.";
  return z.enum(markets as [string, ...string[]]).optional().describe(desc);
};
const BOTH = ["us", "jp"] as const;
const US = ["us"] as const;
const JP_ONLY = ["jp"] as const;

const numId = (description: string) =>
  z.union([z.string().min(1).max(12), z.number().int().positive()]).describe(description);

const gridFilters = {
  status: z.enum(STATUSES).optional()
    .describe("on_sale (default), sold (sold listings, including items sold but still in transit: sold prices), or all."),
  page: z.number().int().min(1).max(91).optional().describe(`Results page, 1-based: ${DEPTH}`),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), newest, price_asc, price_desc; likes (jp only); recently_sold (us only). A us sold search comes most recently sold first under relevance too."),
  price_min: z.number().min(0).optional().describe("Lowest price: US dollars on us, whole yen on jp."),
  price_max: z.number().min(0).optional().describe("Highest price: US dollars on us, whole yen on jp."),
  condition: z
    .union([z.string().min(3).max(60), z.array(z.string().min(3).max(10)).min(1).max(6)])
    .optional()
    .describe("One or more of: new, like_new, good, fair, poor; bad (jp only). Several are ORed, e.g. ['new', 'like_new']."),
  shipping: z.enum(SHIPPING).optional().describe("free (the seller pays shipping) or buyer_pays."),
  size_id: numId("us only: a Mercari US size id.").optional(),
  deals_only: z.boolean().optional()
    .describe("us only: only listings on Mercari's deals filter (price dropped below the seller's earlier price)."),
  shops_only: z.boolean().optional().describe("jp only: only Mercari Shops products (business sellers)."),
};

const sellerId = () =>
  z.union([z.string().min(1).max(12), z.number().int().positive()]).optional()
    .describe("A Mercari Japan seller id (seller_id of a search or item answer), e.g. '477123966'.");
const sellerUrl = () =>
  z.string().min(20).max(300).optional()
    .describe("A Mercari Japan profile link (https://jp.mercari.com/user/profile/<id>).");

export function registerMercariTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/mercari/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_mercari",
    `Search Mercari listings by keyword (Mercari US or Mercari Japan): items (${ITEM}), total (Mercari's own count, capped), page, page_size, max_page, has_more, status, sort and filters. status sold returns sold listings (sold and in transit) with their prices, so asking prices (on_sale) and sold prices for the same query come from one tool. On us, Mercari orders sold results most recently sold first whatever relevance asks (price sorts apply) and matches the keyword more loosely than on-sale results (set names, descriptions): check titles before comparing prices. Depth: ${DEPTH} ${FILTERS} ${PRICES} ${JP} ${IDS} Markets: us and jp. ${CHARGE}`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Search keywords, e.g. 'nintendo switch' (required unless category_id or brand_id is sent). On jp, Japanese keywords match best."),
      country: market(BOTH),
      category_id: numId("A category id of the same market (get_mercari_categories) to search within.").optional(),
      brand_id: numId("A brand id of the same market (get_mercari_brands).").optional(),
      ...gridFilters,
    },
    post("search"),
  );

  server.tool(
    "get_mercari_item",
    `One Mercari listing by item_id or link: item_id, title, description, url, price, original_price, discount_percent (us also price_with_buyer_fee: price plus buyer fees, plus shipping when the buyer pays it), currency, status, sold_at (when it sold, if Mercari shows it), condition and condition_name, brand, category with its path, size, color, shipping (payer, method, service, fee: the shipping label cost paid by payer, days_to_ship, ships_from: US state or Japanese prefecture), likes, photos, created_at, updated_at, seller (seller_id, public display name, rating, review_count, listings_count, badges; us sold_count, jp good / normal / bad ratings). A sold listing keeps its full data. jp adds the item's full public comment list (text, date, is_seller; who wrote each is not returned); a jp Mercari Shops product (22-character id) answers is_shop with its shop and some of the shop's other products. ${PRICES} ${JP} ${IDS} Markets: us and jp. ${CHARGE}`,
    {
      item_id: z.string().min(9).max(22).optional()
        .describe("A Mercari item id (items[].item_id of a search answer): m and 11 digits, e.g. 'm38943035688', or on jp a 22-character Mercari Shops product id."),
      url: z.string().min(20).max(400).optional()
        .describe("A Mercari item link (https://www.mercari.com/us/item/<id>/, https://jp.mercari.com/item/<id> or a /shops/product/ link): its market is used."),
      country: market(BOTH),
    },
    post("item"),
  );

  server.tool(
    "get_mercari_category",
    `Listings in one Mercari category (category_id from get_mercari_categories), paged and sorted, optionally with keywords: category (category_id, name on us), items (${ITEM}), total, page, has_more, status, sort and filters. Depth: ${DEPTH} ${FILTERS} An unknown category id answers 404 (charged). ${PRICES} ${JP} ${IDS} Markets: us and jp. ${CHARGE}`,
    {
      category_id: numId("A category id of the market (get_mercari_categories), e.g. us 797 Consoles, jp 1289 (Pokemon card game)."),
      country: market(BOTH),
      query: z.string().min(1).max(200).optional().describe("Optional keywords within the category."),
      brand_id: numId("A brand id of the same market.").optional(),
      ...gridFilters,
    },
    post("category"),
  );

  server.tool(
    "get_mercari_categories",
    `Mercari's category tree: categories (category_id, name, parent_id, level, has_children; us adds title). us answers one level at a time (the 17 top-level categories, or the children of parent_id); jp answers the whole tree (8,700+ categories, Japanese names) or the children of parent_id. ${IDS} Markets: us and jp. ${CHARGE}`,
    {
      country: market(BOTH),
      parent_id: numId("A category id: its children. Omitted: us answers the 17 top-level categories, jp the whole tree.").optional(),
    },
    post("categories"),
  );

  server.tool(
    "get_mercari_brands",
    `Mercari's brand list (us about 28,800 brands, jp about 52,600), filtered by name with query and paged by 1,000: brands (brand_id, name; jp adds subname and the katakana reading), total, brands_in_market, page, has_more. Pass brand_id to get_mercari_brand or as a search filter. ${IDS} Markets: us and jp. ${CHARGE}`,
    {
      country: market(BOTH),
      query: z.string().min(1).max(100).optional()
        .describe("Filter brands by name, e.g. 'nike' (case-insensitive; on jp also the katakana reading)."),
      page: z.number().int().min(1).max(100).optional().describe("Page of 1,000 brands, 1-based."),
    },
    post("brands"),
  );

  server.tool(
    "get_mercari_brand",
    `Listings of one Mercari brand (brand_id from get_mercari_brands), paged and sorted, optionally within a category or with keywords: brand (brand_id, name), items (${ITEM}), total, page, has_more, status, sort and filters. Depth: ${DEPTH} ${FILTERS} An unknown brand id answers 404 on us (charged). ${PRICES} ${JP} ${IDS} Markets: us and jp. ${CHARGE}`,
    {
      brand_id: numId("A brand id of the market (get_mercari_brands), e.g. us 4591 Nintendo, jp 539 COACH."),
      country: market(BOTH),
      query: z.string().min(1).max(200).optional().describe("Optional keywords within the brand."),
      category_id: numId("A category id of the same market.").optional(),
      ...gridFilters,
    },
    post("brand"),
  );

  server.tool(
    "get_mercari_deals",
    `Listings on Mercari's deals filter (Mercari US): listings whose price the seller dropped, each with original_price (the earlier price) and discount_percent, optionally narrowed by keywords, category_id, brand_id and the search filters, paged and sorted (50 per page, up to page 20): items (${ITEM}). ${PRICES} Markets: us only. ${CHARGE}`,
    {
      country: market(US),
      query: z.string().min(1).max(200).optional().describe("Optional keywords."),
      category_id: numId("A US category id to narrow the deals.").optional(),
      brand_id: numId("A US brand id.").optional(),
      status: gridFilters.status,
      page: z.number().int().min(1).max(20).optional().describe("Results page, 1-based (50 per page, up to page 20)."),
      sort: gridFilters.sort,
      price_min: gridFilters.price_min,
      price_max: gridFilters.price_max,
      condition: gridFilters.condition,
      shipping: gridFilters.shipping,
      size_id: gridFilters.size_id,
    },
    post("deals"),
  );

  server.tool(
    "get_mercari_trending",
    `What is trending on Mercari US as its trending page lists it: keywords (position, keyword, search_rank, rank_change, search_volume_change_percent, trend) and brands (position, brand_id, name, demand, demand_change, sold_rate_7d, recent_listings), as Mercari shows them. Markets: us only (no Japanese trending). ${CHARGE}`,
    {
      country: market(US),
    },
    post("trending"),
  );

  server.tool(
    "get_mercari_seller",
    `A Mercari Japan seller's public profile by seller_id or link: seller (seller_id, name, rating, ratings good / normal / bad, review_count, listings_count, followers, following, badges, is_official, phone_verified, joined, bio, url) and listings (the first 30 as the profile shows them: item_id, title, url, price, status, likes, comment_count, created_at), listings_has_more. An unknown seller answers 404 (charged). ${NOT_AVAILABLE} ${JP} Markets: jp only. ${CHARGE}`,
    {
      seller_id: sellerId(),
      url: sellerUrl(),
      country: market(JP_ONLY),
    },
    post("seller"),
  );

  server.tool(
    "get_mercari_seller_reviews",
    `The most recent 100 reviews of a Mercari Japan user by seller_id or link: seller_id, name, summary (rating, good / normal / bad counts, review_count), reviews (rating good, normal or bad; text; date; role: whether the user was the seller or the buyer), has_more. Who wrote each review is never returned. US reviews are not available. ${JP} Markets: jp only. ${CHARGE}`,
    {
      seller_id: sellerId(),
      url: sellerUrl(),
      country: market(JP_ONLY),
    },
    post("seller-reviews"),
  );

  server.tool(
    "get_mercari_shop",
    `A Mercari Shops shop (a business seller on Mercari Japan) by shop_id or link: shop (shop_id, name, description, rating, review_count, followers, is_open, has_time_sale, badges, thumbnail, created_at, url). No product list: for its products use search_mercari with shops_only or get_mercari_item with one of its product ids. ${JP} Markets: jp only. ${CHARGE}`,
    {
      shop_id: z.string().length(22).optional()
        .describe("A Mercari Shops shop id (shop_id of a search answer, shop.shop_id of an item answer), e.g. 'LThudSk3aoGvKcW6R3sA6m'."),
      url: z.string().min(20).max(300).optional()
        .describe("A Mercari Shops link (https://jp.mercari.com/shops/profile/<id>)."),
      country: market(JP_ONLY),
    },
    post("shop"),
  );
}
