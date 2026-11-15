import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/hm.ts (hm.com: 40 countries with an online
// store of their own plus H&M's shared English EUR store, 47 countries in
// all). Cross-field rules the backend enforces and zod here does not:
// language must be one the market serves (listed in MARKETS); product and
// production take article_code or url; stock takes article_code or
// product_code; lat and lng go together; facet filter values must come from
// the same market's facets. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const COUNTRIES = [
  "us", "ca", "mx", "gb", "ie", "de", "at", "ch", "fr", "be", "nl", "it", "es", "pt", "se", "fi", "dk", "no",
  "pl", "cz", "sk", "hu", "ro", "bg", "gr", "rs", "tr", "ua", "il", "hk", "mo", "tw", "jp", "kr", "in", "my",
  "ph", "sg", "vn", "au",
  "hr", "cy", "ee", "lv", "lt", "lu", "si",
] as const;
// Product pages are not served on mo, tw and the shared EU store countries.
const NO_PRODUCT = ["mo", "tw", "hr", "cy", "ee", "lv", "lt", "lu", "si"];
const PRODUCT_COUNTRIES = COUNTRIES.filter((c) => !NO_PRODUCT.includes(c));
// H&M lists no stores in Macau.
const STORE_COUNTRIES = COUNTRIES.filter((c) => c !== "mo");
const LANGUAGES = [
  "en", "fr", "es", "de", "it", "nl", "pt", "sv", "fi", "da", "no", "pl", "cs", "sk", "hu", "ro", "bg", "el",
  "sr", "tr", "uk", "he", "zh", "ja", "ko", "vi",
] as const;
const SORTS = ["relevance", "newest", "price_asc", "price_desc"] as const;
const DEPARTMENTS = ["women", "men", "kids", "baby", "home"] as const;

const charge = (n: number) => `Costs ${n} credit${n === 1 ? "" : "s"}. Failed upstream calls are not charged; a not-found is charged.`;
const CHARGE = charge(1);
const MARKET_LIST =
  "us (USD), ca (CAD; en or fr), mx (MXN; es), gb (GBP), ie (EUR; en), de and at (EUR; de), ch (CHF; de, fr or it), fr (EUR), be (EUR; nl or fr), nl, it, es, pt (EUR), se (SEK; sv), fi (EUR; fi or sv), dk (DKK; da), no (NOK), pl (PLN), cz (CZK; cs), sk (EUR), hu (HUF), ro (RON), bg (EUR), gr (EUR; el), rs (RSD; sr), tr (TRY), ua (UAH; uk), il (ILS; he), hk and mo (HKD; zh or en), tw (TWD; zh or en), jp (JPY; ja), kr (KRW; ko), in (INR), my (MYR), ph (PHP), sg (SGD) (en), vn (VND; vi), au (AUD); and hr, cy, ee, lv, lt, lu, si on H&M's shared English EUR store (the answer says store \"eu\")";
const MARKETS = `Markets (country, default us; language, default the market's first): ${MARKET_LIST}. Countries where H&M runs a separate site (ae, eg, id, th, br, cn) or has no online store, ru, and uk (use gb) answer 400 before anything is charged. Every answer carries country, language, currency, locale and store.`;
const CODES =
  "Article codes are global: the same 10-digit code (7-digit product code + 3-digit colour) in every market, so one code compares a price across markets with one call per country.";
const PRICES =
  "Prices are numbers in the market's currency: price (what a non-member pays now), regular_price, sale_price (a markdown), member_price (H&M's member price as shown to signed-in members; Scavio does not sign in), discount_percent, prior_price (the earlier price H&M shows next to a markdown in the EU). No price history: poll to track changes.";
const ITEM =
  "article_code, product_code, title (in the request language), brand, url, the prices, currency, promo_text, multipack (quantity, unit_price), color, colors (article_code, name, hex), sizes (size_code, label, in_stock: online stock), in_stock, coming_soon, new_arrival, markers, category (H&M's category id) and image";
const GRID = `items (${ITEM}), count, total, page, page_size (up to 72, default 36), total_pages, sort, sorts_offered, filters, facets (filter, name, values with value, label, count; color values carry hex), on_sale_count and price_range. Sorted by relevance, newest or price; filtered by color, size, material, fit, product_type and on_sale with the market's own facet values.`;

const country = (markets: readonly string[], description: string) =>
  z.enum(markets as unknown as [string, ...string[]]).optional().describe(description);
const language = () => z.enum(LANGUAGES).optional()
  .describe("Language of the market (default its first; the languages each market serves are listed under Markets in the tool description). Titles, descriptions, colours and facet values come back in it; a language the market does not serve answers 400.");
const ALL_MARKETS = "H&M market (default us): any of the 47 listed in the tool description.";

const values = (description: string) =>
  z.union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).min(1).max(10)]).optional().describe(description);
const gridFields = {
  page: z.number().int().min(1).max(200).optional().describe("Results page, 1-based."),
  page_size: z.number().int().min(1).max(72).optional().describe("Items per page, 1 to 72 (default 36)."),
  sort: z.enum(SORTS).optional().describe("relevance (default), newest, price_asc or price_desc."),
  color: values("Colour: one or more values of the color facet of an earlier answer in the same market (e.g. black_000000 on us, schwarz_000000 on de); several values are ORed."),
  size: values("Size: values of the size facet (e.g. womenswear;NO_FORMAT[Numeric];8)."),
  material: values("Material: values of the material facet (in the market's language, e.g. Cotton, Baumwolle)."),
  fit: values("Fit: values of the fit facet (e.g. Slim fit, Loose fit)."),
  product_type: values("Product type: values of the product_type facet (e.g. Jeans)."),
};
const onSale = () => z.boolean().optional().describe("Only marked-down items.");
const department = (dflt: string | null) => z.enum(DEPARTMENTS).optional()
  .describe(`women, men, kids, baby or home${dflt ? ` (default ${dflt})` : ""}.`);
const articleCode = () => z.string().min(10).max(10).optional()
  .describe("An H&M article code: 10 digits (7-digit product code + 3-digit colour), e.g. '1310382004'. The same code in every market.");
const url = () => z.string().min(10).max(500).optional()
  .describe("An hm.com product link (https://www2.hm.com/<locale>/productpage.<article code>.html); its market is used unless country is sent.");

export function registerHmTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/hm/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_hm",
    `Search one H&M market's catalog by keyword (an article or product code finds that item): ${GRID} Optional department and store (a store code from get_hm_stores: only that store's assortment). Also departments (with counts) and did_you_mean. ${PRICES} ${CODES} ${MARKETS} ${CHARGE}`,
    {
      query: z.string().min(1).max(200).describe("Search keywords in any language, e.g. 'jeans', or an article code."),
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
      department: department(null),
      store: z.string().min(5).max(8).optional()
        .describe("A store code from get_hm_stores (stores[].store_code, e.g. 'US0760'): only items in that store's assortment."),
      on_sale: onSale(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_hm_product",
    `One H&M article by article code or link: article_code, product_code, title, brand, category, category_code, breadcrumbs, url, color, description, composition (part, materials with percent), materials, care, attributes (fit, length, rise, sleeve_length, style, neckline, weight, measurements ...), the prices with price_disclosure (e.g. "Sale price in effect for 90+ days" where H&M shows it), currency, colors (every colourway with its own prices), sizes (size_code, label, in_stock, few_left: online stock), new_arrival, coming_soon, sold_in_stores, images, rating (average, count) and the latest reviews H&M shows (up to 10: rating, text, date, fit feedback such as true to size or length; no reviewer names). Not available: the full review list, per-size store stock, price history, member-only checkout prices. Can take up to about a minute. An article unknown to that market answers 404 (charged). Not served on mo, tw and the shared EU store (hr, cy, ee, lv, lt, lu, si: 400): use search_hm or get_hm_stock there. ${PRICES} ${CODES} ${MARKETS} ${charge(2)}`,
    {
      article_code: articleCode(),
      url: url(),
      country: country(PRODUCT_COUNTRIES, "H&M market (default us): any listed in the tool description except mo, tw, hr, cy, ee, lv, lt, lu and si."),
      language: language(),
    },
    post("product"),
  );

  server.tool(
    "get_hm_stock",
    `Online stock per size for every colour of an H&M product, by article or product code: product_code, article_code, title, colors (article_code, name, sizes with size_code, label, in_stock, few_left), sizes_total and sizes_in_stock. Online stock, not store stock: H&M publishes no per-size store stock (search_hm with store lists a store's assortment). few_left is null on mo, tw and the shared EU store. An unknown product answers 404 (charged). ${CODES} ${MARKETS} ${CHARGE}`,
    {
      article_code: articleCode(),
      product_code: z.string().min(7).max(7).optional()
        .describe("An H&M product code: 7 digits (the first 7 of an article code), e.g. '1310382'. One of article_code or product_code."),
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
    },
    post("stock"),
  );

  server.tool(
    "get_hm_stores",
    `H&M stores of a country: stores (store_code, name, status such as open or future, store_class, address, city, state, postal_code, country, lat, lng, phone, opening_hours with day, open, close, opening_hour_exceptions with date, closed, open, close, departments with concepts, campaigns), count, total, country_total, page, page_size, total_pages; filtered by city, postal_code or a lat / lng radius (nearest first, with distance_km). Pass a store_code to search_hm as store. Every market except mo (H&M lists no stores there). ${CHARGE}`,
    {
      country: country(STORE_COUNTRIES, "H&M market (default us): any listed in the tool description except mo."),
      city: z.string().min(1).max(80).optional()
        .describe("Only stores whose city or address contains this (case and accents ignored), e.g. 'New York'."),
      postal_code: z.string().min(1).max(20).optional().describe("Only stores whose postal code starts with this."),
      lat: z.number().min(-90).max(90).optional().describe("Latitude: stores within radius_km, nearest first (with lng)."),
      lng: z.number().min(-180).max(180).optional().describe("Longitude (with lat)."),
      radius_km: z.number().min(0.1).max(1000).optional().describe("Radius around lat / lng in km (default 25)."),
      page: z.number().int().min(1).max(100).optional().describe("Results page, 1-based."),
      page_size: z.number().int().min(1).max(100).optional().describe("Stores per page, 1 to 100 (default 20)."),
    },
    post("stores"),
  );

  server.tool(
    "get_hm_category",
    `One H&M category grid by H&M's category id: ${GRID} Category ids are the same in every market (items[].category of any answer gives more); a category returns everything H&M files under that id, which can be more than the site's curated page. An unknown or empty category answers 404 (charged). ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      category: z.string().min(2).max(120)
        .describe("An H&M category id, the same in every market, e.g. ladies_dresses, ladies_tops, ladies_jeans, ladies_knitwear, men_jeans, men_hoodiessweatshirts, men_tshirtstanks, kids_all, ladies_all, men_all."),
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
      on_sale: onSale(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_hm_deals",
    `The sale grid of an H&M department (default women): every marked-down item with sale_price, regular_price and discount_percent, plus department. ${GRID.replace(" and on_sale", "")} H&M runs sales in seasons: a market with no sale running answers an empty grid (charged as a normal call), so it may be empty between sales. ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
      department: department("women"),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_hm_new_arrivals",
    `The new-arrivals grid of an H&M department (default women), plus department: ${GRID} ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
      department: department("women"),
      on_sale: onSale(),
      ...gridFields,
    },
    post("new-arrivals"),
  );

  server.tool(
    "get_hm_suggestions",
    `H&M search suggestions for what a shopper has typed, in the market's language: query, suggestions (text, type query or content, url for content pages) and count. ${MARKETS} ${CHARGE}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. 'hoodie'."),
      country: country(COUNTRIES, ALL_MARKETS),
      language: language(),
    },
    post("suggestions"),
  );

  server.tool(
    "get_hm_production",
    `Where an H&M article is made, as H&M publishes it: article_code, product_code, production_countries and countries (country, suppliers with supplier_id, name and factories with factory_id, name, city and workers range). Company names and city only: no street addresses or contacts. The same in every market. An article without a disclosure answers 404 (charged). ${CHARGE}`,
    {
      article_code: articleCode(),
      url: url(),
      country: country(COUNTRIES, ALL_MARKETS),
    },
    post("production"),
  );
}
