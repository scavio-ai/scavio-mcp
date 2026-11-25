import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/vevor.ts (13 VEVOR storefronts, markets in scrapedo-vevor.ts
// MARKET_ROWS). Rules the backend enforces and zod here does not: language must be one the
// country offers (listed in MARKETS); product takes sku or url, and a url must be a link of the
// storefront named by country; shipping needs state for country us and province for ca (other
// storefronts take zip only); pickup is us only; collections type promotion takes url only and
// category goes with best_sellers only; prices takes sku only (it asks every storefront). No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

// country -> "<host> <currency> <languages, the first is the default>".
const MARKETS: Record<string, string> = {
  us: "www.vevor.com USD en es", ca: "www.vevor.ca CAD en fr", gb: "www.vevor.co.uk GBP en",
  au: "www.vevor.com.au AUD en", de: "www.vevor.de EUR de", fr: "www.vevor.fr EUR fr", es: "www.vevor.es EUR es",
  it: "www.vevor.it EUR it", nl: "www.vevor.nl EUR nl", pl: "www.vevor.pl PLN pl", mx: "www.vevor.mx MXN es",
  no: "www.vevor.co.no EUR no", eu: "eur.vevor.com EUR en sv da fi no pt cs el sk hu ro",
};
const COUNTRIES = Object.keys(MARKETS) as [string, ...string[]];
const LANGUAGES = ["en", "es", "fr", "de", "it", "nl", "pl", "no", "sv", "da", "fi", "pt", "cs", "el", "sk", "hu", "ro"] as const;
const SORTS = ["popular", "price_low", "price_high", "hot", "new"] as const;
const RATINGS = ["highly_rated", "best_rated"] as const;
const REVIEW_SORTS = ["recommended", "newest", "helpful"] as const;
const COLLECTION_TYPES = ["best_sellers", "new", "promotion"] as const;
const DEAL_TYPES = ["daily_deals", "clearance", "deals"] as const;

const FIRST = "VEVOR (vevor.com, the tools and equipment seller with storefronts in 13 countries)";
const NAME = "Vevor";
const MARKET_LIST = Object.entries(MARKETS)
  .map(([c, v]) => {
    const [host, currency, ...langs] = v.split(" ");
    return `${c} (${host}, ${currency}; ${langs.join(", ")})`;
  })
  .join(", ");
const MARKETS_TEXT = `Storefronts (country, default us; language, default the first listed): ${MARKET_LIST}. eu is eur.vevor.com, VEVOR's storefront for the other European countries; uk is gb. Every answer carries market {country, language, currency, host}. Text is in the storefront language, and each storefront language has its own search index: send search terms in that language.`;
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICES =
  "Prices are VEVOR's prices on that storefront for a visitor without an account, in its own currency (no conversion). The same SKU has its own price on each storefront; price and stock do not change by ZIP or state (shipping fee and delivery date do: get_vevor_shipping). was_price is given only while a VEVOR deal is active (or VEVOR's page shows its own strikethrough price); otherwise null, never computed from VEVOR's reference price.";
const NOT_AVAILABLE =
  "Not available: coupon codes (VEVOR shows them only after a claim), the pickup store, Pro or bulk prices, financing, the ships-from warehouse, VEVOR's listings on other marketplaces (use those platforms' tools), price history (poll and store the answers), checkout.";
const ITEM =
  "position, sku (the input of get_vevor_product, get_vevor_shipping, get_vevor_reviews, get_vevor_questions and get_vevor_prices), spu, name, url, image, price, was_price, currency, stock_units, in_stock, deal, deal_ends (as VEVOR gives it, ISO 8601 UTC), deal_progress (VEVOR's text, e.g. 88% Left), labels, rating, review_count (VEVOR's figures for the product family)";
const LIST = `market, page, page_size (60), total (exact up to 100, then a lower bound as VEVOR gives it, e.g. "100+"), total_is_lower_bound, last_page_shown, has_more, count, sort, filters_applied, items (${ITEM}), notes`;

const country = z.enum(COUNTRIES).optional()
  .describe("The VEVOR storefront's two-letter code (default us: www.vevor.com). The storefronts and their languages are listed in the tool description.");
const language = z.enum(LANGUAGES).optional()
  .describe("The storefront language (default its first): us en, es; ca en, fr; eu en, sv, da, fi, no, pt, cs, el, sk, hu, ro; every other storefront its own language only. A language the storefront does not offer answers 400, not charged.");
const market = { country, language };
const sku = z.string().min(8).max(40)
  .describe("A VEVOR SKU (items[].sku, letters and digits, e.g. DHJMIGMMAMIGLL6WNV5).");
const categoryRef = z.union([z.string().min(2).max(2000), z.number().int().positive()]);
const page = z.number().int().min(1).max(50).optional().describe("Page (1-50, 60 items a page, VEVOR's page size).");
const sort = z.enum(SORTS).optional()
  .describe("popular (default, VEVOR's own order), price_low, price_high, hot or new: VEVOR's sort menu.");
const filters = {
  in_stock: z.boolean().optional().describe("Only items in stock."),
  on_sale: z.boolean().optional().describe("Only items VEVOR lists as on sale."),
  black_friday: z.boolean().optional().describe("Only items in VEVOR's Black Friday filter (offered while VEVOR runs it)."),
  bulk_savings: z.boolean().optional().describe("Only items VEVOR lists with bulk savings."),
  pickup: z.boolean().optional().describe("Only items VEVOR offers for pickup (country us only)."),
  min_price: z.number().min(0).optional().describe("Lowest price, in the storefront's currency."),
  max_price: z.number().min(0).optional().describe("Highest price, in the storefront's currency."),
  rating: z.enum(RATINGS).optional().describe("highly_rated (4 stars and up) or best_rated (5 stars), as VEVOR's rating filter has them."),
};
const FILTERS = "filtered (in stock, on sale, Black Friday while VEVOR runs it, bulk savings, pickup in the US, price range, highly rated or best rated)";

export function registerVevorTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/vevor/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_vevor",
    `Search ${FIRST} by keywords in the storefront language or a VEVOR SKU, on any of its storefronts, sorted (popular, price low or high, hot, new), ${FILTERS}, by category and paged (60 a page). Returns query, category, ${LIST}. ${PRICES} ${MARKETS_TEXT} ${NOT_AVAILABLE} ${ONE}`,
    {
      q: z.string().min(1).max(200)
        .describe("Keywords in the storefront language (each storefront language has its own search index; e.g. welder on us), or a VEVOR SKU."),
      category: categoryRef.optional()
        .describe("Only items in this category: categories[].id of get_vevor_categories (e.g. 40339) or a VEVOR category link."),
      page,
      sort,
      ...filters,
      ...market,
    },
    post("search"),
  );

  server.tool(
    "get_vevor_product",
    `One ${NAME} product by SKU or link, on the storefront asked: market, requested_sku, sku, spu, web_id, name, url, price, was_price, currency, deal {starts, ends (ISO 8601 UTC, as VEVOR gives them), quantity, claimed, percent_left} (null without an active deal), stock_units, in_stock, availability, labels, attributes, variants [{sku, attributes, price, was_price, deal_ends, stock_units, sold, url}] (each variant with its own price and stock), specs [{name, value}], images, description, protection_plans [{years, name, price, currency}] (as VEVOR offers them), return_policy {days, free_returns, method}, rating, review_count, rating_breakdown [{stars, percent}], ai_review_summary and ai_questions (VEVOR's own AI-written summary and answers, labelled as VEVOR's), categories [{id, name, url}], notes. ${PRICES} The same SKU on every storefront in one call is get_vevor_prices. An unknown SKU, or one this storefront does not sell, is a charged 404. ${ONE}`,
    {
      sku: sku.optional().describe("A VEVOR SKU (items[].sku, e.g. DHJMIGMMAMIGLL6WNV5). Send sku or url."),
      url: z.string().min(10).max(2000).optional()
        .describe("A VEVOR product link (items[].url) instead of sku. It must be a link of the storefront named by country (a www.vevor.ca link needs country ca)."),
      ...market,
    },
    post("product"),
  );

  server.tool(
    "get_vevor_shipping",
    `${NAME}'s shipping answer for one SKU to a destination: market, sku, destination {country, state, zip, city}, fee, currency, free_shipping, delivery {earliest, latest} (ISO 8601 UTC, as VEVOR gives them; often one date for both), can_order, price, stock_units, notes. Country us needs state (VEVOR's fee and delivery date depend on it; captured 2026-11-25: a welder to Alaska (AK 99501) cost a $130 fee, contiguous states were measured free with dates varying by state); country ca needs province; other storefronts take zip (the postcode) only. VEVOR does not name a shipping method or the shipping warehouse. A SKU this storefront does not sell is a charged 404. ${ONE}`,
    {
      sku,
      state: z.string().min(2).max(2).optional()
        .describe("Required for country us: the two-letter US state (e.g. NY). VEVOR's fee and delivery date depend on it."),
      province: z.string().min(2).max(2).optional()
        .describe("Required for country ca: the two-letter Canadian province (e.g. ON)."),
      zip: z.string().min(2).max(12).optional()
        .describe("Optional: the ZIP or postcode (US: 5 digits; Canada: e.g. M5V 2T6)."),
      city: z.string().min(1).max(80).optional().describe("Optional: the city."),
      ...market,
    },
    post("shipping"),
  );

  server.tool(
    "get_vevor_reviews",
    `Reviews of one ${NAME} product, paged (up to 100 a page), sorted (recommended, newest, helpful) and filtered (stars, with photos, this exact SKU): market, sku, rating, review_count, rating_breakdown [{stars, count, percent}], total, page, page_size, total_pages, has_more, sort, filters_applied, count, reviews [{id, rating, title, text, date, language, country, sku, variant_attributes [{name, value}], photos_count, videos_count, helpful_votes, replies [{text, date}] (VEVOR's replies)}], notes. VEVOR shares one review pool across its storefronts and a product's variants, so reviews come in many languages (language, country per review). No reviewer names. A SKU this storefront does not sell is a charged 404. ${ONE}`,
    {
      sku,
      page: z.number().int().min(1).max(500).optional().describe("Page (default 1)."),
      page_size: z.number().int().min(1).max(100).optional().describe("Reviews per page (1-100, default 20)."),
      sort: z.enum(REVIEW_SORTS).optional().describe("recommended (default, VEVOR's own order), newest or helpful."),
      rating: z.number().int().min(1).max(5).optional().describe("Only reviews with this many stars (1-5)."),
      photos_only: z.boolean().optional().describe("Only reviews with photos or videos."),
      this_variant_only: z.boolean().optional()
        .describe("Only reviews of this exact SKU (VEVOR shares reviews across a product's variants)."),
      ...market,
    },
    post("reviews"),
  );

  server.tool(
    "get_vevor_questions",
    `Customer questions on one ${NAME} product with their answers, 5 a page (VEVOR's page size): market, sku, total, page, page_size, total_pages, has_more, count, questions [{id, question, date, votes, answers [{text, date, by_vevor, votes}]}] (by_vevor marks VEVOR's own answers), notes. No asker or answerer names. A SKU this storefront does not sell is a charged 404. ${ONE}`,
    {
      sku,
      page: z.number().int().min(1).max(200).optional().describe("Page (5 questions a page)."),
      ...market,
    },
    post("questions"),
  );

  server.tool(
    "get_vevor_suggestions",
    `${NAME}'s search suggestions for typed text on the storefront asked: market, query, count, suggestions [{term, url}] (url is the matching VEVOR search page), notes. Text is in the storefront language. ${ONE}`,
    {
      q: z.string().min(1).max(100).describe("The text typed so far, in the storefront language (e.g. ice)."),
      ...market,
    },
    post("suggestions"),
  );

  server.tool(
    "get_vevor_categories",
    `${NAME}'s category tree on the storefront asked (its own category menu: departments, categories, sub-categories) or one branch: market, category, parents, count, total_categories, categories [{id, name, url, children [...]}], notes. id is the input of get_vevor_category and of search_vevor's category filter. A category not in the menu is a charged 404. ${ONE}`,
    {
      category: categoryRef.optional()
        .describe("One category (categories[].id, e.g. 40339, or a VEVOR category link): its sub-categories. Without it: every department with its categories."),
      ...market,
    },
    post("categories"),
  );

  server.tool(
    "get_vevor_category",
    `One ${NAME} category listing (categories[].id or a category link), sorted, ${FILTERS} and paged like search_vevor (60 a page). Returns category_id, title, ${LIST}. ${PRICES} An unknown category is a charged 404. ${ONE}`,
    {
      category: categoryRef
        .describe("A VEVOR category: categories[].id of get_vevor_categories (e.g. 40035, Ice Makers) or a VEVOR category link."),
      page,
      sort,
      ...filters,
      ...market,
    },
    post("category"),
  );

  server.tool(
    "get_vevor_collections",
    `${NAME}'s Best Sellers (optionally one category), New Arrivals (items carry first_listed, when VEVOR first listed them) or one promotion page (url, one page in VEVOR's own order), as VEVOR lists them: type, category or url, ${LIST}. ${PRICES} ${ONE}`,
    {
      type: z.enum(COLLECTION_TYPES).optional()
        .describe("best_sellers (default, VEVOR's Best Sellers), new (New Arrivals) or promotion (one VEVOR promotion page: send url, nothing else)."),
      category: categoryRef.optional().describe("With type best_sellers only: only this category (categories[].id)."),
      url: z.string().min(10).max(2000).optional()
        .describe("With type promotion: a VEVOR promotion page link (https://www.vevor.com/promotion/<name>-special-<id>.html)."),
      page,
      sort,
      ...market,
    },
    post("collections"),
  );

  server.tool(
    "get_vevor_deals",
    `${NAME}'s Daily Deals, Clearance or Deals page (optionally one category), sorted and paged: type, category, ${LIST}. Deal end times are as VEVOR gives them (deal_ends, ISO 8601 UTC); coupon codes are not included (VEVOR shows them only after a claim). ${PRICES} ${ONE}`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("daily_deals (default, VEVOR's Daily Deals), clearance or deals (VEVOR's Deals page)."),
      category: categoryRef.optional().describe("Only this category (categories[].id)."),
      page,
      sort,
      ...market,
    },
    post("deals"),
  );

  server.tool(
    "get_vevor_prices",
    `The same ${NAME} SKU on all 13 storefronts in one call: sku, sold_in, storefronts [{country, host, currency, status (sold, not_sold or unavailable), sold, price, was_price, deal_ends, stock_units}], notes. Each storefront in its own currency (no conversion; vevor.co.no and eur.vevor.com sell in EUR); most European storefronts share one stock pool. Captured 2026-11-25: one SKU (GYQXJBMQJQYPKEO1LV0) was 195.01 USD on us, 233.90 CAD on ca, 175.90 GBP on gb, 170.90 EUR on de, 261.99 EUR on no and 721.90 PLN on pl, and not sold on mx. Takes sku only (no country or language). A SKU no storefront sells is a charged 404. Costs 3 credits, billed on what the request spent (credits_used is what was charged: storefronts that did not answer are not billed). Failed upstream calls and refused inputs are not charged.`,
    { sku },
    post("prices"),
  );
}
