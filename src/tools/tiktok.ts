import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { ScavioClient } from "../lib/client.js";
import { ApiError } from "../lib/errors.js";

function handleApiError(err: unknown): never | { isError: true; content: { type: "text"; text: string }[] } {
  if (err instanceof ApiError) {
    if (err.status === 429) return { isError: true, content: [{ type: "text", text: "Rate limited. Wait and retry." }] };
    if (err.status === 401) throw new McpError(ErrorCode.InternalError, "Invalid SCAVIO_API_KEY. Check your configuration.");
    return { isError: true, content: [{ type: "text", text: `Scavio API error (${err.status}): ${err.message}` }] };
  }
  throw new McpError(ErrorCode.InternalError, String(err));
}

export function registerTiktokTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_tiktok_profile",
    `Get a TikTok user's profile data as JSON. Returns username, display name, bio, follower/following counts, video count, total likes, and avatar URL. Use when the user wants info about a TikTok account. Provide either username or sec_user_id.`,
    {
      username: z.string().optional()
        .describe("TikTok handle without the @ symbol, e.g. 'charlidamelio'."),
      sec_user_id: z.string().optional()
        .describe("Secure user ID. Use this if you already have it from a previous request."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/profile", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_user_posts",
    `List a TikTok user's videos with pagination as JSON. Each video includes ID, caption, timestamp, and stats (likes, comments, views, shares, bookmarks). Requires sec_user_id from the profile endpoint. Use data.max_cursor for next page; stop when data.has_more is 0.`,
    {
      sec_user_id: z.string()
        .describe("Secure user ID from the get_tiktok_profile response."),
      cursor: z.string().default("0")
        .describe("Pagination cursor. Use data.max_cursor from previous response for next page."),
      count: z.number().int().min(1).max(30).default(20)
        .describe("Number of results per page (1-30)."),
      sort_type: z.enum(["0", "1"]).default("0")
        .describe("Sort order. '0' = latest first, '1' = most popular first."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/user/posts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_video",
    `Get detailed info for a single TikTok video by ID as JSON. Returns caption, author, music, stats (likes, comments, views, shares, bookmarks), play/download URLs, cover image, duration, hashtags, and mentions. Use when the user has a specific TikTok video URL or ID.`,
    {
      video_id: z.string()
        .describe("TikTok video ID. Extract from a TikTok URL if the user provides one."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/video", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_video_comments",
    `Get comments on a TikTok video as JSON. Each comment includes ID, text, timestamp, like count, reply count, commenter info, and whether the video creator liked it. Use data.cursor for next page; stop when data.has_more is 0.`,
    {
      video_id: z.string()
        .describe("TikTok video ID."),
      cursor: z.string().default("0")
        .describe("Pagination cursor. Use data.cursor from previous response for next page."),
      count: z.number().int().min(1).max(50).default(20)
        .describe("Number of comments per page (1-50)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/video/comments", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_comment_replies",
    `Get replies to a specific comment on a TikTok video as JSON. Each reply has the same structure as a comment. Requires both video_id and comment_id. Use data.cursor for next page; stop when data.has_more is 0.`,
    {
      video_id: z.string()
        .describe("TikTok video ID."),
      comment_id: z.string()
        .describe("Comment ID (cid) from the get_tiktok_video_comments response."),
      cursor: z.string().default("0")
        .describe("Pagination cursor. Use data.cursor from previous response for next page."),
      count: z.number().int().min(1).max(50).default(20)
        .describe("Number of replies per page (1-50)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/video/comments/replies", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_tiktok_videos",
    `Search TikTok videos by keyword as JSON. Each result includes video ID, caption, author, music, stats, and video URLs. Supports sorting by relevance or likes, and filtering by publish time. Use data.cursor for next page; stop when data.has_more is 0.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().default("0")
        .describe("Pagination cursor. Use data.cursor from previous response for next page."),
      count: z.number().int().min(1).max(30).default(20)
        .describe("Number of results per page (1-30)."),
      sort_type: z.enum(["0", "1"]).default("0")
        .describe("Sort order. '0' = relevance, '1' = most likes."),
      publish_time: z.enum(["0", "1", "7", "30", "90", "180"]).default("0")
        .describe("Time filter. '0'=all time, '1'=last day, '7'=week, '30'=month, '90'=3 months, '180'=6 months."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/search/videos", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_tiktok_users",
    `Search TikTok users by keyword as JSON. Each result includes user ID, username, display name, sec_uid, follower count, and bio. Use data.cursor for next page; stop when data.has_more is 0.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().default("0")
        .describe("Pagination cursor. Use data.cursor from previous response for next page."),
      count: z.number().int().min(1).max(30).default(20)
        .describe("Number of results per page (1-30)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/search/users", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_hashtag",
    `Get TikTok hashtag details and stats as JSON. Returns hashtag ID, title, description, video count, and view count. Provide either hashtag_name or hashtag_id. Use the returned ID with get_tiktok_hashtag_videos.`,
    {
      hashtag_name: z.string().optional()
        .describe("Hashtag text without the # symbol, e.g. 'fyp'."),
      hashtag_id: z.string().optional()
        .describe("Numeric hashtag ID. Use if you already have it from a previous request."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/hashtag", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_hashtag_videos",
    `List TikTok videos for a given hashtag as JSON. Each video includes ID, caption, author, stats, and video URLs. Requires hashtag_id from the get_tiktok_hashtag response. Use data.cursor for next page; stop when data.has_more is 0.`,
    {
      hashtag_id: z.string()
        .describe("Hashtag ID from the get_tiktok_hashtag response."),
      cursor: z.string().default("0")
        .describe("Pagination cursor. Use data.cursor from previous response for next page."),
      count: z.number().int().min(1).max(30).default(20)
        .describe("Number of results per page (1-30)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/hashtag/videos", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_user_followers",
    `Get a TikTok user's follower list as JSON. Each follower includes username, display name, sec_uid, follower count, video count, bio, and avatar. Pass both page_token and min_time from previous response for pagination; stop when data.has_more is false.`,
    {
      sec_user_id: z.string()
        .describe("Secure user ID from the get_tiktok_profile response."),
      count: z.number().int().min(1).max(20).default(20)
        .describe("Number of results per page (1-20)."),
      page_token: z.string().optional()
        .describe("Pagination token from previous response."),
      min_time: z.number().optional()
        .describe("Pagination timestamp from previous response. Must be passed together with page_token."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/user/followers", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_user_followings",
    `Get the list of accounts a TikTok user follows as JSON. Each entry includes username, display name, sec_uid, follower count, video count, bio, and avatar. Pass both page_token and min_time from previous response for pagination; stop when data.has_more is false.`,
    {
      sec_user_id: z.string()
        .describe("Secure user ID from the get_tiktok_profile response."),
      count: z.number().int().min(1).max(20).default(20)
        .describe("Number of results per page (1-20)."),
      page_token: z.string().optional()
        .describe("Pagination token from previous response."),
      min_time: z.number().optional()
        .describe("Pagination timestamp from previous response. Must be passed together with page_token."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/user/followings", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
