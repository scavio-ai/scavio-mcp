import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerGoogleAdsTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "resolve_google_ads_advertiser",
    `Resolve a brand or domain to a Google Ads Transparency advertiser_id. Start here before search_google_ads. Region defaults to US, not worldwide. 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("Brand name or domain, e.g. 'Nike' or 'nike.com'."),
      region: z.string().min(2).max(12).optional()
        .describe("Country, e.g. 'US'. Defaults to US, not worldwide."),
      limit: z.number().int().min(1).max(20).optional()
        .describe("Rows per arm (default 10). Not paginated."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleads/advertisers", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_google_ads",
    `List ads for one Google Ads Transparency advertiser. Cursor-paginated (re-send filters with cursor). limit max 100 (higher returns zero). Impressions are EEA-only (null for US). 1 credit/page.`,
    {
      domain: z.string().min(1).max(253).optional()
        .describe("Advertiser domain. Only way to get domain on each row. Either this or advertiser_id required."),
      advertiser_id: z.string().min(3).max(40).optional()
        .describe("From resolve_google_ads_advertiser. Either this or domain required."),
      region: z.string().min(2).max(12).optional()
        .describe("Country, e.g. 'US'. Default: worldwide."),
      format: z.enum(["text", "image", "video"]).optional()
        .describe("Creative format. Sets are disjoint."),
      platform: z.enum(["play", "maps", "search", "shopping", "youtube"]).optional()
        .describe("Google surface."),
      topic: z.enum(["all", "political"]).optional()
        .describe("Default 'all'."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Per page (default 40). Max 100; higher returns zero."),
      cursor: z.string().min(1).max(4000).optional()
        .describe("next_cursor from prior response. Re-send same filters."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleads/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_google_ads_creative",
    `Get one Google Ads Transparency creative with full history and per-region breakdown. Keyed by advertiser_id + creative_id pair (both from same search_google_ads row). Impressions EEA-only. 1 credit.`,
    {
      advertiser_id: z.string().min(3).max(40)
        .describe("Advertiser id owning the creative."),
      creative_id: z.string().min(3).max(40)
        .describe("Creative id from search_google_ads. Must match advertiser_id."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleads/creative", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
