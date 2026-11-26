import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shared tool builder for Lookfantastic (tools/lookfantastic.ts) and Cult Beauty (tools/cultbeauty.ts). Shapes mirror
// backend/src/routes/thg-beauty.ts, the route builder both sites share (site configs LOOKFANTASTIC / CULTBEAUTY in
// backend/src/lib/search-providers/thg-beauty.ts). Rules the backend enforces and zod here does not: list takes path
// or url, product takes sku or url (not both); page x page_size stays within 10,000 positions; min_price must not be
// above max_price, min_discount not above max_discount; a currency the site asked does not offer is a 400 (not
// charged); a site without a voucher-codes page answers offers with a 400 (not charged). No zod `.default()`: the
// MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "popularity", "price_low", "price_high", "name", "newest", "discount"] as const;

export interface ThgBeautySiteDoc {
  /** Platform id: the path segment and the tool-name namespace. */
  id: "lookfantastic" | "cultbeauty";
  name: string;
  /** First-mention identity. */
  first: string;
  /** Market codes, the first is the default. */
  markets: readonly [string, ...string[]];
  /** Every currency any of the site's markets offers (the enum). */
  currencies: readonly [string, ...string[]];
  /** The markets and their currencies, in prose. */
  marketsDoc: string;
  /** One line on the currency input. */
  currencyDoc: string;
  /** Named filters: input name -> [example, description]. */
  filters: Readonly<Record<string, readonly [string, string]>>;
  /** The named filters in prose (brand, skin type, ...). */
  filtersProse: string;
  /** A facet name example for filters[].facet. */
  facetExample: string;
  /** How the site's facet names are formed (one sentence). */
  facetNote: string;
  /** Example list paths, in prose. */
  listExamples: string;
  /** A list path example for the path input. */
  pathExample: string;
  /** The editorial landing's list suffix (view-all, shop-all). */
  landingSuffix: string;
  /** The site host of the default market (for link shapes). */
  host: string;
  /** Extra offers sentence (markets without a voucher-codes page). */
  offersNote: string;
  /** Short "Captured 2026-11-26: ..." facts per tool. */
  captured: { search: string; list: string; product: string; offers: string; brands: string };
  /** Example inputs. */
  examples: { query: string; sku: string; suggest: string };
}

const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";

export function registerThgBeautyTools(server: McpServer, getClient: () => ScavioClient, site: ThgBeautySiteDoc) {
  const { id, name: N, first: FIRST } = site;
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/${id}/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  const MARKETS = `${site.marketsDoc} Every currency has its own ${N} price list; nothing is converted by Scavio. Every answer carries market {market, site, language, currency, shipping_destination}.`;
  const PRICES = `Prices are ${N}'s for a visitor without an account, in the currency asked. rrp is ${N}'s RRP as given; discount_percent is computed by Scavio from price and rrp, only when the RRP is above the price. offer is ${N}'s own promotion text, as given. Cart-only code discounts are not included.`;
  const NOT_AVAILABLE = `Not available: full review paging (get_${id}_product returns the 10 latest reviews only), cart or checkout prices (code discounts apply at the cart), price history (poll and store the answers), offer start dates.`;
  const ITEM =
    "position, sku (the input of get_" + id + "_product), name, brand, url, image, price, rrp, discount_percent, price_from (the lowest variant price when below price), currency, in_stock, rating, review_count, offer {title, description, free_gift, url}, variants_count, options";
  const LIST = `market, total, total_pages, page, page_size, has_more, count, sort, filters_applied, items [{${ITEM}}], facets [{facet (the site's facet name, the input of filters[].facet), filter (the named input it maps to), label, type, options [{value, label, count} or {label, from, to, count}]}] (with include_facets), notes`;
  const FILTERS = `sorted (relevance, popularity, price low or high, name, newest, discount) and filtered (${site.filtersProse}, price range, minimum rating, discount range, and any other of the site's filters)`;

  const market = z.enum(site.markets as unknown as [string, ...string[]]).optional()
    .describe(`${N}'s site to read (default ${site.markets[0]}). ${site.marketsDoc}`);
  const currency = z.enum(site.currencies as unknown as [string, ...string[]]).optional()
    .describe(site.currencyDoc);
  const marketShape = { market, currency };

  const many = (example: string, description: string) =>
    z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).min(1).max(10)]).optional()
      .describe(`${description} One value or a list of up to 10 (e.g. ${example}).`);
  const named: Record<string, z.ZodTypeAny> = {};
  for (const [f, [ex, d]] of Object.entries(site.filters)) named[f] = many(ex, d);

  const listShape = (max: number, def: number) => ({
    page: z.number().int().min(1).max(10_000).optional()
      .describe("Page (default 1). At most 10,000 positions (page x page_size)."),
    page_size: z.number().int().min(1).max(max).optional()
      .describe(`Products per page (1-${max}, default ${def}).`),
    sort: z.enum(SORTS).optional()
      .describe(`relevance (default), popularity, price_low, price_high, name, newest or discount (highest percent off first): ${N}'s sort menu.`),
    ...named,
    filters: z.array(z.object({
      facet: z.string().min(2).max(80).describe("The site's facet name, as facets[].facet gives it (with include_facets)."),
      value: z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).min(1).max(10)])
        .describe("One value or a list, as facets[].options[].value gives them."),
    })).max(10).optional()
      .describe(`Any other of the site's filters: up to 10 {facet, value} (e.g. {facet: "${site.facetExample}", value: "Serums"}). ${site.facetNote} Price, rating and discount are ranges: use min_price / max_price, min_rating, min_discount / max_discount.`),
    min_price: z.number().min(0).max(10_000_000).optional().describe("Lowest price, in the currency asked."),
    max_price: z.number().min(0).max(10_000_000).optional().describe("Highest price, in the currency asked."),
    min_rating: z.number().min(1).max(5).optional().describe("Lowest average star rating (1-5)."),
    min_discount: z.number().min(0).max(100).optional().describe(`Lowest percent off ${N}'s RRP (0-100).`),
    max_discount: z.number().min(0).max(100).optional().describe(`Highest percent off ${N}'s RRP (0-100).`),
    include_facets: z.boolean().optional()
      .describe(`Also return ${N}'s filter counts for the results (facets). Still 1 credit.`),
    ...marketShape,
  });

  server.tool(
    `search_${id}`,
    `Search the catalogue of ${FIRST} by keywords (in the site's language) or a ${N} SKU, ${FILTERS}, up to 40 a page. A keyword ${N} maps to one of its pages (a brand, a category, many generic terms) returns that page's products, as ${N}'s own search does, with resolved_from {type (brand, category, landing or product), path, listed_path, url, title, sku}; null for a plain search. Returns query, resolved_from, corrected_query, ${LIST}. ${PRICES} ${site.captured.search} ${MARKETS} ${NOT_AVAILABLE} ${ONE}`,
    {
      q: z.string().min(1).max(200)
        .describe(`Keywords (in the site's language) or a ${N} SKU (e.g. ${site.examples.query}). A mapped keyword returns the page ${N} sends it to, reported in resolved_from.`),
      ...listShape(40, 40),
    },
    post("search"),
  );

  server.tool(
    `get_${id}_list`,
    `The products of any ${N} list page by path or link: ${site.listExamples}, ${FILTERS}, up to 200 a page. Paths come from get_${id}_categories, get_${id}_brands and get_${id}_offers (list_path). An editorial page without a product list is listed through its ${site.landingSuffix} page (listed_path). Returns path, listed_path, url, ${LIST}. ${PRICES} ${site.captured.list} An unknown path is a charged 404. ${MARKETS} ${ONE}`,
    {
      path: z.string().min(2).max(300).optional()
        .describe(`A ${N} list page path (the part after /c), e.g. ${site.pathExample}. Send path or url.`),
      url: z.string().min(10).max(2000).optional()
        .describe(`A ${N} list page link (https://${site.host}/c/<page>/) instead of path.`),
      ...listShape(200, 60),
    },
    post("list"),
  );

  server.tool(
    `get_${id}_product`,
    `One ${N} product by SKU or link, for the site and currency asked: market, requested_sku, sku, product_sku, name, product_name, brand, url, price, rrp, discount_percent, currency, in_stock, availability_message, barcode (EAN-13 or UPC, as given; null when none is listed, as for sets), option_type and option (shade or size, as given), variants [{sku, name, option_type, option, shade_colour, price, rrp, discount_percent, in_stock, availability_message, barcode, preorder, max_per_order, loyalty_points}] (each variant has its own price and stock), subtitle, description, key_benefits, directions, ingredients, at_a_glance, volume, faq, images, loyalty_points, max_per_order, preorder, offer {title, description, free_gift, url} (the site's promotion banner, as given), rating, review_count, recent_reviews [{rating, date, text}] (the 10 latest reviews the product page shows; no reviewer names), breadcrumbs, notes. Text is in the site's language. ${PRICES} ${site.captured.product} An unknown SKU is a charged 404. Full review paging is not offered. ${MARKETS} ${ONE}`,
    {
      sku: z.union([z.string().min(5).max(10), z.number().int().positive()]).optional()
        .describe(`A ${N} SKU (items[].sku or variants[].sku, digits, e.g. ${site.examples.sku}; SKUs are the same on every ${N} site). Send sku or url.`),
      url: z.string().min(10).max(2000).optional()
        .describe(`A ${N} product link (https://${site.host}/p/<name>/<sku>/) instead of sku. The market still comes from market.`),
      ...marketShape,
    },
    post("product"),
  );

  server.tool(
    `get_${id}_suggestions`,
    `${FIRST} search-box suggestions for typed text, in the site's language: market, query, count, terms (suggested searches), corrections, products [{sku, name, url, image, price, rrp, discount_percent, currency, rating, review_count}] (up to 5 each), notes. ${MARKETS} ${ONE}`,
    {
      q: z.string().min(1).max(100).describe(`The text typed so far (e.g. ${site.examples.suggest}).`),
      ...marketShape,
    },
    post("suggestions"),
  );

  server.tool(
    `get_${id}_offers`,
    `The current offers of ${FIRST}, as its voucher-codes page lists them: market, count, offers [{title, description, code (when the offer text names one), gift, threshold (the spend the text states), ends (the end time ${N} gives, ISO 8601 UTC), url, list_path (send to get_${id}_list for the products)}], notes. ${N} gives no start date. ${site.offersNote}${site.captured.offers} ${MARKETS} ${ONE}`,
    { ...marketShape },
    post("offers"),
  );

  server.tool(
    `get_${id}_brands`,
    `The A-Z brand directory of ${FIRST} for the site asked: market, letter, total_brands, count, brands [{name, path, url, letter}], notes. path is the input of get_${id}_list for a brand's products. ${site.captured.brands} ${MARKETS} ${ONE}`,
    {
      letter: z.string().min(1).max(3).optional()
        .describe("Optional: only brands under this letter (A-Z, or 0-9 for brands starting with a digit)."),
      ...marketShape,
    },
    post("brands"),
  );

  server.tool(
    `get_${id}_categories`,
    `The category tree of ${FIRST}, as the site navigation shows it, in the site's language: market, count, total_categories, categories [{name, path, url, children [...]}], notes. path is the input of get_${id}_list. ${MARKETS} ${ONE}`,
    { ...marketShape },
    post("categories"),
  );
}
