import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/bestbuy.ts (bestbuy.com, US only).
// Cross-field rules the backend enforces and zod here does not: product,
// reviews and availability take sku OR url; category takes category_id OR url;
// availability takes exactly one of zip or store_ids; min_price and max_price
// go together. No zod `.default()`: the MCP SDK would post a defaulted field
// on every call.

const SEARCH_SORTS = ["best_match", "best_selling", "best_discount", "price_low", "price_high", "rating", "newest"] as const;
const CATEGORY_SORTS = ["best_selling", "best_discount", "price_low", "price_high", "rating", "newest"] as const;
const REVIEW_SORTS = ["most_relevant", "most_helpful", "newest", "oldest", "highest_rated", "lowest_rated"] as const;

const TILE_FIELDS = "SKU, BSIN, name, brand, model number, URL, image, price, regular price, savings in dollars and percent, on-sale flag, deal badge (e.g. Clearance, Holiday Deal) and deal end time, condition (new, refurbished excellent...), rating, review count, seller type (best_buy or marketplace), product type, badges and release date";
const LISTING_EXTRAS = "Also returns total_results and total_pages, the applied sort and filters, the category, the filter sidebar (facets: every facet with its values and product counts; category_facet values carry category ids), the sort options, related searches and any spelling correction.";

const sku = () => z.string().regex(/^\d{6,9}$/).optional()
  .describe("Best Buy SKU, the number after /sku/ in a product URL (a search result's `sku`), e.g. '6607832'.");
const productUrl = () => z.string().min(1).max(600).optional()
  .describe("bestbuy.com product URL that names a SKU (/product/<name>/<id>/sku/<sku> or /site/<name>/<sku>.p?skuId=<sku>). Used when sku is not given.");
const page = () => z.number().int().min(1).max(100).optional()
  .describe("Results page, 1-based, up to 100. Defaults to 1. 18 products per page.");
const filters = () => z.object({
  brand: z.string().min(1).max(100).optional()
    .describe("Only this brand, as spelled in the Brand filter (a `facets` value of brand_facet), e.g. 'Samsung'."),
  on_sale: z.boolean().optional().describe("Only products on sale."),
  clearance: z.boolean().optional().describe("Only clearance products."),
  open_box: z.boolean().optional().describe("Only products with an open-box offer."),
  min_price: z.number().min(0).optional().describe("Lowest price in dollars (pass with max_price)."),
  max_price: z.number().min(0).optional().describe("Highest price in dollars (pass with min_price)."),
}).optional()
  .describe("Filters, the same as the site's filter sidebar. Combine freely; applied_filters in the response echoes what Best Buy applied.");
const includeSponsored = () => z.boolean().optional()
  .describe("Include the sponsored tiles Best Buy mixes into the grid, flagged sponsored: true with position null. Defaults to false (organic products only).");
const zip = () => z.string().regex(/^\d{5}(-\d{4})?$/)
  .describe("US ZIP code, e.g. '94103'.");

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
    `Search bestbuy.com (US) products, 18 organic products per page, sorted by best match (default), best selling, best discount, price, rating or newest, filtered by brand, on sale, clearance, open box or a price range. Each product has ${TILE_FIELDS}. ${LISTING_EXTRAS} Sponsored tiles are left out unless include_sponsored. Use a result's sku with get_bestbuy_product, get_bestbuy_reviews, get_bestbuy_availability or get_bestbuy_prices. 2 credits.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'tv'."),
      page: page(),
      sort: z.enum(SEARCH_SORTS).optional()
        .describe("best_match (default), best_selling, best_discount, price_low, price_high, rating or newest."),
      filters: filters(),
      include_sponsored: includeSponsored(),
    },
    post("search"),
  );

  server.tool(
    "get_bestbuy_product",
    `One bestbuy.com (US) product by SKU or URL: name, brand, model, UPC, URL, status, condition, product type, category path, price, regular price, savings, on-sale flag, deal badge, financing offer, every open-box offer by condition (fair, good, excellent) with its price, savings against new (savings_vs_new) and against the regular price (savings_vs_regular), other sellers' and conditions' SKUs of the same product, rating, review count, the AI review summary and what customers love, description, feature list, what's included, the full specification table by group, dimensions, full-size images, manuals and badges. An unknown SKU is a 404 (not billed). 2 credits.`,
    {
      sku: sku(),
      url: productUrl(),
    },
    post("product"),
  );

  server.tool(
    "get_bestbuy_reviews",
    `Customer reviews of one bestbuy.com (US) product by SKU or URL, 20 per page, sorted most relevant (default), most helpful, newest, oldest, highest or lowest rated, optionally only one star rating. Returns the review summary (average rating, review count, recommended percent, star histogram, the most mentioned pros and cons with mention counts), total_results for the filter, total_pages and has_more. Each review has id, title, text, rating, author, date, recommended flag, verified-purchase and incentivized flags, days of ownership, helpful and not-helpful votes, badges, photos, the site it was syndicated from and the brand's response. An unknown SKU is a 404. 2 credits.`,
    {
      sku: sku(),
      url: productUrl(),
      page: z.number().int().min(1).max(500).optional()
        .describe("Reviews page, 1-based, 20 reviews per page, up to 500. Defaults to 1."),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("most_relevant (default), most_helpful, newest, oldest, highest_rated or lowest_rated."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this many stars, 1-5."),
    },
    post("reviews"),
  );

  server.tool(
    "get_bestbuy_category",
    `Browse a bestbuy.com (US) category or deals page by category id or URL, 18 products per page, sorted by best selling (the default on most pages), best discount, price, rating or newest, with the same filters as search_bestbuy. Works on catalogue categories (abcat0101001 All Flat-Screen TVs) and merchandised pages such as All Electronics on Sale (pcmcat1674241939957), whose built-in filters are read from the page itself. Each product has ${TILE_FIELDS}. ${LISTING_EXTRAS} An unknown category, or a page without a product grid, is a 404. 2 credits for an abcat id, 3 for a pcmcat page.`,
    {
      category_id: z.string().regex(/^(abcat\d{7}|pcmcat\d{6,15}|cat\d{5,10})$/).optional()
        .describe("Best Buy category id: abcat... (catalogue categories, e.g. abcat0101001 All Flat-Screen TVs) or pcmcat... (merchandised pages, e.g. pcmcat1674241939957 All Electronics on Sale). A search result's facets list category ids under category_facet. Pass category_id or url."),
      url: z.string().min(1).max(800).optional()
        .describe("A bestbuy.com category page URL (.../<id>.c?id=<id>). Filters in the URL (qp=...) are kept; its sort is not, use sort."),
      page: page(),
      sort: z.enum(CATEGORY_SORTS).optional()
        .describe("best_selling (the default on most pages), best_discount, price_low, price_high, rating or newest."),
      filters: filters(),
      include_sponsored: includeSponsored(),
    },
    post("category"),
  );

  server.tool(
    "get_bestbuy_deals",
    `Today's Best Buy Deal of the Day and the more-deals row under it, with live prices: SKU, name, URL, image, rating, review count, price, regular price, savings in dollars and percent, on-sale flag and deal badge, plus the countdown end as the page shows it. Up to 15 products. No parameters. 3 credits.`,
    {},
    async () => {
      try {
        const data = await getClient().post("/api/v1/bestbuy/deals", {});
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_bestbuy_stores",
    `Best Buy stores near a US ZIP code, nearest first (up to 15): store id, name, address, city, state, ZIP, phone, open status, store type, distance in miles, and dated opening hours for the next 35 days (holiday hours and closed days included). ZIP only, no latitude/longitude. Use a store_id with get_bestbuy_availability. 1 credit.`,
    {
      zip: zip(),
    },
    post("stores"),
  );

  server.tool(
    "get_bestbuy_availability",
    `Store pickup availability of one bestbuy.com SKU at up to 8 stores: the stores nearest a ZIP code (max_stores, default 5) or the store ids you pass. Each store has a status: in_stock, limited (with the real quantity when Best Buy shows "only N left"), ship_to_store (not on the shelf; can be shipped there for pickup by pickup_date), out_of_stock, not_available_for_pickup, or unknown (with a reason, when the store's answer did not include this SKU; never reported as out of stock). Also the pickup date, the minimum hours until pickup, and the nearby store Best Buy suggests when this one cannot fill it. Best Buy does not publish unit counts for well-stocked items, so quantity is null for in_stock. Takes 5-20s. An unknown SKU is a 404. 2 credits flat.`,
    {
      sku: sku(),
      url: productUrl(),
      zip: zip().optional()
        .describe("Check the stores nearest this US ZIP code (max_stores of them), e.g. '94103'. Pass exactly one of zip or store_ids."),
      max_stores: z.number().int().min(1).max(8).optional()
        .describe("With zip: how many of the nearest stores to check, 1-8. Defaults to 5."),
      store_ids: z.array(z.string().regex(/^\d{1,5}$/)).min(1).max(8).optional()
        .describe("Check these stores instead (store numbers, a get_bestbuy_stores result's store_id), up to 8, e.g. ['187', '873']."),
    },
    post("availability"),
  );

  server.tool(
    "get_bestbuy_suggestions",
    `The bestbuy.com search-box autocomplete for a partial query (e.g. "ps5 con"): suggested search terms, each with the categories (id and name) and SKUs Best Buy shows for it, plus any spelling correction. Useful for keyword research and for building queries for search_bestbuy. 1 credit.`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'ps5 con'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_bestbuy_prices",
    `Current bestbuy.com prices for up to 15 SKUs in one call: price, regular price, savings in dollars and percent, on-sale flag, deal badge and deal end time per SKU. A SKU Best Buy does not know comes back found: false; all unknown is a 404. Good for price tracking and price-drop checks across a watchlist. 2 credits per call, whatever the number of SKUs.`,
    {
      skus: z.array(z.string().regex(/^\d{6,9}$/)).min(1).max(15)
        .describe("1-15 Best Buy SKUs, e.g. ['6607832', '6673112', '6679316']."),
    },
    post("prices"),
  );
}
