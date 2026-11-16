import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/zara.ts (zara.com: 102 storefronts with an
// online store of their own, each in its own currency and Zara's own
// languages; cn is zara.cn, Zara's separate China site). Cross-field rules the
// backend enforces and zod here does not: language must be one the market
// serves (listed in MARKETS); search takes query or reference; product takes
// url, product_id + slug, or reference; store-stock takes store_ids or lat +
// lng; color and size values must come from the same market's facets. Every
// request is billed what it actually spent (credits_used in the answer). No
// zod `.default()`: the MCP SDK would post a defaulted field on every call.

// Storefront -> "<currency> <languages in Zara's order>" (the first is Zara's default).
const MARKETS: Record<string, string> = {
  ad: "EUR ca en fr es", ae: "AED en ar", al: "ALL sq en", am: "AMD ru hy en", ao: "EUR pt en",
  ar: "ARS es en", at: "EUR de en", au: "AUD en", aw: "AWG en es", az: "AZN ru en", ba: "BAM hr en",
  be: "EUR en nl fr", bg: "EUR bg en", bh: "BHD en ar", br: "BRL pt en", ca: "CAD en fr",
  ch: "CHF en fr de it", cl: "CLP es en", cn: "CNY zh en", co: "COP es en", cr: "CRC es en", cw: "XCG en",
  cy: "EUR el en", cz: "CZK cs en", de: "EUR de en", dk: "DKK da en", do: "DOP es en", dz: "DZD ar en fr",
  ec: "USD es en", ee: "EUR et en", eg: "EGP ar en", es: "EUR es en eu gl ca", fi: "EUR fi sv en",
  fr: "EUR fr en", gb: "GBP en", ge: "GEL en ka", gr: "EUR el en", gt: "GTQ es en", hk: "HKD en zh-Hant",
  hn: "HNL es en", hr: "EUR hr en", hu: "HUF hu en", ic: "EUR es en", id: "IDR id en", ie: "EUR en",
  il: "ILS he en", in: "INR en", iq: "IQD en", is: "ISK en", it: "EUR it en", jo: "JOD en ar", jp: "JPY ja en",
  kh: "KHR en", kr: "KRW ko en", kw: "KWD en ar", kz: "KZT ru kk en", lb: "LBP en ar", lt: "EUR lt en",
  lu: "EUR fr en de", lv: "EUR lv en", ma: "MAD fr en", mc: "EUR fr en", me: "EUR sr en", mk: "MKD mk sq en",
  mo: "MOP zh-Hant en", mt: "EUR en", mx: "MXN es en", my: "MYR en", ni: "NIO es en", nl: "EUR en nl",
  no: "NOK no en", nz: "NZD en", om: "OMR en ar", pa: "PAB es en", pe: "PEN es en", ph: "PHP en",
  pl: "PLN pl uk en", pr: "USD es en", pt: "EUR pt en", py: "PYG es en", qa: "QAR en ar", ro: "RON ro en",
  rs: "RSD sr en", sa: "SAR en", se: "SEK sv en", sg: "SGD en", si: "EUR sl en", sk: "EUR sk en",
  sv: "USD es en", th: "THB th en", tn: "TND fr ar en", tr: "TRY tr en", tw: "TWD zh-Hant en", ua: "UAH uk en",
  us: "USD en es", uy: "UYU es en", uz: "UZS uz en ru", ve: "USD es en", vn: "VND vi en", xe: "AED en",
  xk: "EUR sq en", za: "ZAR en",
};
const COUNTRIES = Object.keys(MARKETS) as [string, ...string[]];
const without = (drop: string[]) => COUNTRIES.filter((c) => !drop.includes(c)) as [string, ...string[]];
// Zara lists no stores in ao and iq.
const STORE_COUNTRIES = without(["ao", "iq"]);
// dz shows no new-arrivals category.
const NEW_ARRIVALS_COUNTRIES = without(["dz"]);
// No suggestions in the market's language, English not verified yet: use search_zara.
const SUGGESTIONS_COUNTRIES = without(["ad", "al", "am", "az", "ba", "dz", "mk", "mo", "uz", "xk"]);
const LANGUAGES = [
  "ar", "bg", "ca", "cs", "da", "de", "el", "en", "es", "et", "eu", "fi", "fr", "gl", "he", "hr", "hu", "hy",
  "id", "it", "ja", "ka", "kk", "ko", "lt", "lv", "mk", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sl", "sq",
  "sr", "sv", "th", "tr", "uk", "uz", "vi", "zh", "zh-Hant",
] as const;
const SORTS = ["relevance", "price_asc", "price_desc"] as const;
const SEARCH_SECTIONS = ["woman", "man", "kids", "home"] as const;
const CATEGORY_SECTIONS = ["woman", "man", "kids", "home", "beauty"] as const;
const TREE_SECTIONS = ["woman", "man", "girl", "boy"] as const;

const MARKET_LIST = Object.entries(MARKETS)
  .map(([c, v]) => {
    const [currency, ...langs] = v.split(" ");
    return `${c} (${currency}; ${langs.join(", ")})`;
  })
  .join(", ");
const MARKETS_TEXT = `Markets (country, default us; language, default the first listed, Zara's own default): ${MARKET_LIST}. gb is the United Kingdom, ic the Canary Islands, xe Abu Dhabi, Al Ain and Ras Al Khaimah, xk Kosovo. Belarus, uk (use gb) and the countries Zara serves only from its worldwide store answer 400 before anything is charged. Every answer carries country, language and currency.`;
const SEE_MARKETS = "Markets and the languages each serves are listed in the search_zara description; a language the market does not serve answers 400. Every answer carries country, language and currency.";
const IDS =
  "References are global on Zara's international site. A colour's product id is usually the same in every market but can differ, and China (cn) runs its own ids: match across markets with the reference.";
const PRICES =
  "Prices are numbers in the market's own currency, never converted: price, old_price (set only on a markdown, above price) and discount_percent. No price history: poll get_zara_prices or get_zara_product.";
const ITEM =
  "product_id, reference, display_reference, title (in the request language), url, seo_slug, section, family, subfamily, price, old_price, discount_percent, currency, availability, colors (product_id, color_id, name, price, old_price, discount_percent, availability, tags), additional_colors, tags and image";
const CN = "China (cn) costs 1 credit per call instead of 2.";
const CHARGE = `Failed upstream calls are not charged; a not-found is charged. ${CN}`;

const country = (markets: readonly string[], description: string) =>
  z.enum(markets as unknown as [string, ...string[]]).optional().describe(description);
const ALL_MARKETS = "Zara market (default us): any of the 102 storefronts; gb for the United Kingdom.";
const language = () => z.enum(LANGUAGES).optional()
  .describe("Language of the market (default Zara's own default for it). Titles, descriptions, colours and category names come back in it; a language the market does not serve answers 400.");
const productId = () => z.string().min(6).max(12)
  .describe("A Zara product id: the colour's product id (items[].product_id of any answer, the v1 of a product link), e.g. '553306790'. Global on Zara's international site; cn runs its own ids.");
const reference = () => z.string().min(8).max(12)
  .describe("A Zara reference as printed on the product page (display_reference of any answer), e.g. '4591/381'; '4591/381/800' names one colour.");
const page = () => z.number().int().min(1).max(100).optional().describe("Results page, 1-based.");
const pageSize = () => z.number().int().min(1).max(96).optional().describe("Items per page, 1 to 96 (default 24).");
const sort = () => z.enum(SORTS).optional().describe("relevance (default, Zara's own order), price_asc or price_desc.");
const lat = () => z.number().min(-90).max(90)
  .describe("Latitude of a point in the country, e.g. 40.7128 New York, 51.5072 London, 35.6762 Tokyo, 48.8566 Paris.");
const lng = () => z.number().min(-180).max(180)
  .describe("Longitude, e.g. -74.006 New York, -0.1276 London, 139.6503 Tokyo, 2.3522 Paris.");
const treeSection = () => z.enum(TREE_SECTIONS).optional().describe("woman (default), man, girl or boy.");

export function registerZaraTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/zara/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_zara",
    `Search one Zara market's catalogue by keyword, or look up a reference (all its colours; the answer adds sold_here): items (${ITEM}), count, total, page, page_size (up to 96, default 24), has_more, sort, sorts_offered, section, filters, facets (color and size values with counts; colours carry hex) and price_range. Optional section, sort (for some queries Zara answers in its own order and offers no price sort: then sorts_offered is empty and a note says so; cn takes no sort), color, size, price_min and price_max. ${PRICES} ${IDS} ${MARKETS_TEXT} Costs 2 credits. ${CHARGE}`,
    {
      query: z.string().min(1).max(200).optional().describe("Search keywords in any language, e.g. 'blazer'. One of query or reference."),
      reference: reference().optional(),
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
      section: z.enum(SEARCH_SECTIONS).optional().describe("woman, man, kids or home (default: every section)."),
      page: page(),
      page_size: pageSize(),
      sort: sort(),
      color: z.string().min(1).max(40).optional()
        .describe("Colour: one value of the color facet of an earlier answer in the same market (e.g. black)."),
      size: z.string().min(1).max(40).optional().describe("Size: one value of the size facet of an earlier answer (e.g. 38)."),
      price_min: z.number().min(0).optional().describe("Lowest price, in the market's currency."),
      price_max: z.number().min(0).optional().describe("Highest price, in the market's currency."),
    },
    post("search"),
  );

  server.tool(
    "get_zara_product",
    `One Zara product by link, product_id + slug, or reference: product_id, reference, display_reference, title, description, url, seo_slug, section, family, subfamily, first_visible_date, price, old_price, discount_percent, currency, composition (part, components with material and percent), and every colour (color_id, name, hex, product_id, reference, prices, promotions with name, start and end, sizes with size_id, name, sku, availability (online stock: in_stock, out_of_stock, low_on_stock, coming_soon as Zara states it) and demand, tags, store_stock_available, images, url) and color_count. A product id alone does not open a Zara product page: send its slug (items[].seo_slug of a search answer), a url or a reference. Not available: reviews (Zara shows none), price history, Inditex's other brands. An unknown product answers 404 (charged). ${PRICES} ${IDS} ${MARKETS_TEXT} Costs 2 credits; 4 when the slug is another market's or language's (Zara's own link is followed once) or when opened by reference; 6 for both. ${CHARGE}`,
    {
      url: z.string().min(10).max(600).optional()
        .describe("A Zara product link (https://www.zara.com/<country>/<language>/<slug>-p<8 digits>.html?v1=<product id>), from any market: its market is used unless country is sent."),
      product_id: productId().optional(),
      slug: z.string().min(9).max(300).optional()
        .describe("The product's slug (items[].seo_slug of a search answer), e.g. '100-wool-suit-blazer-p04591381'; goes with product_id."),
      reference: reference().optional(),
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
    },
    post("product"),
  );

  server.tool(
    "get_zara_materials",
    `Composition, care and origin of a Zara product as its product page states them, in the market's language: title, composition (part, components with material and percent), sustainable_materials, certifications (name, description, certified_by, lines), care (notes, instructions, icons), origin (the country of production as Zara states it, e.g. "Made in Bangladesh") and, on fr, traceability (each production step and its country). Zara names no factories. An unknown product answers 404 (charged). ${SEE_MARKETS} Costs 2 credits. ${CHARGE}`,
    {
      product_id: productId(),
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
    },
    post("materials"),
  );

  server.tool(
    "get_zara_stock",
    `Online availability per size of one Zara colour: product_id, skus (sku, availability as Zara states it: in_stock, out_of_stock, low_on_stock, coming_soon), sizes_total and sizes_in_stock. Online stock, not store stock (get_zara_store_stock answers units per store). Match sku to get_zara_product's colors[].sizes[].sku for the size name. An unknown product answers 404 (charged). ${SEE_MARKETS} Costs 2 credits. ${CHARGE}`,
    {
      product_id: productId(),
      country: country(COUNTRIES, ALL_MARKETS),
    },
    post("stock"),
  );

  server.tool(
    "get_zara_stores",
    `Zara stores near a point of the country, nearest first: stores (store_id, kind, type, address_lines, city, state, state_code, postal_code, country, country_code, lat, lng, distance_km, phones, opening_hours with 7 dated days of date, weekday, open, close, sections, services, pickup, online_store, status, timezone), count and total. Pass store_id values to get_zara_store_stock as store_ids. Every market except ao and iq (Zara lists no stores there). ${SEE_MARKETS} Costs 2 credits. ${CHARGE}`,
    {
      lat: lat(),
      lng: lng(),
      country: country(STORE_COUNTRIES, "Zara market (default us): any of the 102 storefronts except ao and iq."),
      language: language(),
    },
    post("stores"),
  );

  server.tool(
    "get_zara_store_stock",
    `Units of one Zara colour in physical stores, per size: stores (store_id, sizes with size_id, size, units, on_sale, sales_floor_units and stockroom_units, units_total, locations in the store with area, floor, section and zone, store), stores_checked, stores_with_stock and stores_without_stock. By up to 8 store_ids (from get_zara_stores) or by lat + lng (the 8 nearest stores, with their address). Store stock, not online stock. Every market except ao and iq (Zara lists no stores there). ${SEE_MARKETS} Costs 2 credits with store_ids, 4 with lat + lng (a stores lookup first). ${CHARGE}`,
    {
      product_id: productId(),
      store_ids: z.array(z.string().min(1).max(8)).min(1).max(8).optional()
        .describe("Up to 8 store ids (stores[].store_id of get_zara_stores), e.g. ['3904', '3862']. One of store_ids or lat + lng."),
      lat: lat().optional(),
      lng: lng().optional(),
      country: country(STORE_COUNTRIES, "Zara market (default us): any of the 102 storefronts except ao and iq."),
      language: language(),
    },
    post("store-stock"),
  );

  server.tool(
    "get_zara_categories",
    `The category tree of a Zara market in the request language: categories (id, name, section, parent_id, level, leaf, redirect_id (Zara's view-all list of a parent), key) and count. Pass a leaf: true id (or a parent's redirect_id) to get_zara_category. Category ids are shared across Zara's northern-hemisphere markets; au, za and br run their own catalogue and ids. ${SEE_MARKETS} Costs 2 credits. ${CHARGE}`,
    {
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
      section: z.enum(CATEGORY_SECTIONS).optional().describe("Only one part of the tree: woman, man, kids, home or beauty."),
    },
    post("categories"),
  );

  server.tool(
    "get_zara_category",
    `Every product of one Zara category (a leaf id from get_zara_categories), paged and sorted over the whole list: category_id, items (${ITEM}), count, total (exact), page, page_size, total_pages, has_more, sort, sorts_offered, on_sale and on_sale_count. The answer carries no category name (get_zara_categories has it). An unknown id answers 404 and a parent without products of its own answers 400 (both charged: use a leaf id, or the parent's redirect_id). ${PRICES} ${IDS} ${SEE_MARKETS} Costs 2 credits. ${CHARGE}`,
    {
      category_id: z.string().min(3).max(9)
        .describe("A Zara category id: a leaf: true id of get_zara_categories (or a parent's redirect_id), e.g. '2420896' (women's dresses on us)."),
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
      page: page(),
      page_size: pageSize(),
      sort: sort(),
      on_sale: z.boolean().optional().describe("Only marked-down items (with old_price)."),
    },
    post("category"),
  );

  server.tool(
    "get_zara_deals",
    `The market's SPECIAL PRICES category for a section (default woman), found in the market's live category tree on every call (Zara changes it when a sale starts): section, category_id, category_name, items (${ITEM}) with old_price and discount_percent, marked_down, on_sale_count, count, total, page, page_size, total_pages, has_more and sort. Zara runs seasonal sales and lists special prices between them; where Zara shows no special-prices category for the section the answer is 200 with no items and a note, not an error. On fr, be, lu, mc and iq Zara lists special prices without a previous price. ${PRICES} ${SEE_MARKETS} Costs 4 credits (the tree and the list); 2 when the market has no special-prices category. ${CHARGE}`,
    {
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
      section: treeSection(),
      page: page(),
      page_size: pageSize(),
      sort: sort(),
    },
    post("deals"),
  );

  server.tool(
    "get_zara_new_arrivals",
    `The market's NEW ARRIVALS > THE NEW category for a section (default woman), found in the market's live category tree on every call: section, category_id, category_name, items (${ITEM}), count, total, page, page_size, total_pages, has_more and sort. Every market except dz (Zara shows no new-arrivals category there). ${PRICES} ${SEE_MARKETS} Costs 4 credits (the tree and the list). ${CHARGE}`,
    {
      country: country(NEW_ARRIVALS_COUNTRIES, "Zara market (default us): any of the 102 storefronts except dz."),
      language: language(),
      section: treeSection(),
      page: page(),
      page_size: pageSize(),
      sort: sort(),
    },
    post("new-arrivals"),
  );

  server.tool(
    "get_zara_prices",
    `Zara prices by country: one reference across up to 10 markets in one call (default us, gb, es, de, fr, it, jp, kr, mx, pl): reference, markets (country, language, currency, available, title, price (the lowest current price among the reference's colours), old_price, discount_percent, product_id, url, colors), not_sold (the markets that do not sell it), errors (markets that failed, not charged) and count. Each price is in that market's own currency and never converted. ${IDS} Any of the 102 storefronts (see search_zara). Costs 2 credits per market that answered (1 on cn). Failed markets are not charged.`,
    {
      reference: reference(),
      countries: z.array(z.enum(COUNTRIES)).min(1).max(10).optional()
        .describe("1 to 10 markets (default us, gb, es, de, fr, it, jp, kr, mx, pl); gb for the United Kingdom."),
      language: language().describe("Language for the titles where the market serves it (else the market's default)."),
    },
    post("prices"),
  );

  server.tool(
    "get_zara_suggestions",
    `Zara search suggestions for what a shopper has typed, in the market's language: query, section, suggestions (text), count and language_used. Where Zara has no suggestions in the request language, the market's English suggestions are answered instead (language_used en, with a note). Not on ad, al, am, az, ba, dz, mk, mo, uz and xk (use search_zara there). ${SEE_MARKETS} Costs 2 credits, 4 when the English fallback is used. ${CHARGE}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. 'jea'."),
      country: country(SUGGESTIONS_COUNTRIES, "Zara market (default us): any of the 102 storefronts except ad, al, am, az, ba, dz, mk, mo, uz and xk."),
      language: language(),
      section: z.enum(SEARCH_SECTIONS).optional().describe("woman, man, kids or home (default: every section)."),
    },
    post("suggestions"),
  );
}
