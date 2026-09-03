import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerTiktokTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_tiktok_profile",
    `Get a TikTok user's profile. Returns sec_user_id needed by user_posts/followers/followings tools. 1 credit.`,
    {
      username: z.string().optional()
        .describe("TikTok handle without @, e.g. 'charlidamelio'."),
      sec_user_id: z.string().optional()
        .describe("Secure user ID from a previous request."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/profile", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_user_posts",
    `List a TikTok user's videos. Requires sec_user_id. Paginate with max_cursor/has_more. 1 credit.`,
    {
      sec_user_id: z.string()
        .describe("From get_tiktok_profile."),
      cursor: z.string().default("0")
        .describe("Use data.max_cursor from previous response."),
      count: z.number().int().min(1).max(30).default(20)
        .describe("Results per page."),
      sort_type: z.enum(["0", "1"]).default("0")
        .describe("'0' = latest, '1' = popular."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/user/posts", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_video",
    `Get TikTok video details: caption, stats, play URLs, author, music. 1 credit.`,
    {
      video_id: z.string()
        .describe("TikTok video ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/video", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_video_comments",
    `Get comments on a TikTok video. Paginate with data.cursor/has_more. 1 credit.`,
    {
      video_id: z.string()
        .describe("TikTok video ID."),
      cursor: z.string().default("0")
        .describe("From data.cursor of previous response."),
      count: z.number().int().min(1).max(50).default(20)
        .describe("Comments per page."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/video/comments", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_comment_replies",
    `Get replies to a TikTok comment. Paginate with data.cursor/has_more. 1 credit.`,
    {
      video_id: z.string()
        .describe("TikTok video ID."),
      comment_id: z.string()
        .describe("Comment ID from get_tiktok_video_comments."),
      cursor: z.string().default("0")
        .describe("From data.cursor of previous response."),
      count: z.number().int().min(1).max(50).default(20)
        .describe("Replies per page."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/video/comments/replies", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_tiktok_videos",
    `Search TikTok videos by keyword. Paginate with data.cursor/has_more. 1 credit.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().default("0")
        .describe("From data.cursor of previous response."),
      count: z.number().int().min(1).max(30).default(20)
        .describe("Results per page."),
      sort_type: z.enum(["0", "1"]).default("0")
        .describe("'0' = relevance, '1' = most likes."),
      publish_time: z.enum(["0", "1", "7", "30", "90", "180"]).default("0")
        .describe("'0'=all, '1'=day, '7'=week, '30'=month, '90'=3mo, '180'=6mo."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/search/videos", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_tiktok_users",
    `Search TikTok users by keyword. Paginate with data.cursor/has_more. 1 credit.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().default("0")
        .describe("From data.cursor of previous response."),
      count: z.number().int().min(1).max(30).default(20)
        .describe("Results per page."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/search/users", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_hashtag",
    `Get TikTok hashtag stats. Returns ID for use with get_tiktok_hashtag_videos. 1 credit.`,
    {
      hashtag_name: z.string().optional()
        .describe("Hashtag without #, e.g. 'fyp'."),
      hashtag_id: z.string().optional()
        .describe("Numeric hashtag ID from a previous request."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/hashtag", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_hashtag_videos",
    `List TikTok videos for a hashtag. Requires hashtag_id from get_tiktok_hashtag. 1 credit.`,
    {
      hashtag_id: z.string()
        .describe("From get_tiktok_hashtag."),
      cursor: z.string().default("0")
        .describe("From data.cursor of previous response."),
      count: z.number().int().min(1).max(30).default(20)
        .describe("Results per page."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/hashtag/videos", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_user_followers",
    `Get a TikTok user's followers. Pass both page_token and min_time together for next page. 1 credit.`,
    {
      sec_user_id: z.string()
        .describe("From get_tiktok_profile."),
      count: z.number().int().min(1).max(20).default(20)
        .describe("Results per page."),
      page_token: z.string().optional()
        .describe("From previous response."),
      min_time: z.number().optional()
        .describe("From previous response, must accompany page_token."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/user/followers", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_user_followings",
    `Get accounts a TikTok user follows. Pass both page_token and min_time together for next page. 1 credit.`,
    {
      sec_user_id: z.string()
        .describe("From get_tiktok_profile."),
      count: z.number().int().min(1).max(20).default(20)
        .describe("Results per page."),
      page_token: z.string().optional()
        .describe("From previous response."),
      min_time: z.number().optional()
        .describe("From previous response, must accompany page_token."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/user/followings", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
