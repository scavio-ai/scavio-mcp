import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Douglas: 10 tools on /api/v1/douglas (search, category, brand, deals, product, stores, store,
// review-summary, suggestions, brands), 15 storefronts. Shapes mirror backend/src/routes/douglas.ts.
// Rules the backend enforces and zod here does not: product takes code or url (not both; a link's
// storefront sets the market, and a different market is a 400); deals takes collection or category
// (not both); sale_only is a 400 on ch-de / ch-fr; at most 10 filter values in all; store_id is a
// string (leading zeros count); letter is one letter A-Z or #; pt, hr, si, lv, ee, bg and fr are a
// 400 (not charged). No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const MARKETS = ["de", "at", "ch-de", "ch-fr", "nl", "be-nl", "be-fr", "es", "it", "pl", "cz", "sk", "hu", "ro", "lt"] as const;
const SORTS = ["relevance", "price_asc", "price_desc", "newest", "top_rated", "discount"] as const;
const COLLECTIONS = ["sale", "beauty_friday"] as const;

const FIRST =
  "Douglas (douglas.de, the Dusseldorf-based beauty retailer with about 1,960 stores in Europe), on 15 storefronts in 13 countries";
const NAME = "Douglas";
const MARKET_TEXT =
  "Markets (market, default de): de (Germany), at (Austria), ch-de / ch-fr (Switzerland, German / French, CHF), nl (Netherlands), be-nl / be-fr (Belgium, Dutch / French), es (Spain), it (Italy), pl (Poland, PLN), cz (Czechia, CZK), sk (Slovakia), hu (Hungary, HUF), ro (Romania, RON), lt (Lithuania); the rest in EUR. Names and texts come in the storefront's language; prices are numbers in its currency, and prices and assortment differ per storefront.";
const BILL = "Failed upstream calls and refused inputs are not charged; a not-found is charged (credits_used is what was charged).";
const CREDIT = "Costs 1 credit (2 on it).";
const SLOW = "Slow: a listing page takes 5 to 210 seconds: allow up to 4 minutes.";
const TILE =
  "code (the variant), base_code (the input of get_douglas_product), name, base_name, brand, brand_line, product_family, url, image, price, currency, price_text, was_price (Douglas' struck-through price), discount_percent (as Douglas shows it), lowest_price_30d (the lowest price of the last 30 days Douglas shows beside a reduction), rrp (the RRP / UVP Douglas shows), price_type, unit_price {price, per}, content {amount, unit}, sizes, colors_count, availability (AVAILABLE, SOLD_OUT, AVAILABLE_IN_FUTURE), in_stock, rating, rating_stars, flags (e.g. SALE, NEW), marketplace {is_marketplace, vendor}";
const LIST = `market, country, language, currency, redirected_to, list_type (search, category, brand), url, title, category_code, sort, sort_applied, filters, filters_applied, page, page_size, total (the count the page shows), total_pages, has_more, count, items [{${TILE}}], facets [{facet, name, multi_select, values [{value, name, count, selected}]}], sorts, breadcrumbs, notes. A price Douglas does not show is null. Sponsored placements are left out`;
const NOT_AVAILABLE =
  "Not available: review texts, review paging or star filters, per-store stock, store reservation, price history (poll and store the answers), cart or checkout. Douglas Portugal, Croatia, Slovenia, Latvia, Estonia and Bulgaria run on another shop platform, and France trades as Nocibe: those are not offered.";

const market = z.enum(MARKETS).optional()
  .describe("The Douglas storefront (default de): de, at, ch-de, ch-fr, nl, be-nl, be-fr, es, it (2 credits on most tools), pl, cz, sk, hu, ro, lt.");

const listing = {
  page: z.number().int().min(1).max(200).optional().describe("Page, 1-based (48 products a page; default 1; up to 200)."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), price_asc, price_desc, newest, top_rated, discount (where the storefront offers it). sorts lists what the page offers; sort_applied says what it answered."),
  brand_filter: z.union([z.string().max(20), z.array(z.string().max(20))]).optional()
    .describe("Only these brands: one brand code or a list (e.g. b0690 DIOR, from get_douglas_brands or a brand link)."),
  sale_only: z.boolean().optional()
    .describe("Only products with Douglas' own sale badge (SALE on de, the discount badge elsewhere). Not every reduced price carries it: was_price shows every reduction. A 400 on ch-de / ch-fr (no such badge there)."),
  filters: z.array(z.object({
    facet: z.string().max(60).describe("facets[].facet, e.g. classificationClassName, genderName, flagName."),
    value: z.union([z.string().max(100), z.array(z.string().max(100))]).describe("facets[].values[].value, or a list of them."),
  })).optional()
    .describe("Any facet of the page: [{facet, value}] from facets (e.g. [{facet: \"classificationClassName\", value: \"Eau de Parfum\"}]). At most 10 values in all."),
  market,
};

export function registerDouglasTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/douglas/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_douglas",
    `Search the products of ${FIRST} by keywords, with paging (48 a page), sorts (relevance, price, newest, top rated, discount) and the page's filters (brand, sale badge, product type, gender ... from facets). A keyword Douglas sends to a category or brand page is answered from that page (redirected_to says which). Returns query, ${LIST}. Captured 2026-11-26: "dior" on de led to the DIOR brand page (redirected_to), 260 products. ${MARKET_TEXT} ${NOT_AVAILABLE} ${CREDIT} ${BILL} ${SLOW}`,
    {
      query: z.string().min(1).max(200)
        .describe("Keywords, in the storefront's language (required, e.g. mascara). Some keywords lead to a category or brand page: redirected_to names it."),
      ...listing,
    },
    post("search"),
  );

  server.tool(
    "get_douglas_category",
    `One category of ${FIRST} by path, code or link, with paging, sorts and filters. Returns category, ${LIST}. An unknown category is a charged 404. ${MARKET_TEXT} ${CREDIT} ${BILL} ${SLOW}`,
    {
      category: z.string().min(1).max(600)
        .describe("A category path ending in its code (parfum/01, make-up/lippen/lippenstift/030503), the code alone (01) or a category link (required)."),
      ...listing,
    },
    post("category"),
  );

  server.tool(
    "get_douglas_brand",
    `One brand's products on ${FIRST} by brand code, path or link (get_douglas_brands lists them), with paging, sorts and filters. Returns brand, ${LIST}. An unknown brand is a charged 404. ${MARKET_TEXT} ${CREDIT} ${BILL} ${SLOW}`,
    {
      brand: z.string().min(1).max(400)
        .describe("A brand code (b0690, from get_douglas_brands), its path (dior/b0690) or a brand link (required)."),
      ...listing,
    },
    post("brand"),
  );

  server.tool(
    "get_douglas_deals",
    `The deal lists of ${FIRST}: the sale department (collection sale; on de its SALE-badged products), the Beauty / Black Friday list (collection beauty_friday, while Douglas runs it) or any category's sale-badged products, with paging, sorts and filters; per item the price, Douglas' struck-through price, discount, 30-day lowest price and RRP as shown. With include_promotions (default true) also the storefront's offers page: promotions [{kind, headline, text, link_text, url, image, legal_text (validity dates and codes as Douglas words them), labels, updated_at}] (de, at, ch-de, ch-fr, pl; elsewhere null). Returns collection, category, offers_page, promotions, ${LIST}. Captured 2026-11-26: beauty_friday on de listed 2,670 products with 8 promotions; HUDA BEAUTY EASY BAKE LOOSE at 27.95 EUR, was 39.90, 30-day low 28.95. ${MARKET_TEXT} ${CREDIT} ${BILL} ${SLOW}`,
    {
      collection: z.enum(COLLECTIONS).optional()
        .describe("sale (default: the sale department) or beauty_friday (the Beauty / Black Friday list, while Douglas runs it). Send collection or category, not both."),
      category: z.string().max(600).optional()
        .describe("Or any category (path, code or link): its products with Douglas' sale badge (not on ch-de / ch-fr). Not with collection."),
      include_promotions: z.boolean().optional()
        .describe("Also read the storefront's offers page (default true; de, at, ch-de, ch-fr and pl link one)."),
      ...listing,
    },
    post("deals"),
  );

  server.tool(
    "get_douglas_product",
    `One product of ${FIRST} by base or variant code or link: requested, source (api, or page when only the product page lists the code: slower), market, code (the variant answered), base_code, name, brand {code, name, url}, brand_line, product_family, gender, url, ean (of code), description, bullets, application, ingredients, price, currency, price_text, was_price, discount_percent, lowest_price_30d, rrp, price_type, unit_price, content, stock_level, availability, availability_text, in_stock, max_order_quantity, rating, rating_stars, review_count, images, videos, categories, attributes [{code, name, values}], scent_notes {top, heart, base}, flags, marketplace, variant_type (SIZE, COLOR, STYLE), variant_count, variants [{code, name, url, price data, unit_price, content, stock_level, availability, availability_text, in_stock, flags, image, ean (with variants_ean)}], variants_ean, notes. Captured 2026-11-26: Yves Saint Laurent Libre Eau de Parfum 30 ml (base 5000005003, variant 289686) on de at 52.99 EUR, was 59.99, 30-day low 52.99, RRP 87, rated 4.8 from 5,779 reviews. An unknown code is a charged 404. ${MARKET_TEXT} ${NOT_AVAILABLE} ${CREDIT} variants_ean: +1 credit per variant looked up (2 on it), up to 10. ${BILL}`,
    {
      code: z.string().max(20).optional()
        .describe("A Douglas product code: base (base_code, e.g. 5000005003) or variant (items[].code, e.g. 289690). Send code or url."),
      url: z.string().max(2000).optional()
        .describe("Or a Douglas product link (its storefront sets the market)."),
      variants_ean: z.boolean().optional()
        .describe("Also look up each variant's EAN (one more call per variant, 1 credit each, 2 on it; up to 10). Default false."),
      market,
    },
    post("product"),
  );

  server.tool(
    "get_douglas_stores",
    `The ${NAME} stores near a city or postcode on one storefront of ${FIRST}: market, query, location {text, latitude, longitude}, page, page_size, total, total_pages, has_more, count, stores [{store_id, name, url, operator, address {street, house_number, postal_code, city, country_code, formatted}, phone, latitude, longitude, distance_km, hours [{day, day_of_week, closed, open, close}], special_hours [{date, closed, open, close}] (dated holiday hours), features, images, temporarily_closed}], notes. store_id is the input of get_douglas_store. Captured 2026-11-26: "Berlin" on de found 28 stores; the nearest, Berlin Mitte Alexa (00020475), at 0.76 km. No per-store stock. A place the store finder cannot place is a charged 404. ${MARKET_TEXT} Costs 1 credit (also on it). ${BILL}`,
    {
      query: z.string().min(1).max(100).describe("A city or postcode (required, e.g. Berlin): Douglas' own store finder places it."),
      page: z.number().int().min(1).max(100).optional().describe("Page, 1-based (default 1)."),
      page_size: z.number().int().min(1).max(50).optional().describe("Stores a page, 1-50 (default 10)."),
      market,
    },
    post("stores"),
  );

  server.tool(
    "get_douglas_store",
    `One ${NAME} store by id, from ${FIRST}: every get_douglas_stores field plus parking, public_transport, top_brands [{code, name, url}], events, service_booking. No per-store stock. An unknown store is a charged 404. ${MARKET_TEXT} Costs 1 credit (also on it). ${BILL}`,
    {
      store_id: z.string().max(12)
        .describe("A Douglas store id (stores[].store_id, as a string: leading zeros count; e.g. 00020475)."),
      market,
    },
    post("store"),
  );

  server.tool(
    "get_douglas_review_summary",
    `Douglas' own AI-generated summary of a product's customer reviews, from ${FIRST}: market, code, summary (Douglas' text in the storefront's language, null when it shows none), summary_type (ai_generated), notes. Use the product's base code. Review texts and review paging are not offered. ${MARKET_TEXT} ${CREDIT} ${BILL}`,
    {
      code: z.string().max(20).describe("A base product code (get_douglas_product base_code or items[].base_code, e.g. 5000005003)."),
      market,
    },
    post("review-summary"),
  );

  server.tool(
    "get_douglas_suggestions",
    `Douglas' search suggestions for what a shopper has typed, from ${FIRST}: market, query, count, products [{base_code, code, name, brand, brand_line, product_family, url, image}], trending_terms (the storefront's trending searches, the same for every query, not matches), notes. ${MARKET_TEXT} ${CREDIT} ${BILL}`,
    {
      query: z.string().min(1).max(100).describe("What a shopper has typed (required, e.g. dior)."),
      max: z.number().int().min(1).max(10).optional().describe("Product suggestions, 1-10 (default 10)."),
      market,
    },
    post("suggestions"),
  );

  server.tool(
    "get_douglas_brands",
    `Every brand on one ${NAME} storefront of ${FIRST}: market, query, letter, total, count, brands [{code (the input of get_douglas_brand), name, url, letter, logo}], notes. Captured 2026-11-26: 1,890 brands on de, 1,580 on pl. Very slow: the brand index page takes up to about 200 seconds. ${MARKET_TEXT} ${CREDIT} ${BILL}`,
    {
      query: z.string().max(80).optional().describe("Only brands whose name contains this (accents and case ignored), e.g. dior."),
      letter: z.string().max(1).optional().describe("Only brands under this letter (A-Z or #)."),
      market,
    },
    post("brands"),
  );
}
