import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/cvs.ts. Cross-field rule the backend
// enforces and zod here does not: product takes url OR product_id. CVS has no
// store locator endpoint. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const STORE_HELP =
  'The store number is on every cvs.com store page ("Store ID: #7019") and in its URL (.../storeid=7019).';

const numericId = () => z.string().regex(/^\d{3,10}$/);

export function registerCvsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/cvs/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_cvs",
    `Search CVS front-store products (no pharmacy). Each result has product_id and sku_id, name, brand, URL, regular, sale and unit price, promotion text, rating, review count, size, image, coupons (ExtraBucks rewards and manufacturer coupons) and stock at one store: units in store, for pickup and for same-day delivery, plus online ship availability. Prices are in dollars and the same at every store. Stock defaults to store 7019 (New York) when store_id is omitted. Includes brand, price-range and rating facets. 1 credit/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'toothpaste', or a CVS item number."),
      store_id: z.string().regex(/^\d{1,5}$/).optional()
        .describe(`CVS store number for the stock fields, e.g. '7019'. Default 7019 (150 East 42nd St, New York, NY). ${STORE_HELP}`),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based."),
      limit: z.number().int().min(1).max(48).optional()
        .describe("Results per page, 1-48. Default 20."),
    },
    post("search"),
  );

  server.tool(
    "get_cvs_product",
    `One CVS product by URL or id: regular and sale price, unit price, promotion and its end date, rating, review count, UPC, size, description, highlights, ingredients, directions, warnings, attributes, breadcrumbs, images and every variant (sku_id, UPC, size, price, rating). Can take 10-30+ seconds. An unknown product is a 404. 1 credit.`,
    {
      url: z.string().max(500).optional()
        .describe("cvs.com product URL, https://www.cvs.com/shop/<name>-prodid-<id>. Pass this or product_id."),
      product_id: numericId().optional()
        .describe("CVS product id or SKU id (the number after prodid- in a product URL, or a search result's product_id or sku_id), e.g. '789787'. Pass this or url."),
    },
    post("product"),
  );

  server.tool(
    "get_cvs_stock",
    `Units available at one CVS store for up to 20 SKUs in one call: in_store (on the shelf), pickup (order online, pick up there) and ship (online stock, chain-wide). same_day_delivery is always null here; search returns same-day units. An unknown SKU or store number reads as 0. 1 credit.`,
    {
      sku_ids: z.array(numericId()).min(1).max(20)
        .describe("Up to 20 CVS SKU ids (a search result's sku_id or a product's variants[].sku_id), e.g. ['789787', '949346']."),
      store_id: z.string().regex(/^\d{1,5}$/)
        .describe(`CVS store number, e.g. '7019'. ${STORE_HELP}`),
    },
    post("stock"),
  );
}
