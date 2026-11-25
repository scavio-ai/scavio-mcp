import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/bestbuy.ts + bestbuy-ca.ts. `country` is
// optional and absent by default, so a US call posts exactly what it did
// before Best Buy Canada existed. With country "ca" every tool reads Best Buy
// Canada (bestbuy.ca); get_bestbuy_questions is Best Buy Canada only and needs
// no country.
// Cross-field rules the backend enforces and zod here does not: product,
// reviews and availability take sku OR url (availability for ca also skus);
// category takes category_id OR url; availability takes exactly one of zip
// (us) / postal_code (ca) or store_ids; stores for ca takes postal_code, city
// or latitude + longitude; min_price and max_price go together. The US-only
// limits (page 100, 8 stores, 15 SKUs) are wider here because Best Buy Canada
// allows more; the backend answers a US value past them with a 400. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SEARCH_SORTS = ["best_match", "best_selling", "best_discount", "price_low", "price_high", "rating", "newest"] as const;
const REVIEW_SORTS = ["most_relevant", "most_helpful", "newest", "oldest", "highest_rated", "lowest_rated"] as const;
const CA_COLLECTIONS = ["black_friday", "top_deals", "clearance", "open_box", "refurbished"] as const;
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;

const TILE_FIELDS = "SKU, BSIN, name, brand, model number, URL, image, price, regular price, savings in dollars and percent, on-sale flag, deal badge (e.g. Clearance, Holiday Deal) and deal end time, condition (new, refurbished excellent...), rating, review count, seller type (best_buy or marketplace), product type, badges and release date";
const LISTING_EXTRAS = "Also returns total_results and total_pages, the applied sort and filters, the category, the filter sidebar (facets: every facet with its values and product counts; category_facet values carry category ids), the sort options, related searches and any spelling correction.";
const CA = "Best Buy Canada (bestbuy.ca, Best Buy's Canadian store: 142 stores across Canada per Best Buy's FY2026 10-K, plus a marketplace of third-party sellers)";
const CA_LISTING = "ca: page_size 1-100 (default 24), sorts best_match, price_low, price_high, rating, results capped at 2,000 per query (results_capped), CAD, ehf for province; marketplace sellers as returned";

const country = () => z.enum(["us", "ca"]).optional()
  .describe(`'us' (default, bestbuy.com) or 'ca' (${CA}, CAD).`);
const language = () => z.enum(["en", "fr"]).optional()
  .describe("ca only: 'en' (default) or 'fr'. Same SKUs and prices; French names, specs and links.");
const province = () => z.enum(PROVINCES).optional()
  .describe("ca only: province for the environmental handling fee (ehf), default 'ON'. Prices are national and do not change by province.");
const pageSize = () => z.number().int().min(1).max(100).optional()
  .describe("ca only: products per page, 1-100 (default 24). US pages are fixed at 18.");

const sku = () => z.string().regex(/^[A-Za-z]{0,2}\d{5,10}$/).optional()
  .describe("Best Buy SKU, a search result's `sku`, e.g. '6607832' (us) or '19791103' (ca: Best Buy Canada's own 8-digit numbering).");
const productUrl = () => z.string().min(1).max(800).optional()
  .describe("Product URL naming a SKU: bestbuy.com (/site/<name>/<sku>.p?skuId=<sku>) or, for ca, bestbuy.ca (/en-ca/product/<name>/<sku>). Used when sku is not given.");
const skuList = (max: string) => z.array(z.string().regex(/^[A-Za-z]{0,2}\d{5,10}$/)).min(1).max(20)
  .describe(max);
const page = () => z.number().int().min(1).max(2000).optional()
  .describe("Results page, 1-based. us: up to 100, 18 products per page. ca: page_size per page, within the first 2,000 results.");
const filters = () => z.object({
  brand: z.string().min(1).max(100).optional()
    .describe("Only this brand, as spelled in the Brand filter, e.g. 'Samsung' (us) or 'SAMSUNG' (ca)."),
  on_sale: z.boolean().optional().describe("Only products on sale."),
  clearance: z.boolean().optional().describe("Only clearance products."),
  open_box: z.boolean().optional().describe("Only products with an open-box offer."),
  min_price: z.number().min(0).optional().describe("Lowest price in dollars (USD us, CAD ca; pass with max_price)."),
  max_price: z.number().min(0).optional().describe("Highest price in dollars (pass with min_price)."),
  rating: z.number().int().min(3).max(5).optional().describe("ca only: 3, 4 or 5 (N stars and up)."),
  sold_by: z.enum(["best_buy", "marketplace"]).optional().describe("ca only: sold by Best Buy or by marketplace sellers."),
  seller: z.string().min(1).max(120).optional().describe("ca only: one marketplace seller, as its Sellers facet value."),
  in_stock_online: z.boolean().optional().describe("ca only: only products in stock online."),
  facets: z.array(z.object({ facet: z.string().max(80), value: z.string().max(120) })).max(10).optional()
    .describe("ca only: up to 10 {facet, value} from a response's facets, e.g. [{facet: 'brandName', value: 'SAMSUNG'}]."),
}).optional()
  .describe("Filters, the same as the site's filter sidebar. Combine freely; the response echoes what Best Buy applied.");
const includeSponsored = () => z.boolean().optional()
  .describe("Include the sponsored tiles Best Buy mixes into the grid, flagged sponsored: true with position null. Defaults to false (organic products only).");

export function registerBestBuyTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/bestbuy/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_bestbuy",
    `Search bestbuy.com (US) products, 18 organic products per page, sorted by best match (default), best selling, best discount, price, rating or newest, filtered by brand, on sale, clearance, open box or a price range. Each product has ${TILE_FIELDS}. ${LISTING_EXTRAS} Sponsored tiles are left out unless include_sponsored. With country 'ca', ${CA}: ${CA_LISTING}, sale_ends_at per product. Use a result's sku with get_bestbuy_product, get_bestbuy_reviews, get_bestbuy_availability or get_bestbuy_prices. 2 credits us, 1 ca.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'tv'."),
      page: page(),
      sort: z.enum(SEARCH_SORTS).optional()
        .describe("best_match (default), best_selling, best_discount, price_low, price_high, rating or newest. best_selling, best_discount and newest are us only (400 for ca)."),
      filters: filters(),
      include_sponsored: includeSponsored(),
      country: country(),
      page_size: pageSize(),
      province: province(),
      language: language(),
    },
    post("search"),
  );

  server.tool(
    "get_bestbuy_product",
    `One bestbuy.com (US) product by SKU or URL: name, brand, model, UPC, URL, status, condition, product type, category path, price, regular price, savings, on-sale flag, deal badge, financing offer, every open-box offer by condition (fair, good, excellent) with its price, savings against new (savings_vs_new) and against the regular price (savings_vs_regular), other sellers' and conditions' SKUs of the same product, rating, review count, the AI review summary and what customers love, description, feature list, what's included, the full specification table by group, dimensions, full-size images, manuals and badges. With country 'ca' (Best Buy Canada): UPC, CAD price, regular price, savings, sale_starts_at and sale_ends_at (UTC), ehf and ehf_by_province, seller, online units, open_box (open-box and refurbished SKUs with their own prices), specifications, images; rating and review_count are null for ca (use get_bestbuy_reviews). An unknown SKU is a 404 (not billed for us, charged for ca). 2 credits us, 1 ca.`,
    {
      sku: sku(),
      url: productUrl(),
      country: country(),
      province: province(),
      language: language(),
    },
    post("product"),
  );

  server.tool(
    "get_bestbuy_reviews",
    `Customer reviews of one bestbuy.com (US) product by SKU or URL, 20 per page, sorted most relevant (default), most helpful, newest, oldest, highest or lowest rated, optionally only one star rating. Returns the review summary (average rating, review count, recommended percent, star histogram, the most mentioned pros and cons with mention counts), total_results for the filter, total_pages and has_more. Each review has id, title, text, rating, author, date, recommended flag, verified-purchase and incentivized flags, days of ownership, helpful and not-helpful votes, badges, photos, the site it was syndicated from and the brand's response. With country 'ca' (Best Buy Canada): page_size 1-100, verified_only, with_photos, language (fr: French reviews only); summary with star distribution, recommended percent and Best Buy Canada's own AI summary; no reviewer names. An unknown SKU is a 404. 2 credits us, 1 ca.`,
    {
      sku: sku(),
      url: productUrl(),
      page: z.number().int().min(1).max(10000).optional()
        .describe("Reviews page, 1-based. us: 20 per page, up to 500. ca: page_size per page. Defaults to 1."),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("most_relevant (default), most_helpful, newest, oldest, highest_rated or lowest_rated."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this many stars, 1-5."),
      country: country(),
      page_size: z.number().int().min(1).max(100).optional()
        .describe("ca only: reviews per page, 1-100 (default 20)."),
      verified_only: z.boolean().optional()
        .describe("ca only: verified purchases only."),
      with_photos: z.boolean().optional()
        .describe("ca only: reviews with photos only."),
      language: language(),
    },
    post("reviews"),
  );

  server.tool(
    "get_bestbuy_category",
    `Browse a bestbuy.com (US) category or deals page by category id or URL, 18 products per page, sorted by best selling (the default on most pages), best discount, price, rating or newest, with the same filters as search_bestbuy. Works on catalogue categories (abcat0101001 All Flat-Screen TVs) and merchandised pages such as All Electronics on Sale (pcmcat1674241939957), whose built-in filters are read from the page itself. Each product has ${TILE_FIELDS}. ${LISTING_EXTRAS} With country 'ca' (Best Buy Canada): a numeric id (e.g. 21344 Televisions) or slug id, or 'departments' for the top level; returns the category with parents and subcategories to walk the tree; ${CA_LISTING}. An unknown category, or a page without a product grid, is a 404. 2 credits for an abcat id, 3 for a pcmcat page; 1 ca.`,
    {
      category_id: z.string().min(1).max(80).optional()
        .describe("Category id. us: abcat... (e.g. abcat0101001 All Flat-Screen TVs) or pcmcat... (e.g. pcmcat1674241939957 All Electronics on Sale), listed under a search result's category_facet. ca: numeric (e.g. '21344') or a slug id, or 'departments'. Pass category_id or url."),
      url: z.string().min(1).max(800).optional()
        .describe("A bestbuy.com category page URL (.../<id>.c?id=<id>; its qp= filters are kept, its sort is not) or, for ca, a bestbuy.ca category link."),
      page: page(),
      sort: z.enum(SEARCH_SORTS).optional()
        .describe("us: best_selling (the default on most pages), best_discount, price_low, price_high, rating or newest (no best_match). ca: best_match (default), price_low, price_high or rating."),
      filters: filters(),
      include_sponsored: includeSponsored(),
      country: country(),
      page_size: pageSize(),
      province: province(),
      language: language(),
    },
    post("category"),
  );

  server.tool(
    "get_bestbuy_deals",
    `us (default): today's Best Buy Deal of the Day and the more-deals row under it, with live prices: SKU, name, URL, image, rating, review count, price, regular price, savings in dollars and percent, on-sale flag and deal badge, plus the countdown end as the page shows it. Up to 15 products, no other parameters. With country 'ca' (Best Buy Canada, which has no Deal of the Day): one deal collection (black_friday, top_deals (default), clearance, open_box, refurbished) as a listing with the search parameters, plus the collection's own dates text when its page states them; ${CA_LISTING}. 3 credits us, 1 ca.`,
    {
      country: country(),
      collection: z.enum(CA_COLLECTIONS).optional()
        .describe("ca only: black_friday, top_deals (default), clearance, open_box or refurbished."),
      page: z.number().int().min(1).max(2000).optional()
        .describe("ca only: page, 1-based."),
      page_size: pageSize(),
      sort: z.enum(["best_match", "price_low", "price_high", "rating"]).optional()
        .describe("ca only: best_match (default), price_low, price_high or rating."),
      filters: filters(),
      include_sponsored: includeSponsored(),
      province: province(),
      language: language(),
    },
    post("deals"),
  );

  server.tool(
    "get_bestbuy_stores",
    `Best Buy stores near a US ZIP code, nearest first (up to 15): store id, name, address, city, state, ZIP, phone, open status, store type, distance in miles, and dated opening hours for the next 35 days (holiday hours and closed days included). With country 'ca' (Best Buy Canada): near a postal_code (radius_km), in a city, or near latitude + longitude; store id, name, type (BigBox, SmallFormat, Mobile, ExpressKiosk), address, province, phone, coordinates, distance in km, 7 dated days of hours, services. Use a store_id with get_bestbuy_availability. 1 credit.`,
    {
      zip: z.string().min(1).max(10).optional()
        .describe("US ZIP code, e.g. '94103'. Required for us."),
      country: country(),
      postal_code: z.string().min(1).max(10).optional()
        .describe("ca only: a Canadian postal code, e.g. 'M5V 3L9'. Or city, or latitude + longitude."),
      city: z.string().min(1).max(80).optional()
        .describe("ca only: a city instead of postal_code, e.g. 'Winnipeg'."),
      latitude: z.number().optional()
        .describe("ca only: with longitude, instead of postal_code."),
      longitude: z.number().optional()
        .describe("ca only: with latitude."),
      radius_km: z.number().int().min(1).max(100).optional()
        .describe("ca only: 1-100 km (default 25)."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("ca only: stores to return, 1-100 (default 20)."),
      language: language(),
    },
    post("stores"),
  );

  server.tool(
    "get_bestbuy_availability",
    `us (default): store pickup availability of one bestbuy.com SKU at up to 8 stores: the stores nearest a ZIP code (max_stores, default 5) or the store ids you pass. Each store has a status: in_stock, limited (with the real quantity when Best Buy shows "only N left"), ship_to_store (not on the shelf; can be shipped there for pickup by pickup_date), out_of_stock, not_available_for_pickup, or unknown (with a reason, when the store's answer did not include this SKU; never reported as out of stock). Also the pickup date, the minimum hours until pickup, and the nearby store Best Buy suggests when this one cannot fill it. Best Buy does not publish unit counts for well-stocked items, so quantity is null for in_stock. Takes 5-20s. With country 'ca' (Best Buy Canada): exact units per store for 1-20 SKUs at the stores nearest a postal_code (max_stores 1-50, default 10) or up to 50 store_ids, plus online units; status in_stock, out_of_stock, or unknown (units null: no stock record for that store, never out of stock). No prices here (ca prices are national). An unknown SKU is a 404. 2 credits flat us, 1 ca.`,
    {
      sku: sku(),
      url: productUrl(),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("us: check the stores nearest this US ZIP code (max_stores of them), e.g. '94103'. Pass exactly one of zip or store_ids."),
      max_stores: z.number().int().min(1).max(50).optional()
        .describe("With zip / postal_code: how many of the nearest stores to check. us 1-8 (default 5); ca 1-50 (default 10)."),
      store_ids: z.array(z.string().regex(/^\d{1,5}$/)).min(1).max(50).optional()
        .describe("Check these stores instead (a get_bestbuy_stores result's store_id), us up to 8, ca up to 50, e.g. ['187', '873']."),
      country: country(),
      postal_code: z.string().min(1).max(10).optional()
        .describe("ca only: the stores nearest this postal code, e.g. 'H3B 4W8'. Pass exactly one of postal_code or store_ids."),
      skus: skuList("ca only: 1-20 Best Buy Canada SKUs in one call instead of sku.").optional(),
      language: language(),
    },
    post("availability"),
  );

  server.tool(
    "get_bestbuy_suggestions",
    `The bestbuy.com search-box autocomplete for a partial query (e.g. "ps5 con"): suggested search terms, each with the categories (id and name) and SKUs Best Buy shows for it, plus any spelling correction. With country 'ca' (Best Buy Canada): search terms only, each flagged is_brand. Useful for keyword research and for building queries for search_bestbuy. 1 credit.`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'ps5 con'."),
      country: country(),
      language: language(),
    },
    post("suggestions"),
  );

  server.tool(
    "get_bestbuy_prices",
    `Current bestbuy.com prices for up to 15 SKUs in one call: price, regular price, savings in dollars and percent, on-sale flag, deal badge and deal end time per SKU. With country 'ca' (Best Buy Canada): up to 20 SKUs, CAD price, regular price, savings, sale_ends_at, ehf for province and ehf_by_province, rating and review count, seller type. A SKU Best Buy does not know comes back found: false; all unknown is a 404. Good for price tracking and price-drop checks across a watchlist. 2 credits per call us, 1 ca, whatever the number of SKUs.`,
    {
      skus: skuList("us: 1-15 Best Buy SKUs, e.g. ['6607832', '6673112']; ca: 1-20, e.g. ['19791103']."),
      country: country(),
      province: province(),
      language: language(),
    },
    post("prices"),
  );

  server.tool(
    "get_bestbuy_questions",
    `Best Buy Canada only (bestbuy.ca): customer questions about one product by SKU or link, with the answer count and the top answer of each (text, date, verified purchase, helpful votes), most answered first or newest; total_questions, total_pages, has_more. Questions syndicated from bestbuy.com are flagged. No asker or answerer names. An unknown SKU is a charged 404. 1 credit.`,
    {
      sku: sku(),
      url: productUrl(),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Questions per page, 1-50 (default 10)."),
      sort: z.enum(["most_answered", "newest"]).optional()
        .describe("most_answered (default) or newest."),
      language: language(),
    },
    post("questions"),
  );
}
