import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/sephora.ts. Cross-field rule the backend
// enforces and zod here does not: product takes url OR product_id. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "best_selling", "rating", "price_low", "price_high", "newest"] as const;

const page = () =>
  z.number().int().min(1).max(100).optional()
    .describe("Page, 1-based, 60 per page.");

export function registerSephoraTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/sephora/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_sephora",
    `Search sephora.com (US) products, 60 per page. Each result has product_id, sku_id, brand, name, url, price, list and sale price in dollars (price_range when sizes are priced differently), value price for sets, rating, review count, extra colors, and bestseller, new, Sephora-exclusive, online-only, limited-edition and sponsored flags. Pass zip for same-day delivery eligibility. Also returns category facets with product counts and related searches. Use a result's url with get_sephora_product. 1 credit/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'lipstick'."),
      page: page(),
      sort: z.enum(SORTS).optional()
        .describe("relevance (default), best_selling, rating, price_low, price_high or newest."),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("US ZIP code, e.g. '10001'. Each product then carries same_day_eligible for that ZIP."),
    },
    post("search"),
  );

  server.tool(
    "get_sephora_category",
    `Products in a sephora.com (US) category, 60 per page, same fields as search_sephora, plus the category's id, name and URL, total product count, parent category, subcategories with product counts and breadcrumbs. An unknown category is a 404. 1 credit/call.`,
    {
      category: z.string().min(1).max(300)
        .describe("Category name as in a sephora.com/shop/ URL (e.g. 'lipstick', 'face-serum', 'makeup-cosmetics'), or the full https://www.sephora.com/shop/... URL."),
      page: page(),
    },
    post("category"),
  );

  server.tool(
    "get_sephora_product",
    `One sephora.com (US) product: name, brand, rating, review count, loves count, price range, description, suggested usage, category and breadcrumbs, a summary of what reviews say with pro and con sentiment counts (no review text), and every shade or size as a sku with sku_id, shade, size, price, list and sale price, in_stock, only_few_left, ingredients, images, swatch, and pickup and same-day eligibility. An unknown product is a 404. 1 credit.`,
    {
      url: z.string().min(1).max(500).optional()
        .describe("sephora.com product URL (a search or category result's url), e.g. 'https://www.sephora.com/product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P510799'. Preferred: it answers faster. Pass this or product_id."),
      product_id: z.string().regex(/^[Pp]\d{3,12}$/).optional()
        .describe("Sephora product id (a result's product_id), e.g. 'P510799'. Pass this or url."),
    },
    post("product"),
  );
}
