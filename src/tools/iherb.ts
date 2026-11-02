import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/iherb.ts. Cross-field rule the backend
// enforces and zod here does not: product and reviews take product_id OR url.
// iHerb is online only (no stores) and always the US store in USD. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "best_selling", "rating", "price_asc", "price_desc", "newest", "percent_off", "review_count"] as const;

const productId = () => z.string().regex(/^\d{1,9}$/);

const productFields = () => ({
  product_id: productId().optional()
    .describe("iHerb product id, the number at the end of an iherb.com/pr/ URL (a search result's product_id), e.g. '62118'. Pass this or url."),
  url: z.string().min(1).max(500).optional()
    .describe("An iherb.com product URL. Data is always the US store's, whatever the URL's country."),
});

export function registerIherbTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/iherb/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_iherb",
    `Search iHerb (US store, USD) by keyword, 48 products per page. Each result has product_id, part_number, name, brand, brand_code, URL, image, price, list_price, original_price and discount_percent when discounted, rating, review_count, in_stock, badges (e.g. Best seller, iHerb Brands, New), recent_sales (e.g. "30K+ sold in 30 days") and position. Also returns total_results and brand_filters (brand_code, name and match count for the top brands) for narrowing with brand_code. iHerb is online only: no stores. Use a result's product_id with get_iherb_product, get_iherb_prices or get_iherb_reviews. 2 credits/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'vitamin d'."),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based. 48 results per page."),
      sort: z.enum(SORTS).optional()
        .describe("relevance, best_selling, rating, price_asc, price_desc, newest, percent_off (highest discount first) or review_count. Default iHerb's featured order."),
      brand_code: z.string().regex(/^[A-Za-z0-9]{2,10}$/).optional()
        .describe("Only this brand, by iHerb brand code, e.g. 'CGN' (California Gold Nutrition) or 'NOW' (NOW Foods): a result's brand_code or a brand_filters entry."),
    },
    post("search"),
  );

  server.tool(
    "get_iherb_product",
    `One iHerb product by id or URL (US store, USD): name, brand, part number, UPC, price, list price, discount, price per serving or unit, stock status, discontinued and coming-soon flags, quantity limit, expiration date, first-available date, package quantity, weight and dimensions, rating and review count, category breadcrumbs, best-seller rankings by category, badges, variants (size, potency, flavor) with their product ids and prices, supplement facts (serving size, servings per container, nutrients with amount and % daily value), description, suggested use, ingredients, warnings and images. An unknown product id is a 404. 2 credits.`,
    productFields(),
    post("product"),
  );

  server.tool(
    "get_iherb_prices",
    `Current price, list price, discount, in-stock flag, rating and review count for up to 50 iHerb products in one call (US store, USD). One row per requested id, in request order; unknown ids come back with found: false and are listed in not_found. The cheapest way to monitor iHerb prices and stock across many products. 2 credits.`,
    {
      product_ids: z.array(productId()).min(1).max(50)
        .describe("Up to 50 iHerb product ids, e.g. ['62118', '70316', '77548']. Duplicates are answered once."),
    },
    post("prices"),
  );

  server.tool(
    "get_iherb_reviews",
    `The review summary for one iHerb product: average rating, total review count, star histogram (count and percent per star), review counts per language, and the full text of the top positive and top critical review with rating, title, author, country, date, verified-purchase flag, helpful votes and images. Not a full review list. 2 credits.`,
    productFields(),
    post("reviews"),
  );
}
