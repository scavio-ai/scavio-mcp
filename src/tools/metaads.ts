import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerMetaAdsTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_meta_ads",
    `Search Meta Ad Library (Facebook/Instagram). Cursor-paginated (30 first page, 10 after). Cursor is self-contained: other filters ignored when set. Spend/impressions null on commercial ads (political only). 1 credit/page.`,
    {
      query: z.string().min(1).max(200)
        .describe("Keyword or brand. Ignored if cursor set."),
      country: z.string().length(2).optional()
        .describe("Country, e.g. 'US' (default)."),
      active_status: z.enum(["all", "active", "inactive"]).optional()
        .describe("Default 'all'."),
      ad_type: z.enum(["all", "political_and_issue_ads"]).optional()
        .describe("'political_and_issue_ads' to get spend/impressions (null on commercial)."),
      media_type: z.enum(["all", "image", "video", "meme", "image_and_meme", "none"]).optional()
        .describe("Creative media type."),
      search_type: z.enum(["keyword_unordered", "keyword_exact_phrase"]).optional()
        .describe("Default 'keyword_unordered'."),
      cursor: z.string().min(1).optional()
        .describe("next_cursor from prior response. All other filters ignored when set."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/meta-ads/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_meta_ads_advertiser",
    `List all ads for one Meta advertiser by numeric page_id. Same cursor pagination as search_meta_ads. Spend/impressions null on commercial ads. 1 credit/page.`,
    {
      page_id: z.string().regex(/^\d{3,25}$/)
        .describe("Numeric Facebook Page id, e.g. '20531316728'. Not a page name."),
      country: z.string().length(2).optional()
        .describe("Country, e.g. 'US' (default)."),
      active_status: z.enum(["all", "active", "inactive"]).optional()
        .describe("Default 'all'."),
      ad_type: z.enum(["all", "political_and_issue_ads"]).optional()
        .describe("'political_and_issue_ads' for spend/impressions."),
      media_type: z.enum(["all", "image", "video", "meme", "image_and_meme", "none"]).optional()
        .describe("Creative media type."),
      cursor: z.string().min(1).optional()
        .describe("next_cursor from prior response. Filters ignored when set."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/meta-ads/advertiser", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_meta_ad",
    `Get one Meta ad by archive id. Spend/impressions null on commercial ads. 1 credit.`,
    {
      ad_archive_id: z.string().regex(/^\d{3,25}$/)
        .describe("Numeric ad archive id from search_meta_ads."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/meta-ads/ad", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
