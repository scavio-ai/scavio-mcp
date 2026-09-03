import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Kuaishou is priced PER ENDPOINT off four upstream price points, so every tool
// carries its own cost line. A single platform-wide "costs N credits" claim is
// wrong by up to 40x, which is why this sentence is appended everywhere rather
// than stated once.
const PRICING = "";

// This is CHINA Kuaishou (kuaishou.com). Our upstream source does not serve
// Kwai international (kwai.com): a real kwai.com id returns an empty envelope and
// still bills, so the distinction goes in the description, not a comment.
const NOT_KWAI = "China kuaishou.com only, not Kwai international.";

const CURSOR_DESC =
  "data.pcursor from previous response (NOT next_cursor). 'no_more' = last page.";

const SEARCH_CURSOR_DESC =
  "data.pcursor (NOT next_cursor or recoPcursor). 'no_more' = last page.";

const KEYWORD_DESC =
  "Search keyword. Chinese keywords recommended (Chinese-language platform).";

export function registerKuaishouTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_kuaishou_profile",
    `Get a Kuaishou creator profile. 10 credits (resolve_kuaishou_user is 1cr, get_kuaishou_video is 2cr and includes follower count). ${NOT_KWAI}`,
    {
      user_id: z.string().min(1)
        .describe("User id (numeric or alphanumeric form both work)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/profile", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_user_posts",
    `List a Kuaishou creator's posts. photo_id in feeds is rounded (>2^53); use share_info for exact ids. 1 credit/page. ${NOT_KWAI}`,
    {
      user_id: z.string().min(1)
        .describe("User id."),
      cursor: z.string().optional()
        .describe(CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/user/posts", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_user_live",
    `Check if a Kuaishou creator is live. Offline = absent liveStream (still billed). 1 credit. ${NOT_KWAI}`,
    {
      user_id: z.string().min(1)
        .describe("User id."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/user/live", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "resolve_kuaishou_user",
    `Resolve a Kuaishou share link to a user_id. kuaishou.com/v.kuaishou.com only (not kwai.com). 1 credit.`,
    {
      share_link: z.string().url()
        .describe("kuaishou.com or v.kuaishou.com URL. kwai.com not supported."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/user/resolve", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_video",
    `Get a Kuaishou video by photo_id or URL. Includes author follower count (saves 10cr profile call). camelCase fields (unlike feed endpoints). Pass photo_id or url. 2 credits. ${NOT_KWAI}`,
    {
      photo_id: z.string().min(1).optional()
        .describe("Photo/video id (numeric or alphanumeric). Use share_info from feeds, not rounded photo_id. Either this or url required."),
      url: z.string().url().optional()
        .describe("kuaishou.com video URL. Either this or photo_id required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/video", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_video_comments",
    `Get comments on a Kuaishou video. Check data.subCommentsMap first (free pre-loaded replies) before calling get_kuaishou_comment_replies. 1 credit/page. ${NOT_KWAI}`,
    {
      photo_id: z.string().min(1)
        .describe("Photo id (no URL form). Use exact id from share_info, not rounded photo_id."),
      cursor: z.string().optional()
        .describe(CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/video/comments", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_comment_replies",
    `Get replies to a Kuaishou comment. Wrong root_comment_id silently returns empty (still billed). Only call when subCommentCount > 0. 1 credit/page. ${NOT_KWAI}`,
    {
      photo_id: z.string().min(1)
        .describe("Photo id from the same video_comments response."),
      root_comment_id: z.string().min(1)
        .describe("comment_id from rootComments[]. Must match photo_id's video."),
      cursor: z.string().optional()
        .describe(CURSOR_DESC),
      count: z.number().int().min(1).max(50).optional()
        .describe("Replies per page, 1-50."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/video/sub-comments", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_videos_batch",
    `Batch lookup up to 20 Kuaishou videos. 40 CREDITS FLAT regardless of count (get_kuaishou_video is 2cr each, cheaper below ~20). Missing ids silently omitted. Match on originalPhotoId not rounded photo_id. ${NOT_KWAI}`,
    {
      photo_ids: z.array(z.string().min(1)).min(1).max(20)
        .describe("1-20 photo ids (numeric form). >20 rejected."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/videos/batch", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_kuaishou",
    `Mixed search on Kuaishou (videos, users, live, promos). Filter on itemType: 5=video, 4=user, 6=live, 9=related, 25=ad. Slow (~20s); prefer search_kuaishou_videos/users/live for speed. 10 credits/page. ${NOT_KWAI}`,
    {
      keyword: z.string().min(1).max(200)
        .describe(KEYWORD_DESC),
      cursor: z.string().optional()
        .describe(SEARCH_CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_kuaishou_videos",
    `Search Kuaishou videos by keyword. Filter on itemType=5 (item.feed). Use share_info for exact ids. Faster than search_kuaishou. 10 credits/page. ${NOT_KWAI}`,
    {
      keyword: z.string().min(1).max(200)
        .describe(KEYWORD_DESC),
      cursor: z.string().optional()
        .describe(SEARCH_CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/search/videos", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_kuaishou_users",
    `Search Kuaishou users/creators. Returns user_id needed for profile/posts/live endpoints. Filter on itemType=4. No server-side follower/verified filter. 10 credits/page. ${NOT_KWAI}`,
    {
      keyword: z.string().min(1).max(200)
        .describe(KEYWORD_DESC),
      cursor: z.string().optional()
        .describe(SEARCH_CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/search/users", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_kuaishou_live",
    `Search Kuaishou live streams currently on air. Filter on itemType=6. Data is a snapshot (URLs expire when broadcast ends). likeCount/audienceCount are strings ("629.1k"), not ints. 10 credits/page (get_kuaishou_user_live is 1cr for a single user). ${NOT_KWAI}`,
    {
      keyword: z.string().min(1).max(200)
        .describe(KEYWORD_DESC),
      cursor: z.string().optional()
        .describe(SEARCH_CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/search/live", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_tag_feed",
    `Get Kuaishou hashtag feed. Send tag WITHOUT '#'. Check tagInfo.name (near-miss resolves to different tag). No sort param. 1 credit/page. ${NOT_KWAI}`,
    {
      tag: z.string().min(1).max(200)
        .describe("Tag text without '#'. Chinese tags recommended."),
      cursor: z.string().optional()
        .describe(CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/tag/feed", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_trending",
    `Get a Kuaishou trending leaderboard. Each board has a different response shape. Non-empty ksOrderId = promoted slot. 1 credit. ${NOT_KWAI}`,
    {
      board: z.enum(["hot", "live", "shopping", "brand", "music"]).optional()
        .describe("Board: 'hot' (default), 'live', 'shopping', 'brand', 'music'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/trending", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
