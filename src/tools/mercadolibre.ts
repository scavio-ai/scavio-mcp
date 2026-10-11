import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/mercadolibre.ts field for field (names,
// enums, regexes, min/max). Cross-field rules the backend enforces and zod here
// does not; a violation comes back as a 400 with the reason:
//   search:    query, seller_id or seller_nickname; min_price <= max_price
//   product:   exactly one of url, product_id or item_id
//   reviews:   exactly one of url, product_id or item_id
//   questions: exactly one of item_id or url
//
// Product, reviews and questions take no country: the id prefix (MLM, MLB, MLA,
// MCO) or the URL's domain sets it.
//
// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. Defaults are documented in the describe text and
// left for the backend to apply.

const COUNTRIES = ["mx", "br", "ar", "co"] as const;
const BEST_SELLERS_COUNTRIES = ["mx", "ar", "co"] as const;
const CONDITIONS = ["new", "used", "refurbished", "open_box"] as const;
const SORTS = ["relevance", "price_asc", "price_desc"] as const;

const NOT_FOUND = "An unknown product, item or seller is a billed 404 naming what was not found.";

const url = () =>
  z.string().min(1).max(1000).optional();
const productId = () =>
  z.string().regex(/^[A-Za-z]{3}U?\d{4,13}$/, "product_id must be a catalog id such as MLM1027172667").optional()
    .describe("Catalog product id from search_mercadolibre (product_id), e.g. 'MLM1027172667'. Pass one of url, product_id or item_id.");
const itemId = () =>
  z.string().regex(/^[A-Za-z]{3}-?\d{6,13}$/, "item_id must be an item id such as MLM2746152281").optional();

export function registerMercadoLibreTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/mercadolibre/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_mercadolibre",
    `Search Mercado Libre listings in Mexico, Brazil (Mercado Livre), Argentina or Colombia by keyword or seller. Filters: condition, price range, minimum discount, free shipping, Full fulfillment, official stores, interest-free installments; sort by relevance or price. About 48 rows/page with price, list price, discount, installments, seller and official-store flag where shown, rating, units sold as a lower bound ("at least 500"), shipping flags, a sponsored flag, item_id and product_id, plus category_id and category_path for get_mercadolibre_best_sellers. Use for price research, competitor and seller catalogue tracking across Latin America. Max 42 pages (about 2,000 results) per query: slice by price range, condition or seller for more. No newest or best-selling sort. Mercado Libre may narrow a query on its own (Brazil and Argentina may apply 'new'); auto_applied_filters lists it. Zero results is an empty, billed page. Chile not supported. 2 credits/page.`,
    {
      country: z.enum(COUNTRIES)
        .describe("'mx' Mexico, 'br' Brazil (Mercado Livre), 'ar' Argentina, 'co' Colombia. Chile is not supported."),
      query: z.string().min(1).max(200).optional()
        .describe("Keywords, e.g. 'samsung galaxy s26 ultra'. Pass query, seller_id or seller_nickname."),
      seller_id: z.string().regex(/^\d{1,15}$/, "seller_id must be a numeric Mercado Libre seller id").optional()
        .describe("Only this seller's listings (numeric, from get_mercadolibre_product seller.seller_id). Combines with query, filters, sort and page."),
      seller_nickname: z.string().min(1).max(100).optional()
        .describe("A seller's public nickname. Returns their first page unfiltered plus their seller_id; use seller_id for filters, sort and more pages."),
      condition: z.enum(CONDITIONS).optional()
        .describe("Item condition. Omit for any."),
      min_price: z.number().int().min(0).optional()
        .describe("Min price in the country's currency (MXN, BRL, ARS, COP)."),
      max_price: z.number().int().min(1).optional()
        .describe("Max price in the country's currency."),
      min_discount: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(25), z.literal(30), z.literal(40)]).optional()
        .describe("Only listings at least this many percent off: 5, 10, 15, 20, 25, 30 or 40."),
      free_shipping: z.boolean().optional()
        .describe("Only listings with free shipping."),
      full_fulfillment: z.boolean().optional()
        .describe("Only listings shipped by Mercado Libre Full."),
      official_stores_only: z.boolean().optional()
        .describe("Only listings from official brand stores."),
      interest_free_installments: z.boolean().optional()
        .describe("Only listings payable in interest-free installments."),
      sort: z.enum(SORTS).optional()
        .describe("Default 'relevance'."),
      page: z.number().int().min(1).max(42).optional()
        .describe("Page, 1-42 (about 48 per page)."),
    },
    post("search"),
  );

  server.tool(
    "get_mercadolibre_product",
    `Get one Mercado Libre catalog product or listing by URL, product_id or item_id: title, price, list price, installments, promotions, the buy-box seller with reputation level and seller tier, stock, shipping, rating with its star distribution, variations with sibling product ids, specs, description, pictures and category_id. Use for price and seller monitoring on a known product, or to get review totals before get_mercadolibre_reviews. Only the buy-box seller is returned (no all-sellers list); units sold is a lower bound; some fields are null where the page omits them. ${NOT_FOUND} Slowest tool here (up to ~10s). 2 credits.`,
    {
      url: url()
        .describe("A Mercado Libre or Mercado Livre product (/p/), user product (/up/) or listing URL from mx, br, ar or co."),
      product_id: productId(),
      item_id: itemId()
        .describe("Item (listing) id from search_mercadolibre (item_id), e.g. 'MLM2746152281'; 'MLM-2746152281' also works."),
    },
    post("product"),
  );

  server.tool(
    "get_mercadolibre_reviews",
    `Get one page of up to 15 Mercado Libre product reviews by URL, product_id or item_id, optionally only one star rating: rating, text, original_text when Mercado Libre translated it, exact date, likes, the reviewer's country and photos. Catalog products pool reviews from several countries. Page until a page comes back empty. Totals and the star distribution come from get_mercadolibre_product. ${NOT_FOUND} 1 credit/page.`,
    {
      url: url()
        .describe("A Mercado Libre or Mercado Livre product (/p/), user product (/up/) or listing URL."),
      product_id: productId(),
      item_id: itemId()
        .describe("Item (listing) id from search_mercadolibre, e.g. 'MLM2746152281'."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this star rating (1-5)."),
      page: z.number().int().min(1).max(10000).optional()
        .describe("Page, 1-based (15 per page; past the last page comes back empty)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_mercadolibre_questions",
    `Get buyer questions on a Mercado Libre listing with the seller's answers and answer dates (Mercado Libre shows no question dates), by item_id or URL. A product URL resolves to the listing in its buy box. Use to mine pre-sale objections, compatibility and shipping questions. First page holds about 20-40; continue with offset = next_offset. A listing with no public questions is a billed 404 saying so. 2 credits/page.`,
    {
      item_id: itemId()
        .describe("Item (listing) id from search_mercadolibre or get_mercadolibre_product, e.g. 'MLM2746152281'. Pass item_id or url."),
      url: url()
        .describe("A listing URL, or a product (/p/, /up/) URL: its questions are those of the buy-box listing."),
      offset: z.number().int().min(0).max(100000).optional()
        .describe("next_offset from the previous page. Default 0."),
    },
    post("questions"),
  );

  server.tool(
    "get_mercadolibre_best_sellers",
    `Get the ranked top 20 best sellers in a Mercado Libre category in Mexico, Argentina or Colombia: rank, price, discount, installments, rating, units sold as a lower bound and seller where shown. Use for category demand research and finding what sells. Not available for Brazil. category_id comes from search_mercadolibre (category_id or category_path) or get_mercadolibre_product, and its prefix must match the country (MLM mx, MLA ar, MCO co). 2 credits.`,
    {
      country: z.enum(BEST_SELLERS_COUNTRIES)
        .describe("'mx', 'ar' or 'co'. Not available for Brazil."),
      category_id: z.string().regex(/^[A-Za-z]{3}\d{1,10}$/, "category_id must be an id such as MLM1055")
        .describe("Category id, e.g. 'MLM1055'. Prefix must match the country."),
    },
    post("best-sellers"),
  );
}
