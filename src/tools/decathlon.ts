import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

const COUNTRIES = ["fr", "es", "it", "in", "uk", "pt", "net"] as const;

export function registerDecathlonTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/decathlon/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_decathlon",
    `Search Decathlon products by keyword across 7 country domains (FR, ES, IT, IN, UK, PT, NET). Returns product name, brand, price (cents), currency, availability, rating, review count and image. 2 credits/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'running shoes'."),
      country: z.enum(COUNTRIES)
        .describe('Country domain: "fr" (France), "es" (Spain), "it" (Italy), "in" (India), "uk" (UK), "pt" (Portugal), "net" (international).'),
      page: z.number().int().min(1).max(50).optional()
        .describe("Page, 1-based."),
    },
    post("search"),
  );

  server.tool(
    "get_decathlon_product",
    `Full Decathlon product detail by URL or product ID: description, images, SKU, GTIN, color, price (cents), list price, availability, offers/variants, rating, review count, category and breadcrumbs. Supports all 7 country domains. Pass product_url (from search_decathlon) or product_id. 2 credits.`,
    {
      product_url: z.string().min(1).max(500).optional()
        .describe("Full or relative product URL from any Decathlon domain, e.g. '/p/mens-running-shoes/123456/...'. Preferred."),
      product_id: z.string().min(1).max(20).optional()
        .describe("Decathlon numeric product ID (from the /p/{slug}/{id}/... URL pattern)."),
      country: z.enum(COUNTRIES)
        .describe('Country domain: "fr" (France), "es" (Spain), "it" (Italy), "in" (India), "uk" (UK), "pt" (Portugal), "net" (international).'),
    },
    post("product"),
  );
}
