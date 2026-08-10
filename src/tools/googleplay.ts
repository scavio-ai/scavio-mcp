import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

const hlField = z.string().min(2).max(20).optional()
  .describe("UI language, e.g. 'en' or 'pt-BR'. Changes the STOREFRONT rather than only the strings - at hl=pt-BR the title, description, install formatting and content rating all move with it. Play silently falls back to English on a language it does not serve. Defaults to 'en'.");

const glField = z.string().min(2).max(10).optional()
  .describe("Two-letter country code deciding which storefront's price and availability are returned (USD / BRL / JPY on the same app). Play silently falls back to the US storefront on a country it does not serve. Defaults to 'us'.");

const appIdField = z.string().min(1).max(500)
  .describe("Android package name ('com.spotify.music') or any play.google.com URL carrying one in its id param.");

export function registerGooglePlayTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_google_play",
    `Search Google Play, the Android app store (NOT Google web search), and return ranked apps as JSON: package name, title, developer, rating, install count, price and in-app-purchase range, content rating, icon and screenshots. A branded query returns Play's hero card as result 1 projected to the same row shape, plus Play's related-query rail. NO PAGINATION - Play serves one shelf of about 30 apps and there is no page or cursor parameter, so do not try to page for more. hl changes the STOREFRONT, not just the strings (title, description, install formatting and content rating all move with it), and Play silently falls back to English/US on a value it does not serve. Apps only: games are folded into the apps vertical, but books and films use a different card shape and are not covered. Costs 2 credits.`,
    {
      query: z.string().min(1).max(200)
        .describe("What to search the store for: an app name, a publisher, or a category phrase, e.g. 'music player'."),
      hl: hlField,
      gl: glField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleplay/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_google_play_app",
    `Get one Google Play (Android app store) listing in full as JSON: installs including the REAL install count Play publishes but never renders on the page, rating and star histogram, description, developer identity and legal contact, price and in-app purchases, categories and gameplay tags, screenshots and trailer, version and Android requirement, release and update dates, changelog, the full permission tree, the Data safety table, the 20 server-rendered reviews, and the similar-apps and more-by-developer rails. Those 20 reviews ride along at no extra cost - only call get_google_play_reviews to page past them or to sort differently. Accepts an Android package name ('com.spotify.music') or any play.google.com URL carrying one in its id param. Costs 2 credits.`,
    {
      app_id: appIdField,
      hl: hlField,
      gl: glField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleplay/app", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_google_play_reviews",
    `Get a page of Google Play (Android app store) reviews as JSON: star score, full text, author, thumbs-up count, developer reply, and the APP VERSION the reviewer was running. Page with data.next_cursor sent back as cursor. The cursor is OPAQUE and SINGLE-USE and encodes the sort as well as the position, so send it back with the SAME sort it came from; a cursor past the last review is a 404, not an empty page. count is capped at 200 - a single page that large is megabytes for one call. get_google_play_app already returns 20 reviews for free, so use this only to go past them or to sort differently. A package with no reviews, or one that does not exist, answers a BILLED 404. Costs 2 credits per page.`,
    {
      app_id: appIdField,
      sort: z.enum(["relevance", "newest", "rating"]).optional()
        .describe("Review ordering. If you are paging with a cursor, this MUST match the sort the cursor came from. Defaults to 'newest'."),
      count: z.number().int().min(1).max(200).optional()
        .describe("Reviews to return, 1-200. Play itself honours far more, but a single page that large is megabytes for one credit - page with cursor instead. Defaults to 50."),
      cursor: z.string().min(1).max(4000).optional()
        .describe("Continuation token from a previous response's next_cursor. Opaque and SINGLE-USE, and it encodes the sort as well as the position, so resend it with the same sort. A cursor past the last review is a 404, not an empty page."),
      hl: hlField,
      gl: glField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleplay/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
