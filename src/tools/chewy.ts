import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/chewy.ts. Cross-field rules the backend
// enforces and zod here does not: search takes query OR category_id; product
// takes product_id OR url. Chewy has no stores. No zod `.default()`: the MCP
// SDK would post a defaulted field on every call.

const SORTS = ["relevance", "bestselling", "newest", "price_low", "price_high", "rating", "most_reviewed"] as const;

export function registerChewyTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/chewy/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_chewy",
    `Search Chewy products by keyword, or browse a category, 36 per page. Each result has the one-time price, offer and strike-through price, Autoship price and discount, per-unit price, rating, rating count, in-stock flag, deal/new/exclusive/prescription flags, brand, image and product URL. Sponsored listings are removed (sponsored_removed counts them). When Chewy sends a query to a category page instead, redirect gives that category's id, name and URL and the results are that category's. sort echoes the order the results are actually in. Prices are in US dollars. The first-Autoship price, discount and savings cap are filled only on Autoship-deal rows and MAP fields are usually null in search; get_chewy_product always has both. Chewy has no store data. Use a result's product_id with get_chewy_product. 10 credits/call.`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Search keywords, e.g. 'kong classic dog toy'. Pass this or category_id. Some broad queries (e.g. 'dog food') go straight to a category; redirect then names it."),
      category_id: z.string().min(1).max(200).optional()
        .describe("Category to browse instead of a search: the number at the end of a chewy.com /b/ URL ('332' is Dog Food in /b/food-332), or that URL itself."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based. 36 results per page."),
      sort: z.enum(SORTS).optional()
        .describe("relevance (default), bestselling, newest, price_low, price_high, rating or most_reviewed."),
    },
    post("search"),
  );

  server.tool(
    "get_chewy_product",
    `One Chewy product by id or URL: one-time price, offer price, list and strike-through price with savings, MAP price and whether it is enforced, Autoship price and discount, first-Autoship price, discount and savings cap, per-unit price, in-stock flag, rating, rating count, review count and star distribution, brand, GTIN, description, key benefits, specifications, ingredients and feeding details where Chewy lists them, breadcrumbs, images, promotions, and every variant (size, flavor) with its own id, price, Autoship price and stock. Prices are in US dollars. An unknown product id is a 404. 10 credits.`,
    {
      product_id: z.string().regex(/^\d{1,12}$/).optional()
        .describe("Chewy product id: the number after /dp/ in the product URL, or a search result's product_id, e.g. '128666'. Pass this or url."),
      url: z.string().url().max(500).optional()
        .describe("A chewy.com product URL. Pass this or product_id."),
    },
    post("product"),
  );
}
