import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

export function registerMetaAdsTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_meta_ads",
    `Meta Ad Library - every ad running on Facebook and Instagram, public and logged-out. Search it by keyword and get 30 ads on page one as JSON, each with the full creative: advertising page name, ad copy, headline, call to action, image and video URLs, which platforms it ran on, and its run dates. Also returns total_results, total_is_capped, has_next_page and next_cursor. FULL CURSOR PAGINATION, which is the differentiator here: page one is 30 ads, every page after it is 10, and walking has_next_page with next_cursor lets you scrape an entire query rather than a sample. THE CURSOR IS SELF-CONTAINED, SO ALL OTHER FILTERS ARE IGNORED WHEN YOU SEND ONE - it already carries the query, country and filters from page one; changing them mid-walk does nothing. total_results CAPS AT 50000 with total_is_capped set true, because Meta only reports ">50,000" - never present it as an exact count. spend, reach, impressions and the paid-for-by disclosure are NULL ON COMMERCIAL ADS: only political and issue ads carry them, so set ad_type='political_and_issue_ads' if you need spend data. Costs 1 CREDIT PER PAGE, so a full crawl costs roughly 1 credit per 10 ads past the first 30 - budget the walk before starting it.`,
    {
      query: z.string().min(1).max(200)
        .describe("Keyword or brand to search the ad library for, e.g. 'protein powder' or 'Ridge Wallet'. Ignored if cursor is set."),
      country: z.string().length(2).optional()
        .describe("Two-letter country code the ads ran in, e.g. 'US', 'GB', 'DE' (default 'US')."),
      active_status: z.enum(["all", "active", "inactive"]).optional()
        .describe("Whether the ad is still running (default 'all')."),
      ad_type: z.enum(["all", "political_and_issue_ads"]).optional()
        .describe("Ad category (default 'all'). Set 'political_and_issue_ads' to expose spend, reach, impressions and the paid-for-by disclosure - those fields are null on commercial ads."),
      media_type: z.enum(["all", "image", "video", "meme", "image_and_meme", "none"]).optional()
        .describe("Creative media type. Default: no media filter."),
      search_type: z.enum(["keyword_unordered", "keyword_exact_phrase"]).optional()
        .describe("How the query is matched (default 'keyword_unordered'). 'keyword_exact_phrase' requires the words in order."),
      cursor: z.string().min(1).optional()
        .describe("next_cursor from the previous response. Page one is 30 ads, each page after it is 10. THE OTHER FILTERS ARE IGNORED when this is set - the cursor already carries them."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/meta-ads/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_meta_ads_advertiser",
    `Meta Ad Library - every ad running on Facebook and Instagram, public and logged-out. Get every ad ONE advertiser is running, addressed by its numeric Facebook Page id. Returns 30 ads on page one as JSON with the same creative detail as search_meta_ads: page name, ad copy, headline, call to action, image and video URLs, platforms and run dates, plus has_next_page and next_cursor. CURSOR PAGINATION: page one is 30 ads, every page after it is 10 - walk has_next_page with next_cursor to pull an advertiser's whole active set. THE CURSOR IS SELF-CONTAINED, SO THE OTHER FILTERS ARE IGNORED WHEN YOU SEND ONE. Requires the NUMERIC page id, not a page name or vanity handle. spend, reach, impressions and the paid-for-by disclosure are NULL ON COMMERCIAL ADS - only political and issue ads carry them, so set ad_type='political_and_issue_ads' if you need spend data. Costs 1 CREDIT PER PAGE, roughly 1 credit per 10 ads past the first 30.`,
    {
      page_id: z.string().regex(/^\d{3,25}$/)
        .describe("The advertiser's NUMERIC Facebook Page id, digits only, e.g. '20531316728'. A page name or vanity handle will not work."),
      country: z.string().length(2).optional()
        .describe("Two-letter country code the ads ran in, e.g. 'US', 'GB', 'DE' (default 'US')."),
      active_status: z.enum(["all", "active", "inactive"]).optional()
        .describe("Whether the ad is still running (default 'all')."),
      ad_type: z.enum(["all", "political_and_issue_ads"]).optional()
        .describe("Ad category (default 'all'). Set 'political_and_issue_ads' to expose spend, reach, impressions and the paid-for-by disclosure - those fields are null on commercial ads."),
      media_type: z.enum(["all", "image", "video", "meme", "image_and_meme", "none"]).optional()
        .describe("Creative media type. Default: no media filter."),
      cursor: z.string().min(1).optional()
        .describe("next_cursor from the previous response. Page one is 30 ads, each page after it is 10. The other filters are ignored when this is set."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/meta-ads/advertiser", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_meta_ad",
    `Meta Ad Library - every ad running on Facebook and Instagram, public and logged-out. Get ONE ad in full as JSON by its ad archive id: the creative, the advertiser, run dates, the platforms it ran on, and any political disclosure. Use it to expand a single ad you already found via search_meta_ads or get_meta_ads_advertiser. Requires the numeric ad_archive_id. No pagination - one ad, one call. spend, reach, impressions and the paid-for-by disclosure are NULL unless this is a political or issue ad; commercial ads never carry them. Costs 1 credit.`,
    {
      ad_archive_id: z.string().regex(/^\d{3,25}$/)
        .describe("The ad's numeric archive id, digits only, e.g. '1234567890123456'. Take it from a search_meta_ads or get_meta_ads_advertiser row."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/meta-ads/ad", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
