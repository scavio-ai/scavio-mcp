import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

const REGIONS = ["austin", "corpus-christi", "dallas", "el-paso", "fort-worth", "houston", "san-antonio"] as const;

export function registerSpecsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/specs/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_specs",
    `Search Spec's Wines, Spirits & Finer Foods (Texas liquor chain). Every result has the online price (cents), case price and case quantity, on_promo and keyclub_offer flags, stock, brand, size, category, SKU, UPC and a slug. For per-store prices, pass the slug to get_specs_product. 5 credits/call.`,
    {
      query: z.string().min(1).max(200).describe("Search keywords, e.g. 'titos'."),
      page: z.number().int().min(1).max(50).optional().describe("Page, 1-based. 24 results per page."),
    },
    post("search"),
  );

  server.tool(
    "get_specs_product",
    `One Spec's product with every store's price and stock in store_prices (about 200 Texas stores in one call), the online price, and details: brand, size, proof, ABV, type, origin, region, vintage, tasting notes, images. Pass slug (from search_specs) or product_url. Optional store_id (from get_specs_stores) puts that store's price and stock at the top; available_at_store is false if it does not list the item. 5 credits.`,
    {
      slug: z.string().min(1).max(200).optional().describe("Product slug from search_specs, e.g. 'titos-texas-vodka-5'."),
      product_url: z.string().min(1).max(500).optional().describe("https://specsonline.com/shop/<type>/<slug>/"),
      store_id: z.string().regex(/^\d{1,4}$/).optional()
        .describe('Spec\'s store number, e.g. "169" (Stone Oak, San Antonio).'),
    },
    post("product"),
  );

  server.tool(
    "get_specs_stores",
    `List Spec's stores in a Texas region: store_id, name, status, address, city, zip, phone, coordinates and opening hours per day. Use store_id with get_specs_product. 5 credits.`,
    {
      region: z.enum(REGIONS).describe("austin, corpus-christi, dallas, el-paso, fort-worth, houston or san-antonio."),
    },
    post("stores"),
  );
}
