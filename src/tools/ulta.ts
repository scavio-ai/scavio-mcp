import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/ulta.ts. No zod `.default()`: the MCP SDK
// would post a defaulted field on every call.

const page = () =>
  z.number().int().min(1).max(100).optional()
    .describe("Page, 1-based, 64 per page plus sponsored placements.");

const skuId = () =>
  z.string().regex(/^\d{3,12}$/)
    .describe("Ulta sku id of a shade or size (a result's sku_id or a product's variants[].sku_id), e.g. '2648428'.");

const CARD_FIELDS =
  "Each product has product_id, sku_id, brand, name, url, list and sale price in dollars (the low end when shades are priced differently, with list_price_range / sale_price_range), discount, promo text, rating, review count, badge, variant label (e.g. '16 colors'), limited-stock flag and sponsored.";

export function registerUltaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/ulta/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_ulta",
    `Search Ulta Beauty products by keyword, 64 per page plus sponsored placements. ${CARD_FIELDS} Sponsored placements can repeat products from other pages; dedupe by product_id. Use a result's url with get_ulta_product, or its product_id and sku_id with get_ulta_stores. 1 credit/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'lipstick'."),
      page: page(),
    },
    post("search"),
  );

  server.tool(
    "get_ulta_category",
    `Products in an Ulta Beauty category, 64 per page plus sponsored placements, with the category title and total_results. ${CARD_FIELDS} 1 credit/call.`,
    {
      category: z.string().min(1).max(300)
        .describe("An ulta.com category that lists products: the full URL or its path, e.g. '/shop/makeup/lips/lipstick'. Landing pages with no product grid (e.g. /shop/makeup) are a 404."),
      page: page(),
    },
    post("category"),
  );

  server.tool(
    "get_ulta_product",
    `One Ulta Beauty product by page URL, for the selected shade or size: list and sale price, discount, availability, GTIN, rating, review count, badges, summary, description, usage, ingredients, restrictions, category and breadcrumbs, images, every shade or size variant (sku_id, name, shade description, available, swatch), ship / pickup / same-day eligibility, and the five most recent customer reviews. An unknown product is a 404. 1 credit.`,
    {
      url: z.string().min(1).max(500)
        .describe("Ulta product page URL, /p/<name>-<productId> (a search or category result's url), e.g. 'https://www.ulta.com/p/serum-lipstick-pimprod2057119'. The name part is required."),
      sku: z.string().regex(/^\d{3,12}$/).optional()
        .describe("Shade or size to select, by sku id (a variants[].sku_id). Defaults to the URL's ?sku=, else the product's default."),
    },
    post("product"),
  );

  server.tool(
    "get_ulta_stores",
    `In-store pickup availability of one Ulta Beauty shade or size at the 10 stores nearest a US ZIP: store id, name, address, distance in miles, open now and hours label, curbside label, in_stock and the availability label. Ulta publishes in stock / out of stock per store, not unit counts. 1 credit.`,
    {
      product_id: z.string().regex(/^[A-Za-z]*\d+$/)
        .describe("Ulta product id (a search or product result's product_id), e.g. 'pimprod2057119'."),
      sku_id: skuId(),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/)
        .describe("US ZIP code to search around, e.g. '10001'."),
    },
    post("stores"),
  );
}
