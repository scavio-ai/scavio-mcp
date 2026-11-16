import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/asos.ts (asos.com: 235 countries in ASOS's
// own country selector, served by 13 ASOS stores: 11 with a site of their own
// in their own language plus ASOS's European and international stores, 245
// country-currency combinations). country is a plain ISO-2 string rather than
// an enum: 235 values would add ~1.5KB to every tool, and the backend answers
// 400 (before anything is charged) for a country or currency ASOS does not
// list. Cross-field rules the backend enforces and zod here does not: product
// takes exactly one of product_id, group_id or url; currency must be one ASOS
// offers the country; facet values come from an earlier answer's facets. No
// zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "newest", "price_asc", "price_desc"] as const;
const REVIEW_SORTS = ["relevance", "newest", "oldest", "rating_desc", "rating_asc"] as const;
const GENDERS = ["women", "men", "unisex"] as const;
const SECTIONS = ["women", "men"] as const;
const COLORS = [
  "red", "green", "blue", "black", "white", "yellow", "orange", "purple", "pink", "brown", "gold", "silver",
  "copper", "grey", "multi", "navy", "neutral",
];
const RANGES = ["plus", "petite", "tall", "maternity", "hourglass", "wide_fit", "fuller_bust"];

const CHARGE = "Costs 1 credit. Failed upstream calls are not charged; a not-found is charged.";
const MARKETS =
  "Markets: 235 countries in ASOS's own country selector, served by 13 ASOS stores: gb (GBP, English), us and pr (USD, en-US), fr and mc (EUR; French; the French overseas territories in USD), de and at (EUR, German), es and ad (EUR, Spanish), it, sm and va (EUR, Italian), au (AUD), dk (DKK, Danish), nl (EUR, Dutch), pl (PLN, Polish), se (SEK, Swedish); \"europe\" (ASOS's European store, English: ie, pt, be, lu, fi, gr, cz, hu, ro, bg, hr, si, sk, ee, lv, lt, cy, mt (EUR), no (NOK), fo and gl (DKK), am, ge, kz, kg and ba (GBP) ...) and \"international\" (English: ca (CAD), mx, in, za (USD), ch (CHF), nz (NZD), ae (AED or GBP), sa (SAR or GBP), hk (HKD or GBP), il (ILS, GBP or USD), jp and kr (USD or GBP), sg, tw, cn and 150 more). get_asos_markets lists every country with its store, language and currencies. Russia and Belarus are held (ASOS is not selling there). Every answer carries country, currency, store and language.";
const SEE_MARKETS =
  "Any of the 235 countries ASOS sells in (listed in the search_asos description and by get_asos_markets). Every answer carries country, currency, store and language.";
const PRICES =
  "Prices are numbers in the request's currency, never converted, as ASOS sets them for that country: countries served by the same ASOS store in the same currency share one price list, except Ireland, which has its own euro prices on ASOS's European store (measured 2026-11-16 on all 245 country-currency combinations). Which products are offered still differs by country. price is the lowest size price when ASOS prices sizes differently (variants carry each size's price): price, previous_price (a markdown, above price), rrp, lowest_price_30d (when ASOS shows it), is_marked_down, is_outlet, discount_percent and discount_basis (previous_price or rrp). No price history: poll get_asos_stock or get_asos_product.";
const IDS =
  "Product and category ids are global: the same id on every store; titles come back in the store's language; prices follow the country's ASOS price list and availability differs by country.";
const ITEM =
  "product_id, product_type (product, group, group_piece), group_id, title, brand, color, url, the prices, currency, selling_fast, restocking_soon, is_new, sponsored, color_product_ids (the other colours' product ids), image, images and video";
const FILTERS = `Filters: gender (women, men, unisex), brand (brand facet ids), color (${COLORS.slice(0, 6).join(", ")} ... or base_colour ids), size, range (${RANGES.join(", ")}), product_type, price_min / price_max, on_sale, and facets (any other facet id -> value ids of an earlier answer).`;

const country = (description = "Country (default gb), ISO-2 lower case (gb for the United Kingdom, not uk): any country ASOS sells in (see get_asos_markets). Russia, Belarus and countries ASOS does not list answer 400 before anything is charged.") =>
  z.string().length(2).optional().describe(description);
const currency = () => z.string().length(3).optional()
  .describe("ISO-4217 currency (default: ASOS's own default for the country). Any currency ASOS offers the country is accepted (e.g. ae: AED or GBP; il: ILS, GBP or USD; jp: USD or GBP); others answer 400 listing the allowed ones.");
const ids = (description: string) =>
  z.union([z.string().min(1).max(200), z.array(z.string().min(1).max(12)).min(1).max(30)]).optional().describe(description);
const productId = () => z.string().min(6).max(10)
  .describe("An ASOS product id (items[].product_id of any answer, the number after /prd/ in a link), e.g. '210309625'. The same id on every store.");
const page = () => z.number().int().min(1).max(1000).optional().describe("Results page, 1-based.");
const pageSize = () => z.number().int().min(1).max(200).optional().describe("Items per page, 1 to 200 (default 72).");
const sort = () => z.enum(SORTS).optional().describe("relevance (default, ASOS's own order), newest, price_asc or price_desc.");
const section = (dflt: string | null) => z.enum(SECTIONS).optional()
  .describe(`women or men${dflt ? ` (default ${dflt})` : " (default: both)"}.`);

const gridFilters = {
  brand: ids("Brand: value ids of the brand facet of an earlier search or category answer (e.g. '53' ASOS DESIGN, '401' Levi's); several are ORed. Not brands[].brand_id (that is a category id: use get_asos_category)."),
  color: ids(`Colour: ${COLORS.join(", ")}, or value ids of the base_colour facet; several are ORed.`),
  size: ids("Size: value ids of the size facet of an earlier answer (e.g. '279' XS); several are ORed."),
  range: ids(`Body-fit range: ${RANGES.join(", ")} (or value ids of the Body Fit facet, attribute_10155).`),
  product_type: ids("Product type: value ids of the Product Type facet (attribute_1047) of an earlier answer (e.g. '8393' Jeans)."),
  price_min: z.number().min(0).optional().describe("Lowest price, in the request's currency."),
  price_max: z.number().min(0).optional().describe("Highest price, in the request's currency."),
  facets: z
    .record(z.string(), z.union([z.string().min(1).max(24), z.array(z.string().min(1).max(24)).min(1).max(30)]))
    .optional()
    .describe("Any other facet of an earlier answer: { facet id: value id or [value ids] }, e.g. { \"attribute_1046\": \"8310\", \"discount_band\": [\"5\", \"6\"] } (facets[].id and facets[].values[].id)."),
};
const onSale = z.boolean().optional().describe("Only sale items (ASOS's Sale facet).");
const gender = z.enum(GENDERS).optional().describe("women, men or unisex (ASOS's Gender facet).");

export function registerAsosTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/asos/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_asos",
    `Search one ASOS store by keyword: items (${ITEM}), total, max_reachable, page, page_size (up to 200, default 72), has_more, sort (relevance, newest, price_asc, price_desc), sorts_offered, filters, facets (id, name, values with id, name and count) and price_range. ${FILTERS} ASOS serves keyword results only up to position 2,088 whatever total says (max_reachable; a page past it answers 400 before anything is charged): narrow with filters or use get_asos_category. ${PRICES} ${IDS} ${MARKETS} ${CHARGE}`,
    {
      query: z.string().min(1).max(200).describe("Search keywords (in the store's language or English), e.g. 'jeans'."),
      country: country(),
      currency: currency(),
      page: page(),
      page_size: pageSize(),
      sort: sort(),
      gender,
      ...gridFilters,
      on_sale: onSale,
    },
    post("search"),
  );

  server.tool(
    "get_asos_product",
    `One ASOS product by product_id or link: product_id, product_code, title, brand, brand_id, gender, product_kind, url, category and breadcrumbs, category_ids, description, product_details, brand_description, composition, care, size_and_fit (model height and size worn as ASOS shows it), fit, country_of_manufacture, color, color_products (product_id, color, title, url, image of each other colour: each colour is its own product id), the prices, price_since, in_stock, selling_fast, is_discontinued, variants (variant_id, size, brand_size, size_id, color, sku, ean, price, previous_price, in_stock, low_stock, restocking_soon, seller: online stock per size), rating (average, count, distribution, recommended_percent, fit and quality), ai_summary (ASOS's own AI summary of reviews), images and video. A co-ord set (group_id, a /grp/ link, or the id of one of its pieces) answers the group: items[] with each piece's variants, stock and price. An unknown id, or a product the store does not sell, answers 404 (charged). Not available: an outlet, promo codes (shown only to signed-in shoppers), store locator (ASOS has no physical stores), price history, checkout and delivery prices. ${PRICES} ${IDS} ${SEE_MARKETS} ${CHARGE}`,
    {
      product_id: productId().optional(),
      group_id: z.string().min(6).max(10).optional()
        .describe("An ASOS co-ord group id (items[].group_id of a group or group_piece item, the number after /grp/ in a link)."),
      url: z.string().min(10).max(600).optional()
        .describe("An ASOS product link (https://www.asos.com/<store>/<brand>/<slug>/prd/<id>, or /grp/<id>) from any store: its store's country is used unless country is sent."),
      country: country(),
      currency: currency(),
    },
    post("product"),
  );

  server.tool(
    "get_asos_stock",
    `Price and online stock of up to 100 ASOS products in one call: per product product_id, the prices, price_since, in_stock, restocking_soon and variants (variant_id, in_stock, low_stock, restocking_soon, price, previous_price, seller); not_found lists the ids the store does not sell. Online stock: ASOS has no physical stores. Variants carry ids, not size names: map variant_id to its size with get_asos_product. ${PRICES} ${IDS} ${SEE_MARKETS} ${CHARGE}`,
    {
      product_ids: z
        .union([z.string().min(6).max(1200), z.array(z.string().min(6).max(10)).min(1).max(100)])
        .describe("1 to 100 ASOS product ids (a list or comma-separated), e.g. ['205338218', '206956133', '209793673']."),
      country: country(),
      currency: currency(),
    },
    post("stock"),
  );

  server.tool(
    "get_asos_reviews",
    `Customer reviews of one ASOS product on one store, paged (up to 50 per page): summary (average, count, ratings_only_count, distribution, recommended counts and percent, fit and quality averages), ai_summary (ASOS's own AI-generated summary, labelled), reviews (id, rating, title, text, date, experience_date, ratings_only, recommended, fit and quality with ASOS's label such as True to Size, color, verified_purchaser, language, syndicated, source, photos), total, page, has_more. Which reviews come back depends on the store: gb, us, au and ASOS's European and international stores share one English review pool; es, it, nl, se, dk and pl add reviews written in their own language to that pool; fr and de show only reviews written in French or German (each review carries its language; totals differ by store). Reviewer names are never returned. ${SEE_MARKETS} ${CHARGE}`,
    {
      product_id: productId(),
      country: country(),
      currency: currency(),
      page: z.number().int().min(1).max(500).optional().describe("Results page, 1-based."),
      page_size: z.number().int().min(1).max(50).optional().describe("Reviews per page, 1 to 50 (default 10)."),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("relevance (default, ASOS's own order), newest, oldest, rating_desc or rating_asc."),
      rating: z.number().int().min(1).max(5).optional().describe("Only reviews with this star rating (1 to 5)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_asos_suggestions",
    `ASOS search suggestions for what a shopper has typed, in the store's language: suggestions (text, count = ASOS's number of results). Not served on pl (ASOS's Polish store answers no search suggestions; use search_asos). ${SEE_MARKETS} ${CHARGE}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. 'dre'."),
      country: country("Country (default gb), ISO-2 lower case (gb for the United Kingdom, not uk): any country ASOS sells in except pl (see get_asos_markets). Russia, Belarus and countries ASOS does not list answer 400 before anything is charged."),
      currency: currency(),
    },
    post("suggestions"),
  );

  server.tool(
    "get_asos_category",
    `Every product of one ASOS category (a category_id from get_asos_categories, or a brand's brand_id from get_asos_brands: a brand page is a category), paged and sorted (category lists page through everything, no 2,088 cap): category_id, category_name (in the store's language), items (${ITEM}), total, page, page_size (up to 200), has_more, sort, facets and price_range. ${FILTERS} An unknown category id answers 404 (charged). ${PRICES} ${IDS} ${SEE_MARKETS} ${CHARGE}`,
    {
      category_id: z.string().min(1).max(8)
        .describe("An ASOS category id (categories[].category_id of get_asos_categories, or brand_id of get_asos_brands), the same on every store: e.g. '8799' women's dresses, '7046' women's sale."),
      country: country(),
      currency: currency(),
      page: page(),
      page_size: pageSize(),
      sort: sort(),
      gender,
      ...gridFilters,
      on_sale: onSale,
    },
    post("category"),
  );

  server.tool(
    "get_asos_categories",
    `The ASOS store's navigation (as its desktop menu shows it) for women and men, in the store's language: sections (gender, name, url, categories, count), each category node with name, category_id (null on headings), url, path and children. Category ids are the same on every store. ${SEE_MARKETS} ${CHARGE}`,
    {
      country: country(),
      currency: currency(),
      gender: section(null),
    },
    post("categories"),
  );

  server.tool(
    "get_asos_brands",
    `The ASOS store's A-Z brand list for women or men (default women): brands (brand_id, name, url, letter), count, title. brand_id is the brand's ASOS category id: pass it to get_asos_category as category_id for the brand's products (the search_asos brand filter takes the brand facet ids of a search answer instead). ${SEE_MARKETS} ${CHARGE}`,
    {
      country: country(),
      currency: currency(),
      gender: section("women"),
    },
    post("brands"),
  );

  const listFields = {
    country: country(),
    currency: currency(),
    gender: section("women"),
    page: page(),
    page_size: pageSize(),
    sort: sort(),
    ...gridFilters,
  };

  server.tool(
    "get_asos_deals",
    `The ASOS store's SALE category for women (7046) or men (8409), default women (the same ids on every store): items (${ITEM}) with previous_price and discount_percent, marked_down, total, paging, sort, facets and the filters of get_asos_category. No outlet (ASOS's outlet categories are empty) and no promo codes (shown only to signed-in shoppers). ${PRICES} ${SEE_MARKETS} ${CHARGE}`,
    listFields,
    post("deals"),
  );

  server.tool(
    "get_asos_new_arrivals",
    `The ASOS store's NEW IN category for women (27108) or men (27110), default women: items (${ITEM}), total, paging, sort (newest for the latest first), facets and the filters of get_asos_category. ${PRICES} ${SEE_MARKETS} ${CHARGE}`,
    listFields,
    post("new-arrivals"),
  );

  server.tool(
    "get_asos_markets",
    `Every country in ASOS's live country selector: country, name, store (gb, us, fr, de, es, it, au, dk, nl, pl, se, europe, international), language, currencies (the first is ASOS's default for the country), default_currency, size_schema and served (false for Russia and Belarus, with the reason); selected carries the requested country's live currencies (default gb). ${CHARGE}`,
    {
      country: country(),
      currency: currency(),
    },
    post("markets"),
  );
}
