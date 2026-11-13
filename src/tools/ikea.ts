import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/ikea.ts (50 ikea.com markets, ikea.cn, the
// IKEA Islas sites and IKEA Iceland). Cross-field rules the backend enforces
// and zod here does not: product and reviews take item_no or url; category
// takes category_id or url; country es_islands needs island; language must be
// one the market serves; availability needs store_id; the franchise sites
// (pr, do, es_islands, is) take query and page only. No zod `.default()`: the
// MCP SDK would post a defaulted field on every call.

const MAIN = [
  "us", "ca", "gb", "ie", "de", "at", "ch", "fr", "be", "nl", "dk", "se", "no", "fi", "ee", "lv", "lt", "pl", "cz", "sk",
  "hu", "hr", "si", "rs", "ro", "pt", "es", "it", "il", "ae", "sa", "kw", "qa", "bh", "om", "jo", "eg", "ma", "in", "my",
  "sg", "ph", "th", "jp", "kr", "au", "nz", "mx", "cl", "co",
] as const;
const ALL = [...MAIN, "cn", "pr", "do", "es_islands", "is"] as const;
const MAIN_CN = [...MAIN, "cn"] as const;
const ASIS = ["us", "gb", "de", "fr", "se", "jp", "nl", "es", "it", "pl", "au", "ch", "at"] as const;
const LANGUAGES = [
  "ar", "ca", "cs", "da", "de", "en", "es", "et", "eu", "fi", "fr", "gl", "he", "hr", "hu", "is", "it", "ja", "ko", "lt",
  "lv", "ms", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv", "th", "zh",
] as const;
const ISLANDS = ["tenerife", "grancanaria", "lanzarote", "fuerteventura", "lapalma", "lagomera", "elhierro", "mallorca", "menorca", "ibiza"] as const;
const SORTS = ["relevance", "price_asc", "price_desc", "newest", "rating", "name_asc", "most_popular"] as const;
const AVAILABILITY = ["in_store", "click_collect", "online"] as const;
const DEALS = [
  "new_products", "family_price", "new_lower_price", "last_chance", "lowest_price", "top_seller", "limited_edition",
  "time_restricted", "in_store_price_only", "reduced_price_offer",
] as const;

const CHARGE = "1 credit. Failed upstream calls are not charged (they are retried automatically); a not-found is charged.";
const LANG =
  "Data comes in the market's language and prices are numbers in the market's own currency (never converted); every answer echoes country, language and currency.";
const ITEM =
  "item_no, item_no_global, is_combination, name, type_name, design, measure_text, url, image, images, price, previous_price, discount_amount, discount_percent, price_tag (family_price: price is the IKEA Family member price and previous_price the regular one; new_lower_price, time_restricted_offer (a limited-time reduced price, with previous_price and valid dates), lower_price_in_store, new_product, discontinued or none), price_tag_text, lowest_price, price_valid_from, price_valid_to, rating, rating_count (ratings are per market as shown; many markets share one pool, some show none), badge (top_seller / limited_edition), colors, variant_count, variants, last_chance, online_sellable, category_path and availability (with store_id: the store's stock level and home delivery)";
const GRID = `items with ${ITEM}. Also total, page, page_size, total_pages, count, sort, applied_filters and facets (name, parameter, type, values with id, label and count; the parameter is the key filters takes).`;

const country = (markets: readonly string[], scope: string) => z.enum(markets as unknown as [string, ...string[]]).optional()
  .describe(`IKEA market code, lowercase (default us). ${scope}`);
const language = () => z.enum(LANGUAGES).optional()
  .describe("The answer's language (default: the market's first). Multi-language markets: us en/es, ca en/fr, de and at de/en, ch de/fr/it/en, be nl/fr/en, nl nl/en, se sv/en, no no/en, fi fi/sv/en, ee et/ru/en, lv lv/ru/en, lt lt/ru/en, cz cs/en, pt pt/en, es es/en/ca/eu/gl, Gulf markets and eg ar/en, ma ar/fr/en, my ms/en, th th/en, jp ja/en, kr ko/en, mx es/en, cn zh/en, pr en/es, do es/en, es_islands es/en, is en/is. A language the market does not serve answers 400.");
const island = () => z.enum(ISLANDS).optional()
  .describe("Required with country es_islands (the Canary and Balearic islands storefronts): which island.");
const itemNo = () => z.string().min(8).max(12)
  .describe("An IKEA article number: 8 digits, dots allowed, e.g. '80275887' or '802.758.87' (keep leading zeros: '00263850').");
const storeId = () => z.string().regex(/^\d{1,6}$/)
  .describe("An IKEA store id: stores[].store_id of find_ikea_stores, e.g. '399' (Burbank, CA).");
const itemNos = () => z.array(z.string().min(8).max(12)).min(1).max(100)
  .describe("1 to 100 IKEA article numbers, e.g. ['80275887', '00263850'].");

const SEARCH_SCOPE =
  "55 markets: the 50 ikea.com markets (us ca gb ie de at ch fr be nl dk se no fi ee lv lt pl cz sk hu hr si rs ro pt es it il ae sa kw qa bh om jo eg ma in my sg ph th jp kr au nz mx cl co), cn (ikea.cn), pr (Puerto Rico), do (Dominican Republic), es_islands (Canary and Balearic islands, with island) and is (Iceland).";
const MAIN_SCOPE = "The 50 ikea.com markets (not cn, pr, do, es_islands or is).";
const MAIN_CN_SCOPE = "The 50 ikea.com markets and cn (not pr, do, es_islands or is).";

const gridFields = {
  page: z.number().int().min(1).max(1000).optional()
    .describe("Results page, 1-based."),
  page_size: z.number().int().min(1).max(100).optional()
    .describe("Products per page (default 24, up to 100)."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), price_asc, price_desc, newest, rating, name_asc or most_popular."),
  color: z.union([z.string(), z.array(z.string())]).optional()
    .describe("Color id(s) from facets (parameter f-colors), e.g. '10156' = white."),
  price_bucket: z.string().max(40).optional()
    .describe("A price range id from facets (parameter f-price-buckets), e.g. 'PRICE_0_5000' = 0 to 49.99."),
  new_only: z.boolean().optional().describe("Only new products."),
  last_chance: z.boolean().optional().describe("Only last-chance (being discontinued) products."),
  family_price: z.boolean().optional().describe("Only products with an IKEA Family member price."),
  top_seller: z.boolean().optional().describe("Only best sellers."),
  store_id: storeId().optional()
    .describe("A store id (find_ikea_stores): adds each product's availability at that store (stock level, home delivery) and enables availability."),
  availability: z.enum(AVAILABILITY).optional()
    .describe("With store_id: in_store (in stock at the store), click_collect or online."),
  filters: z.record(z.string(), z.union([z.array(z.string()), z.boolean(), z.string()])).optional()
    .describe("Any other facet, keyed by facets[].parameter, e.g. {\"f-materials\": [\"47350\"]}; boolean facets take true."),
};

export function registerIkeaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/ikea/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_ikea",
    `Search IKEA products by keyword on any of 55 markets. The 50 ikea.com markets and cn get the full grid: sort by price, newest, rating, name or popularity; filter by color, price range, category, new, last chance, IKEA Family price, best seller, store availability or any facet. Returns query, ${GRID} Keyword searches also return did_you_mean, related_searches and content (inspiration pages, separate from items). The franchise sites (pr, do, es_islands, is) take query and page only: Puerto Rico, Dominican Republic and the islands return the first 40 results only (page 1); Iceland pages by 40. ${LANG} ${CHARGE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, in any language the market serves, e.g. 'kallax'."),
      country: country(ALL, SEARCH_SCOPE),
      language: language(),
      island: island(),
      category_id: z.union([z.string(), z.array(z.string())]).optional()
        .describe("Narrow to category id(s) from facets (parameter f-subcategories), e.g. 'st002'."),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_ikea_product",
    `One IKEA product by article number or product URL: item_no, article_number, name, full_name, type_name, summary, description, url, price, previous_price, price_valid_from / to, family_price (member price with its dates), currency, images, rating, rating_count, measurements, materials, care, good_to_know, safety, packaging (number_of_packages, packages with item_no, dimensions, weight, quantity), assembly_pdfs, manuals, designer, variants (type colour / size / cover ..., options with title, item_no, url, price), secondary_ratings, reviews_preview (3 newest), availability_online and detail_level. detail_level basic (rare) carries the core fields only. cn answers in Chinese with measurements, materials and packages; the franchise sites (pr, do, es_islands, is) answer name, description, price, currency, availability_online, images and dimensions (detail_level basic). A product call can take up to about 100 seconds. An unknown article number is a charged 404. ${LANG} ${CHARGE}`,
    {
      item_no: itemNo().optional(),
      url: z.string().min(10).max(500).optional()
        .describe("An IKEA product page of a served market, e.g. 'https://www.ikea.com/de/de/p/kallax-regal-weiss-80275887/' (alternative to item_no; the market and language are read from it)."),
      country: country(ALL, SEARCH_SCOPE),
      language: language(),
      island: island(),
    },
    post("product"),
  );

  server.tool(
    "get_ikea_reviews",
    `An IKEA product's rating, rating_count, secondary_ratings (appearance, ease of assembly, quality, value for money ...) and the 20 most recent reviews the product page shows (title, text, rating, date, author first name as shown, country), plus highlighted reviews with their country. No paging, sort or star filter: always the 20 newest. rating and rating_count are what that market's site shows: many markets share one pool (KALLAX: 8,241 in Germany, Spain, Sweden), others have their own (France 2,760, Italy 1,887), and some show none (Estonia, Latvia, Lithuania, Israel, Iceland). A call can take up to about 100 seconds. ${CHARGE}`,
    {
      item_no: itemNo().optional(),
      url: z.string().min(10).max(500).optional()
        .describe("An ikea.com product page (alternative to item_no)."),
      country: country(MAIN, MAIN_SCOPE),
      language: language(),
    },
    post("reviews"),
  );

  server.tool(
    "get_ikea_category",
    `One IKEA category's products by category id or category URL (send one), with the search sorts and filters: category (id, name, url, parents) and ${GRID} An unknown category id is a charged 404. ${LANG} ${CHARGE}`,
    {
      category_id: z.string().min(2).max(12).optional()
        .describe("A category id (categories[].id of get_ikea_categories, or category_path / facets ids of a search), e.g. '10382' = bookcases, 'fu003' = sofas."),
      url: z.string().min(10).max(500).optional()
        .describe("An IKEA category page (alternative to category_id), e.g. 'https://www.ikea.com/us/en/cat/bookcases-10382/'."),
      country: country(MAIN_CN, MAIN_CN_SCOPE),
      language: language(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_ikea_categories",
    `The market's IKEA category tree as its site menu shows it (about 1,500 categories): id (for get_ikea_category), name, url and children; plus parent_id and count. parent_id returns one category's subtree. ${LANG} ${CHARGE}`,
    {
      country: country(MAIN, MAIN_SCOPE),
      language: language(),
      parent_id: z.string().min(2).max(12).optional()
        .describe("Return only this category's subtree (categories[].id)."),
    },
    post("categories"),
  );

  server.tool(
    "get_ikea_deals",
    `One of the market's IKEA deal lists, with the search sorts and filters: new_products, family_price (IKEA Family member prices), new_lower_price, last_chance, lowest_price (the lowest-price range), top_seller, limited_edition, time_restricted, in_store_price_only or reduced_price_offer. Returns type and ${GRID} ${LANG} ${CHARGE}`,
    {
      type: z.enum(DEALS)
        .describe("new_products, family_price, new_lower_price, last_chance, lowest_price, top_seller, limited_edition, time_restricted, in_store_price_only or reduced_price_offer."),
      country: country(MAIN_CN, MAIN_CN_SCOPE),
      language: language(),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_ikea_suggestions",
    `What the IKEA search box suggests for what a user typed: suggestions with text, type (completion, category, product, planner, content), label, url, category_id, item_no and image when given. ${LANG} ${CHARGE}`,
    {
      query: z.string().min(1).max(100)
        .describe("What the user has typed so far, e.g. 'sof'."),
      country: country(MAIN_CN, MAIN_CN_SCOPE),
      language: language(),
    },
    post("suggestions"),
  );

  server.tool(
    "find_ikea_stores",
    `The market's IKEA stores and pick-up / plan-and-order points: store_id (for get_ikea_stock, get_ikea_as_is and the store_id filter), name, display_name, type (store, small_store, plan_and_order_point, shop ...), address (street, city, zip, state, timezone), latitude, longitude, hours (normal week, exceptions, closed days), restaurant, bistro, cafe, click & collect, Swedish Food Market and Smaland hours, store_url and opening_date; plus total and count. Filter by text (query) and sort by distance from lat / lng (distance_km). ${CHARGE}`,
    {
      country: country(MAIN, MAIN_SCOPE),
      language: language(),
      query: z.string().min(1).max(80).optional()
        .describe("Only stores whose name, city, ZIP / postal code or address contains this text, e.g. 'Burbank'."),
      lat: z.number().min(-90).max(90).optional()
        .describe("With lng: stores sorted by distance from this point (distance_km)."),
      lng: z.number().min(-180).max(180).optional()
        .describe("With lat."),
      limit: z.number().int().min(1).max(200).optional()
        .describe("Stores to return (default 50, up to 200)."),
    },
    post("stores"),
  );

  server.tool(
    "get_ikea_stock",
    `Stock at one IKEA store for up to 100 article numbers in one call: store (id, name), zip and items (item_no, name, type_name, design, url, price, store_availability with status in_stock_high, in_stock_low or out_of_stock and the site's text, home_delivery with zip, click_collect). A level, not a quantity: IKEA does not publish unit counts. Numbers the market does not sell are listed in not_found; an unknown store id is a charged 404. ${CHARGE}`,
    {
      item_nos: itemNos(),
      store_id: storeId(),
      zip: z.string().min(3).max(10).optional()
        .describe("A postal code: adds home-delivery availability to that address."),
      country: country(MAIN, `${MAIN_SCOPE} Must be the store's market.`),
      language: language(),
    },
    post("stock"),
  );

  server.tool(
    "get_ikea_items",
    `Up to 100 IKEA article numbers on one market in one call, each with the search item fields (${ITEM}); numbers the market does not sell are listed in not_found. ${LANG} ${CHARGE}`,
    {
      item_nos: itemNos(),
      country: country(MAIN_CN, MAIN_CN_SCOPE),
      language: language(),
    },
    post("items"),
  );

  server.tool(
    "compare_ikea_prices",
    "IKEA prices by country: one article number across 2 to 10 IKEA markets in one call. Returns item_no, count, found_count, markets (country, language, currency, found, name, type_name, design, price, previous_price, price_tag, url), errors and note. Prices are in each market's own currency and never converted (measured 2026-11-13: KALLAX 80275887 was EUR 49.99 in de and nl, EUR 59.99 in fr, SEK 599 in se). Some markets (us, ca, jp, au, kr, in, my, sg, ph ...) sell the same product under a different article number, so found is false there. A market that fails is listed in errors and not charged. Costs 1 credit per market that answered (the balance must cover every market asked). Markets: the 50 ikea.com markets (not cn, pr, do, es_islands or is).",
    {
      item_no: itemNo(),
      countries: z.array(z.enum(MAIN)).min(2).max(10)
        .describe("2 to 10 ikea.com market codes, e.g. ['de', 'fr', 'se', 'nl', 'es', 'it']."),
    },
    post("compare"),
  );

  server.tool(
    "get_ikea_as_is",
    `One IKEA store's As-is offers (ex-display, returned and second-hand items at reduced prices): store_id, total, page, page_size, total_pages and offers, per product title, description, article_numbers, currency, original_price, min_price, max_price, image and offers (offer_id, offer_number, description, price, lowest_previous_price, condition_code, condition, condition_description, in_box, reason_discount). Read-only: nothing is reserved. A store of another market is a charged 404. ${CHARGE}`,
    {
      store_id: storeId(),
      country: country(ASIS, "As-is is served in us, gb, de, fr, se, jp, nl, es, it, pl, au, ch and at; must be the store's market."),
      language: language(),
      page: z.number().int().min(1).max(500).optional()
        .describe("Results page, 1-based."),
      page_size: z.number().int().min(1).max(48).optional()
        .describe("Products per page (default 24, up to 48)."),
    },
    post("as-is"),
  );
}
