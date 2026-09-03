import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Two-letter ISO only. The transport falls back to the US storefront for
// anything that is not two letters, so 'usa' would silently buy a US result set
// on a billed call — rejecting it here costs nothing.
const countryField = z.string().regex(/^[A-Za-z]{2}$/, "country must be a two-letter ISO country code, e.g. us").optional()
  .describe("Two-letter country code, e.g. 'us', 'gb'. Decides price/currency/availability.");

export function registerAppStoreTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_app_store",
    `Search Apple App Store. NO PAGINATION: use limit (1-200) only. Searching a developer name returns their catalogue. 1 credit.`,
    {
      term: z.string().min(1).max(500)
        .describe("App name, keyword, or publisher name."),
      limit: z.number().int().min(1).max(200).optional()
        .describe("Results 1-200. No pagination, this is the only volume control. Default 25."),
      country: countryField,
      entity: z.enum(["software", "ipad_software", "mac_software"]).optional()
        .describe("Catalogue: 'software' (default), 'ipad_software', 'mac_software'."),
      lang: z.string().regex(/^[A-Za-z]{2}_[A-Za-z]{2}$/, "lang must be a five-letter code, e.g. en_us or ja_jp").optional()
        .describe("Listing text language, e.g. 'en_us', 'ja_jp'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/appstore/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_app_store_app",
    `Get full App Store listing. Accepts numeric id or bundle id (e.g. 'notion.id'). Full URL rejected (extract the id). Unknown id = billed 404. 1 credit.`,
    {
      app_id: z.string().min(1).max(255).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "app_id must be a numeric App Store id (e.g. 1232780281) or a bundle id (e.g. notion.id)")
        .describe("Numeric App Store id or bundle id, e.g. '1232780281' or 'notion.id'."),
      country: countryField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/appstore/app", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_app_store_reviews",
    `Get App Store reviews. NUMERIC ID ONLY (no bundle id). Max page 10, 50 reviews/page (500 max per storefront). Empty result doesn't mean app missing. 1 credit/page.`,
    {
      app_id: z.string().regex(/^\d+$/, "app_id must be a numeric App Store id")
        .describe("Numeric App Store id only, e.g. '1232780281'."),
      country: countryField,
      page: z.number().int().min(1).max(10).optional()
        .describe("Page 1-10, 50 reviews each."),
      sort: z.enum(["most_recent", "most_helpful"]).optional()
        .describe("Sort order. 'most_recent' vote fields are zeroes; 'most_helpful' has real votes."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/appstore/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
