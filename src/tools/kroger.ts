import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerKrogerTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/kroger/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_kroger",
    `Search Kroger grocery products by keyword. Kroger operates Kroger, Ralphs, Fred Meyer, Harris Teeter, King Soopers, Fry's and other banners. Returns price (cents), promo price, n-for deals, unit price, size, UPC, stock, SNAP eligibility, dietary info, rating and category. 2 credits/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'organic milk'."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based."),
    },
    post("search"),
  );

  server.tool(
    "get_kroger_product",
    `Full Kroger product detail by URL or UPC: nutrition facts (allergens, ingredients, nutrients with daily values), description, images, rating distribution, store aisle location, stock level, dietary flags (organic, non-GMO, gluten-free), SNAP eligibility, dimensions and country of origin. Pass product_url (from search_kroger) or upc. 2 credits.`,
    {
      product_url: z.string().min(1).max(500).optional()
        .describe("Full or relative product URL from kroger.com, e.g. '/p/kroger-2-reduced-fat-milk-gallon/0001111041700'. Preferred."),
      upc: z.string().min(1).max(20).optional()
        .describe("Kroger product UPC (from search_kroger or product URLs: /p/{slug}/{upc})."),
      slug: z.string().min(1).max(300).optional()
        .describe("Product slug for readable URL. Optional with upc."),
    },
    post("product"),
  );
}
