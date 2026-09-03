import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerCapterraTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_capterra_software",
    `Search Capterra for B2B software. Max 20 results, no pagination. query or url required. 2 credits.`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Software search term. Either this or url required."),
      url: z.string().min(1).max(1000).optional()
        .describe("Capterra search URL. Either this or query required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/capterra/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_capterra_product",
    `Get full Capterra product profile with 25 most recent reviews included. Use get_capterra_reviews only to page past them. product_id (string, not number) or url required. 2 credits.`,
    {
      product_id: z.string().min(1).max(50).optional()
        .describe("Product id as string, e.g. '186596'. Either this or url required."),
      slug: z.string().min(1).max(200).optional()
        .describe("Product slug. Cosmetic here, load-bearing on get_capterra_reviews."),
      url: z.string().min(1).max(1000).optional()
        .describe("Capterra product URL. Either this or product_id required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/capterra/product", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_capterra_reviews",
    `Page past the 25 reviews in get_capterra_product. 25/page, max page 100. slug is LOAD-BEARING here (case-sensitive; wrong slug silently returns page 1). product_id or url required. 2 credits/page.`,
    {
      product_id: z.string().min(1).max(50).optional()
        .describe("Product id as string. Either this or url required."),
      slug: z.string().min(1).max(200).optional()
        .describe("Product slug. LOAD-BEARING, case-sensitive. Use slug from search/product."),
      url: z.string().min(1).max(1000).optional()
        .describe("Capterra reviews URL. Prefer reviews_url from get_capterra_product."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page 1-100. 25/page. Past 100 returns page 1."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/capterra/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
