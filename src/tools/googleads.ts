import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

export function registerGoogleAdsTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "resolve_google_ads_advertiser",
    `Google Ads Transparency Center - the public record of ads running on Google Search, YouTube, Maps, Play and Shopping. START HERE: this resolves a brand name or a domain into the advertiser_id that search_google_ads and get_google_ads_creative are keyed by. Returns two kinds of row in one list as JSON: 'advertiser' rows carrying the advertiser id, Google-verified name, verification country and the advertiser's TOTAL AD COUNT AS A RANGE (total_ads_min / total_ads_max - Google never publishes an exact figure), and 'domain' rows carrying a website. A name query returns both kinds; a domain-shaped query returns domains only. NO PAGINATION - this is an autocomplete. limit applies PER ARM: advertisers and domains are capped separately, so a name query can return up to twice limit rows, and 20 per arm is the ceiling. Costs 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("Brand name or domain to resolve, e.g. 'Nike' or 'nike.com'. A name returns advertiser and domain rows; a domain-shaped query returns domain rows only."),
      region: z.string().min(2).max(12).optional()
        .describe("ISO alpha-2 country code (US, GB, DE) or a Google geo criteria id as a string. Default: no region filter."),
      limit: z.number().int().min(1).max(20).optional()
        .describe("Rows PER ARM, 1-20 (default 10). Advertisers and domains are capped separately, so a name query can return up to twice this many rows in total."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleads/advertisers", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_google_ads",
    `Google Ads Transparency Center - the public record of ads running on Google Search, YouTube, Maps, Play and Shopping. Lists every ad Google is currently running for ONE advertiser, as JSON: the creative (archived image, rich-media bundle, Google's own renderer link, dimensions), the advertiser id and name, the format, first and last seen dates, how many days it actually ran, plus total_ads_min / total_ads_max and next_cursor. Pass domain or advertiser_id - at least one is required; get the advertiser_id from resolve_google_ads_advertiser. PAGINATION IS BY CURSOR: send next_cursor from the previous response as cursor AND RE-SEND THE SAME FILTERS alongside it; next_cursor is null once the advertiser is exhausted. 100 rows is a HARD UPSTREAM CEILING on limit, not our policy - ask for more and Google returns ZERO rows rather than an error. The text, image and video format sets are DISJOINT: an advertiser's text, image and video ads share no creatives, so a format filter is not a subset of the unfiltered result. region scopes the deep links on every row, and the same advertiser can share zero creatives between two countries. Querying by domain is the ONLY way to get the domain field back on each row - an advertiser_id query drops it entirely. The headline ad total is a RANGE (total_ads_min / total_ads_max), never an exact count. Impression and reach figures are DSA-compelled and EEA-ONLY: impressions_min, impressions_max and first_shown are null outside the EEA and always null for US ads - expected, not a bug. Costs 1 credit per page.`,
    {
      domain: z.string().min(1).max(253).optional()
        .describe("Advertiser website - bare host, www host or full URL; reduced to the registrable host. THE ONLY WAY to get the domain field back on each row. Either this or advertiser_id is required."),
      advertiser_id: z.string().min(3).max(40).optional()
        .describe("Google advertiser id from resolve_google_ads_advertiser, e.g. 'AR16735076323512287233'. The shape is checked before any request, so a typo costs nothing. Either this or domain is required."),
      region: z.string().min(2).max(12).optional()
        .describe("ISO alpha-2 country code (US, GB, DE) or a Google geo criteria id as a string. Scopes the deep links on every row; the same advertiser can share zero creatives between two countries. Default: worldwide, no region filter."),
      format: z.enum(["text", "image", "video"]).optional()
        .describe("Creative format. The three sets are DISJOINT - an advertiser's text, image and video ads share no creatives. Default: all formats."),
      platform: z.enum(["play", "maps", "search", "shopping", "youtube"]).optional()
        .describe("Google surface the ad ran on. Default: all surfaces."),
      topic: z.enum(["all", "political"]).optional()
        .describe("Ad topic (default 'all'). 'political' restricts to election and issue ads."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Ads per page, 1-100 (default 40). 100 is a HARD UPSTREAM CEILING: Google answers a larger request with zero rows rather than an error."),
      cursor: z.string().min(1).max(4000).optional()
        .describe("next_cursor from the previous response. RE-SEND THE SAME FILTERS alongside it. next_cursor is null once exhausted."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleads/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_google_ads_creative",
    `Google Ads Transparency Center - the public record of ads running on Google Search, YouTube, Maps, Play and Shopping. Get one ad creative in full as JSON, and the ONLY endpoint that carries its history: every size variation of the asset, the impression bucket, the per-region breakdown with first and last shown dates and a per-surface impression split inside each region, the format, Google's category label, and the funder disclosure on political ads. KEYED BY THE advertiser_id + creative_id PAIR - a creative_id that does not belong to that advertiser is a 404, so take both from the same search_google_ads row. Impression and reach data is DSA-compelled and EEA-ONLY: impressions_min, impressions_max and first_shown are null outside the EEA and always null for US creatives - expected, not a bug, so use an EEA region if you need reach. An impression row can carry a lower bound, an upper bound, or just one of the two. No pagination. Costs 1 credit.`,
    {
      advertiser_id: z.string().min(3).max(40)
        .describe("Google advertiser id, e.g. 'AR16735076323512287233'. Must be the advertiser the creative belongs to - the lookup is keyed by the pair."),
      creative_id: z.string().min(3).max(40)
        .describe("Creative id from a search_google_ads row. Must belong to the advertiser_id sent with it - a mismatched pair is a 404."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/googleads/creative", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
