import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/uniqlo.ts (uniqlo.com and Uniqlo's Greater
// China sites). Markets follow UNIQLO_ENDPOINT_COUNTRIES: us, jp, kr serve
// every endpoint; tw, hk, cn serve search + product (their own product codes);
// the other storefronts serve product + prices. Cross-field rules the backend
// enforces and zod here does not: language must be one the market serves
// (listed in MARKETS); product takes product_id or url; store-stock takes
// l2_id or product_id + color + size; stores takes lat + lng or store_id;
// sort best_selling is tw / hk / cn only and top_rated us / jp / kr only;
// flag online_only is jp only. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

// Storefront -> "<currency> <languages, the first is the default>".
const MARKETS: Record<string, string> = {
  us: "USD en", jp: "JPY ja", kr: "KRW ko",
  au: "AUD en", be: "EUR nl fr en", ca: "CAD en fr", de: "EUR de en", dk: "DKK en", es: "EUR es en",
  fr: "EUR fr en", gb: "GBP en", id: "IDR id en", in: "INR en", it: "EUR it en", my: "MYR en",
  nl: "EUR nl en", ph: "PHP en", se: "SEK en", sg: "SGD en", th: "THB th en", vn: "VND vi en",
  at: "EUR en", bg: "EUR en", cz: "EUR en", ee: "EUR en", fi: "EUR en", gr: "EUR en", hr: "EUR en",
  hu: "EUR en", ie: "EUR en", lt: "EUR en", lu: "EUR en", lv: "EUR en", pl: "EUR en", pt: "EUR en",
  ro: "EUR en", si: "EUR en", sk: "EUR en",
  tw: "TWD zh-Hant", hk: "HKD zh-Hant", cn: "CNY zh-Hans",
};
const GROUP_A = ["us", "jp", "kr"] as const;
const GROUP_C = ["tw", "hk", "cn"] as const;
const GROUP_B = Object.keys(MARKETS).filter((c) => !(GROUP_A as readonly string[]).includes(c) && !(GROUP_C as readonly string[]).includes(c));
// uk is accepted as an alias of gb.
const SEARCH_COUNTRIES = [...GROUP_A, ...GROUP_C] as [string, ...string[]];
const PRODUCT_COUNTRIES = [...GROUP_A, ...GROUP_B, ...GROUP_C, "uk"] as [string, ...string[]];
const PRICES_COUNTRIES = [...GROUP_A, ...GROUP_B, "uk"] as [string, ...string[]];
const LANGUAGES = ["en", "ja", "ko", "de", "es", "fr", "id", "it", "nl", "th", "vi", "zh-Hant", "zh-Hans"] as const;
const SORTS_A = ["featured", "newest", "price_asc", "price_desc", "top_rated"] as const;
const SEARCH_SORTS = [...SORTS_A, "best_selling"] as const;
const GENDERS = ["women", "men", "kids", "baby"] as const;
const FLAGS = ["sale", "limited_offer", "new", "new_color", "coming_soon", "online_only"] as const;
const REVIEW_SORTS = ["newest", "oldest", "most_helpful", "highest", "lowest"] as const;
const PRICES_DEFAULT = "jp, us, gb, de, fr, kr, au, ca, sg, th";

const MARKET_LIST = (codes: readonly string[]) =>
  codes
    .map((c) => {
      const [currency, ...langs] = MARKETS[c]!.split(" ");
      return `${c} (${currency}; ${langs.join(", ")})`;
    })
    .join(", ");
const MARKETS_TEXT = `Markets (country; language, default the first listed): every tool on ${MARKET_LIST(GROUP_A)}; search + product on Uniqlo's Greater China sites ${MARKET_LIST(GROUP_C)}; product + prices on ${MARKET_LIST(GROUP_B)}. gb is the United Kingdom (uk accepted); at, bg, cz, ee, fi, gr, hr, hu, ie, lt, lu, lv, pl, pt, ro, si and sk are Uniqlo's EU store (EUR, English). Countries with no Uniqlo online store (ch, no, nz, mx, tr, ae, il, ru), markets a tool does not serve and languages a market does not serve (dk da, se sv, us es, jp en, kr en, in hi, my ms) answer 400 before anything is charged. Every answer carries country, language and currency.`;
const A_MARKETS =
  "Markets: us (USD, en), jp (JPY, ja), kr (KRW, ko) only; other markets answer 400 before anything is charged. Every answer carries country, language and currency.";
const PRICES =
  "Prices are numbers in the market's own currency, never converted: price is Uniqlo's regular price, promo_price its promotional price. On us, jp and kr Uniqlo shows a sale or limited-time-offer drop only as a flag (promo_price equals price there): on_sale, limited_offer (start, end) and price_flags (code, name, start, end, ISO dates) carry it. Europe and Southeast Asia show promo_price below price. No price history: poll and store your own.";
const IDS =
  "Product ids (e.g. E479000-000) are global on uniqlo.com: the same id opens the product in every market that sells it. Uniqlo's Greater China sites (tw, hk, cn) use their own codes (u0000000055478), not valid elsewhere.";
const ITEM =
  "product_id, price_group, title (in the request language), url, gender, price, promo_price, currency, discount_percent, on_sale, limited_offer, price_flags, flags (Uniqlo's raw flag codes), colors (code, display_code, name), sizes (code, name), lengths, rating, review_count, image, store_only";
const LIST = "total, count, page, page_size, has_more, sort, facets";
const charge = (cost: string) => `Costs ${cost}. Failed upstream calls are not charged; a not-found is charged.`;
const ONE = charge("1 credit");

const country = (markets: readonly string[], description: string) =>
  z.enum(markets as unknown as [string, ...string[]]).optional().describe(description);
const aCountry = () => country(GROUP_A, "Uniqlo market (default us): us, jp or kr.");
const language = () =>
  z.enum(LANGUAGES).optional()
    .describe("Language of the market as Uniqlo offers it (default the local language): us en; jp ja; kr ko; be nl, fr, en; ca en, fr; de, es, fr, it, nl their language or en; id id, en; th th, en; vn vi, en; tw and hk zh-Hant; cn zh-Hans; en elsewhere. Titles, descriptions and colour names come back in it.");
const productId = () =>
  z.string().min(6).max(20)
    .describe("A Uniqlo product id (items[].product_id): E + 6 digits + -000 on uniqlo.com (e.g. 'E479000-000'), the same in every market; u + 13 digits on tw, hk and cn.");
const priceGroup = () => z.string().min(2).max(2).optional().describe("Price group (items[].price_group, default 00).");
const page = () => z.number().int().min(1).max(500).optional().describe("Results page, 1-based.");
const pageSize = () =>
  z.number().int().min(1).max(100).optional()
    .describe("Items per page, 1 to 100 (default 24; 48 at most on tw, hk, cn). Uniqlo answers up to offset 500.");
const aSort = () =>
  z.enum(SORTS_A).optional().describe("featured (default, Uniqlo's order), newest, price_asc, price_desc or top_rated.");
const gender = () => z.enum(GENDERS).optional().describe("women, men, kids or baby.");
const flag = () =>
  z.enum(FLAGS).optional()
    .describe("Only items Uniqlo flags: sale, limited_offer, new, new_color, coming_soon, online_only (jp only).");
const categoryPath = () =>
  z.union([z.string().min(3).max(60), z.array(z.string().min(3).max(10)).min(1).max(4)])
    .describe("Category path: 1 to 4 ids (gender, class, category, subcategory), a node's path from get_uniqlo_categories, comma-joined or as an array. Ids are per market ('22210,23296,23339' is women > bottoms > jeans on us).");
const lat = () =>
  z.number().min(-90).max(90).describe("Latitude of a point in the country (40.758 New York, 35.6595 Tokyo, 37.5636 Seoul).");
const lng = () =>
  z.number().min(-180).max(180).describe("Longitude (-73.9855 New York, 139.7005 Tokyo, 126.9826 Seoul).");
const limit = () => z.number().int().min(1).max(10).optional().describe("Stores, 1 to 10 (default 10).");

export function registerUniqloTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/uniqlo/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_uniqlo",
    `Search Uniqlo's catalogue by keyword. On us, jp, kr: items (${ITEM}), total, count, page, page_size (up to 100), has_more, sort (featured, newest, price_asc, price_desc, top_rated), filters gender, category_path (ids from get_uniqlo_categories), flag, color, size, price_min / price_max, facets (colors, sizes, lengths, flags with counts, price ranges, genders / classes / categories) and related_keywords. On tw (TWD), hk (HKD) and cn (CNY), Uniqlo's Greater China catalogue in Chinese: items (product_id u-code, style_code, title, url, gender, price, promo_price, max_price, discount_percent, on_sale, limited_offer, colors and sizes as codes, rating, review_count, in_stock, season, image), total, sorts featured, newest, price_asc, price_desc, best_selling, price_min / price_max. Not served on Uniqlo's other storefronts (use get_uniqlo_product and get_uniqlo_prices there). ${PRICES} ${IDS} ${MARKETS_TEXT} ${ONE}`,
    {
      query: z.string().min(1).max(200).describe("Search keywords in the market's language (Chinese on tw, hk, cn), e.g. 'heattech'."),
      country: country(SEARCH_COUNTRIES, "Uniqlo market (default us): us, jp, kr, tw, hk or cn."),
      language: language(),
      page: page(),
      page_size: pageSize(),
      sort: z.enum(SEARCH_SORTS).optional()
        .describe("featured (default, Uniqlo's order), newest, price_asc, price_desc, top_rated (us, jp, kr), best_selling (tw, hk, cn)."),
      gender: gender(),
      category_path: categoryPath().optional(),
      flag: flag(),
      color: z.string().min(2).max(5).optional().describe("Colour code from facets.colors (e.g. COL09) or its 2-digit display code (09)."),
      size: z.string().min(6).max(6).optional().describe("Size code from facets.sizes (e.g. SMA004 = M, INS030 = 30 inch)."),
      price_min: z.number().min(0).optional().describe("Lowest price, in the market's currency."),
      price_max: z.number().min(0).optional().describe("Highest price, in the market's currency."),
    },
    post("search"),
  );

  server.tool(
    "get_uniqlo_product",
    `One Uniqlo product by product_id or link, on 41 markets: product_id, price_group, title, description, information, design_details, composition, washing, care, countries_of_origin, gender, category (gender, class, category, subcategory with ids), price, promo_price, currency, discount_percent, on_sale, limited_offer, price_flags, lowest_price_30d (the 30-day lowest price Uniqlo shows next to a discount in Europe), tax, flags, colors (code, name, image), sizes, lengths, rating (average, count, fit 1 tight to 5 loose, distribution), review_count, images, size_chart_url, tags, best_seller, discontinued. On us, jp, kr also variants (l2_id, sku, color, size, length, price, promo_price, price_flags; per-size stock is get_uniqlo_stock). On tw, hk, cn the Greater China product (title, price, promo_price, limited_offer, colours, sizes, rating, images; variants with per-SKU online stock on tw and hk). A product a market does not sell answers 404 (charged). Ratings are Uniqlo's per region: the European markets share one pool. Not available: price history, store-level prices, GU (Uniqlo's sister brand). ${PRICES} ${IDS} ${MARKETS_TEXT} ${ONE}`,
    {
      product_id: productId().optional(),
      url: z.string().min(10).max(600).optional()
        .describe("A Uniqlo product link from any market (https://www.uniqlo.com/<country>/<language>/products/<id>/<price group>, or a tw / hk / cn product link): its market is used unless country is sent. One of product_id or url."),
      price_group: priceGroup(),
      country: country(PRODUCT_COUNTRIES, "Uniqlo market (default us): any of the 41 markets; gb (or uk) for the United Kingdom."),
      language: language(),
    },
    post("product"),
  );

  server.tool(
    "get_uniqlo_stock",
    `Online stock of every variant of a product (colour x size x length): product_id, title, variants (l2_id, sku, color, size, length with code and name, status in_stock / low_stock / out_of_stock as Uniqlo states it, status_raw, quantity, quantity_capped, back_in_stock, in_transit, sold_online, price, promo_price, on_sale, price_flags), variants_total, variants_in_stock. Online stock, not store stock (get_uniqlo_store_stock answers per store). Uniqlo caps the quantity it shows at 11 (quantity_capped true means 11 or more). Pass a variant's l2_id to get_uniqlo_store_stock. An unknown product answers 404 (charged). ${A_MARKETS} ${ONE}`,
    {
      product_id: productId(),
      price_group: priceGroup(),
      country: aCountry(),
      language: language(),
    },
    post("stock"),
  );

  server.tool(
    "get_uniqlo_store_stock",
    `Stock of one variant in the Uniqlo stores nearest a point: l2_id, point, stores (store_code, name, distance_km, status in_stock / low_stock / out_of_stock as Uniqlo states it, status_raw, store_status, order_and_pick, sections; no unit counts per store), count, stores_with_stock, total_stores. By l2_id (variants[].l2_id of get_uniqlo_stock or get_uniqlo_product) or by product_id + color + size (+ length), resolved through the product's variant list. Store stock, not online stock; many stores answer out_of_stock, which is Uniqlo's real answer. ${A_MARKETS} ${charge("1 credit with l2_id, 2 with product_id + color + size (the variant lookup, then the store stock)")}`,
    {
      l2_id: z.string().min(8).max(8).optional()
        .describe("Variant id (variants[].l2_id of get_uniqlo_stock or get_uniqlo_product), e.g. '08665900'. One of l2_id or product_id + color + size."),
      product_id: productId().optional(),
      price_group: priceGroup(),
      color: z.string().min(2).max(5).optional().describe("With product_id: colour code (colors[].code, e.g. COL67)."),
      size: z.string().min(6).max(6).optional().describe("With product_id: size code (sizes[].code, e.g. INS028)."),
      length: z.string().min(6).max(6).optional()
        .describe("With product_id, when the product comes in lengths: length code (lengths[].code)."),
      lat: lat(),
      lng: lng(),
      limit: limit(),
      country: aCountry(),
      language: language(),
    },
    post("store-stock"),
  );

  server.tool(
    "get_uniqlo_stores",
    `Uniqlo stores nearest a point, or one store by store_id: point, stores (store_id, store_code, name, address, postal_code, city, region, country, lat, lng, distance_km, phone, opening_hours (mon to sun open / close), today, status, store_type, open_date, click_and_collect, inventory_shown, pickup_location, sections, services, accessibility), count, total (every store of the market), page, limit, has_more. ${A_MARKETS} ${ONE}`,
    {
      lat: lat().optional(),
      lng: lng().optional(),
      store_id: z.string().min(4).max(10).optional().describe("One store by id (stores[].store_id). One of lat + lng or store_id."),
      limit: limit(),
      page: z.number().int().min(1).max(100).optional().describe("Results page, 1-based."),
      country: aCountry(),
      language: language(),
    },
    post("stores"),
  );

  server.tool(
    "get_uniqlo_reviews",
    `Customer reviews of a product: product_id, rating (average, count, fit average, distribution 1 to 5), reviews (review_id, rating, title, text, created_at ISO, fit 1 tight to 5 loose with fit_label (null when the reviewer gave none), purchased_size, purchased_color, height_range, weight_range, age_range, gender, shoe_size, helpful_count, incentivized, syndicated), total, count, page, page_size (up to 25), has_more, sort. Reviewer names and locations are not returned. Review totals are pooled per region as Uniqlo shows them. An unknown product answers 404 (charged). ${A_MARKETS} ${ONE}`,
    {
      product_id: productId(),
      page: z.number().int().min(1).max(1000).optional().describe("Results page, 1-based."),
      page_size: z.number().int().min(1).max(25).optional().describe("Reviews per page, 1 to 25 (default 10)."),
      sort: z.enum(REVIEW_SORTS).optional().describe("newest (default), oldest, most_helpful, highest or lowest."),
      country: aCountry(),
      language: language(),
    },
    post("reviews"),
  );

  server.tool(
    "get_uniqlo_suggestions",
    `Uniqlo search suggestions for a partial query, in the market's language: suggestions (text), categories (id usable in category_path, title, gender and parent with ids), features (Uniqlo's feature pages, title and url), count. With no query: trending (Uniqlo's trending search words: text, type, url). ${A_MARKETS} ${ONE}`,
    {
      query: z.string().max(100).optional()
        .describe("What the shopper has typed so far, e.g. 'jea'. Empty or absent: Uniqlo's trending search words."),
      country: aCountry(),
      language: language(),
    },
    post("suggestions"),
  );

  server.tool(
    "get_uniqlo_category",
    `Every product of one category path (gender[, class[, category[, subcategory]]] ids from get_uniqlo_categories), paged and sorted: category_path, items (${ITEM}), ${LIST}, optional flag. ${PRICES} ${A_MARKETS} ${ONE}`,
    {
      category_path: categoryPath(),
      country: aCountry(),
      language: language(),
      page: page(),
      page_size: pageSize(),
      sort: aSort(),
      flag: flag(),
    },
    post("category"),
  );

  server.tool(
    "get_uniqlo_deals",
    `Uniqlo's sale (type sale) or limited-time offers (type limited_offer) of a market, optionally for one gender: type, gender, items (${ITEM}) with limited_offer start / end where Uniqlo shows them, ${LIST}. ${PRICES} ${A_MARKETS} ${ONE}`,
    {
      type: z.enum(["sale", "limited_offer"]).optional()
        .describe("sale (default: items flagged Sale) or limited_offer (items flagged Limited-Time Offer)."),
      gender: gender(),
      country: aCountry(),
      language: language(),
      page: page(),
      page_size: pageSize(),
      sort: aSort(),
    },
    post("deals"),
  );

  server.tool(
    "get_uniqlo_new_arrivals",
    `Items Uniqlo flags New on a market, optionally for one gender: gender, items (${ITEM}), ${LIST}. ${PRICES} ${A_MARKETS} ${ONE}`,
    {
      gender: gender(),
      country: aCountry(),
      language: language(),
      page: page(),
      page_size: pageSize(),
      sort: aSort(),
    },
    post("new-arrivals"),
  );

  server.tool(
    "get_uniqlo_categories",
    `The category tree of a Uniqlo market in its language: nodes (id, name, key, level 1 gender / 2 class / 3 category / 4 subcategory, gender_id, parent_id, path: the ids to pass as category_path to search_uniqlo or get_uniqlo_category), count. Optional gender filter and include_subcategories. Ids are per market. ${A_MARKETS} ${ONE}`,
    {
      gender: gender(),
      include_subcategories: z.boolean().optional()
        .describe("Add the subcategory level (a much larger answer). Default false."),
      country: aCountry(),
      language: language(),
    },
    post("categories"),
  );

  server.tool(
    "get_uniqlo_prices",
    `Uniqlo prices by country: one uniqlo.com product across up to 10 markets in one call (default ${PRICES_DEFAULT}): product_id, price_group, markets (country, language, currency, available, title, product_id, price, promo_price, discount_percent, on_sale, limited_offer, price_flags, lowest_price_30d (Europe), tax, url), not_sold (the markets that do not sell it), errors (markets that failed, not charged), count. Each price is in that market's own currency and never converted. Any of the 38 uniqlo.com markets (us, jp, kr and the product + prices storefronts listed in search_uniqlo); Greater China (tw, hk, cn) uses its own product codes and is not offered here. ${PRICES} ${IDS} Costs 1 credit per market that answered (a market that does not sell the product answers too). Failed markets are not charged.`,
    {
      product_id: productId(),
      price_group: priceGroup(),
      countries: z.array(z.enum(PRICES_COUNTRIES)).min(1).max(10).optional()
        .describe(`1 to 10 markets (default ${PRICES_DEFAULT}); gb (or uk) for the United Kingdom.`),
      language: language().describe("Language for the titles where the market serves it (else the market's default)."),
    },
    post("prices"),
  );
}
