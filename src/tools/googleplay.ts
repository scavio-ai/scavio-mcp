import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

const hlField = z.string().min(2).max(20).optional()
  .describe("UI language, e.g. 'en' or 'pt-BR'. Changes storefront, not just strings.");

const glField = z.string().min(2).max(10).optional()
  .describe("Country code for price/availability, e.g. 'us', 'br'.");

const appIdField = z.string().min(1).max(500)
  .describe("Package name ('com.spotify.music') or play.google.com URL.");

export function registerGooglePlayTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_google_play",
    `Search Google Play (Android apps, NOT web search). NO PAGINATION: ~30 results max, no page/cursor. 2 credits.`,
    {
      query: z.string().min(1).max(200)
        .describe("App name, publisher, or category phrase."),
      hl: hlField,
      gl: glField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleplay/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_google_play_app",
    `Get full Google Play app listing. Includes 20 embedded reviews (use get_google_play_reviews for more). 2 credits.`,
    {
      app_id: appIdField,
      hl: hlField,
      gl: glField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleplay/app", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_google_play_reviews",
    `Get Google Play reviews. Paginate with next_cursor (opaque, encodes sort — keep same sort). Cursor past end = 404. get_google_play_app has 20 free. 2 credits/page.`,
    {
      app_id: appIdField,
      sort: z.enum(["relevance", "newest", "rating"]).optional()
        .describe("Must match the sort the cursor came from. Default 'newest'."),
      count: z.number().int().min(1).max(200).optional()
        .describe("Reviews per page, 1-200. Default 50."),
      cursor: z.string().min(1).max(4000).optional()
        .describe("next_cursor from previous response. Single-use, encodes sort."),
      hl: hlField,
      gl: glField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleplay/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
