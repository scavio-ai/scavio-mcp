import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerHebTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/heb/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_heb",
    `Search HEB grocery products by keyword. Returns price (cents), list price, sale status, unit price, size, UPC, stock, EBT/SNAP eligibility, category, aisle location and product URL. Pass store_id (from get_heb_stores) for one store's prices, stock and assortment. 2 credits/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'organic milk'."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based."),
      page_size: z.number().int().min(1).max(60).optional()
        .describe("Results per page, max 60. Default 60."),
      store_id: z.union([z.string().regex(/^\d{1,5}$/), z.number().int().positive()]).optional()
        .describe("HEB store number from get_heb_stores (field store_number), e.g. '441'. Prices, stock, aisle location and assortment come from that store and the store used is echoed in data.store. Omit for HEB's default store."),
    },
    post("search"),
  );

  server.tool(
    "get_heb_product",
    `Full HEB product detail: nutrition facts (serving size, calories, nutrients with daily values), ingredients, description, images, similar products, coupons, EBT/SNAP eligibility, breadcrumbs, aisle location. Pass product_url (from search_heb) or slug + product_id; with store_id, product_id alone works and price, stock and aisle come from that store. 2 credits.`,
    {
      product_url: z.string().min(1).max(500).optional()
        .describe("Full or relative product URL from heb.com, e.g. '/product-detail/central-market-organics-whole-milk-1-gal/931316'. Preferred."),
      product_id: z.string().min(1).max(20).optional()
        .describe("HEB product id (numeric id at the end of a product URL). Requires slug, unless store_id is set."),
      slug: z.string().min(1).max(300).optional()
        .describe("Product slug (readable part of the URL). Required with product_id, unless store_id is set."),
      store_id: z.union([z.string().regex(/^\d{1,5}$/), z.number().int().positive()]).optional()
        .describe("HEB store number from get_heb_stores (field store_number), e.g. '441'. Price, stock and aisle location come from that store and the store used is echoed in data.store. Omit for HEB's default store."),
    },
    post("product"),
  );

  server.tool(
    "get_heb_stores",
    `Find HEB stores near a US ZIP code or city. Returns store number, address, phone, hours, pharmacy availability, fulfillment channels (curbside, delivery, in-store), distance and store URL. 2 credits.`,
    {
      zip: z.string().regex(/^\d{5}$/).optional()
        .describe("5-digit US ZIP code, e.g. '78701'."),
      city: z.string().min(1).max(100).optional()
        .describe("City name, e.g. 'Austin'. Pass zip or city."),
    },
    post("stores"),
  );
}
