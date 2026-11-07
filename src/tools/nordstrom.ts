import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/nordstrom.ts. Cross-field rule the backend
// enforces and zod here does not: product takes url OR style_id. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "rating", "price_high", "price_low", "newest", "percent_off"] as const;

export function registerNordstromTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/nordstrom/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_nordstrom",
    `Search nordstrom.com (US) products, 24 per page, sorted by relevance, rating, price, newest or percent off. Each result has style id, URL, name, brand, image, current price and price range in dollars, original price range, percent off and on-sale flag, rating, review count, badges such as new or new_markdown, a low-inventory flag, whether it is sold by a marketplace seller (and the seller's name), and every color with its color family and image. Also returns the total result count and page count. Use a result's url or style_id with get_nordstrom_product. 5 credits/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Results page, 1-based. Defaults to 1. 24 products per page."),
      sort: z.enum(SORTS).optional()
        .describe("relevance (default), rating, price_high, price_low, newest or percent_off."),
    },
    post("search"),
  );

  server.tool(
    "get_nordstrom_product",
    `One nordstrom.com (US) product by URL or style id: name, brand, description, feature bullets, fit notes, final-sale flag, current, original and clearance price ranges, percent off, rating, review count, the star histogram, the size-fit distribution (too small to too big), the AI review summary when the site shows one, the most mentioned praised and criticized features with a quote each, breadcrumbs and images. Every color lists its images and every size as a sku with sku id, size, size type, UPC, price, original price, percent off, price type (regular, clearance, promotion), in_stock and the quantity available to ship. Includes the 12-13 reviews shown on the product page, with title, text, rating, size rating, author, date, helpful votes and verified-purchase flag. An unknown style id is a 404. 5 credits.`,
    {
      url: z.string().min(1).max(500).optional()
        .describe("nordstrom.com product URL (the `url` of a search result)."),
      style_id: z.string().regex(/^\d{4,10}$/).optional()
        .describe("Nordstrom style id, the number at the end of a product URL (the `style_id` of a search result). Used when url is not given."),
    },
    post("product"),
  );
}
