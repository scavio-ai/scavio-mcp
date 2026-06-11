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

export function registerInstagramTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_instagram_profile",
    `Get an Instagram user's profile as JSON. Returns user ID, username, full name, biography, external URL, profile picture, verified/private flags, and follower/following/post counts. Provide either username or user_id.`,
    {
      username: z.string().optional()
        .describe("Instagram handle without the @ symbol, e.g. 'instagram'."),
      user_id: z.string().optional()
        .describe("Numeric Instagram user ID. Use if you already have it from a previous request."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/profile", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_posts",
    `List an Instagram user's posts (timeline media) with pagination as JSON. Provide username or user_id. Use the end_cursor from data.page_info as the next cursor; stop when has_next_page is false.`,
    {
      username: z.string().optional()
        .describe("Instagram handle without the @ symbol."),
      user_id: z.string().optional()
        .describe("Numeric Instagram user ID."),
      count: z.number().int().min(1).max(50).default(12)
        .describe("Number of posts per page (1-50)."),
      cursor: z.string().optional()
        .describe("Pagination cursor (end_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/posts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_reels",
    `List an Instagram user's Reels with pagination as JSON. Provide username or user_id. Use the end_cursor from data.page_info as the next cursor; stop when has_next_page is false.`,
    {
      username: z.string().optional()
        .describe("Instagram handle without the @ symbol."),
      user_id: z.string().optional()
        .describe("Numeric Instagram user ID."),
      count: z.number().int().min(1).max(50).default(12)
        .describe("Number of reels per page (1-50)."),
      cursor: z.string().optional()
        .describe("Pagination cursor (end_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/reels", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_tagged",
    `List posts an Instagram user is tagged in, with pagination as JSON. Provide username or user_id. Use the end_cursor from data.page_info as the next cursor; stop when has_next_page is false.`,
    {
      username: z.string().optional()
        .describe("Instagram handle without the @ symbol."),
      user_id: z.string().optional()
        .describe("Numeric Instagram user ID."),
      count: z.number().int().min(1).max(50).default(12)
        .describe("Number of posts per page (1-50)."),
      cursor: z.string().optional()
        .describe("Pagination cursor (end_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/tagged", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_stories",
    `Get an Instagram user's currently active stories as JSON. Returns each story's media URLs, type, and timestamp. Provide either username or user_id.`,
    {
      username: z.string().optional()
        .describe("Instagram handle without the @ symbol."),
      user_id: z.string().optional()
        .describe("Numeric Instagram user ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/stories", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_post",
    `Get a single Instagram post (or reel) as JSON, including caption, author, media URLs, and engagement stats. Provide one of: url (a /p/, /reel/, /reels/, or /tv/ link), media_id, or shortcode.`,
    {
      url: z.string().optional()
        .describe("Instagram post URL, e.g. 'https://www.instagram.com/p/DUajw4YkorV/'."),
      media_id: z.string().optional()
        .describe("Numeric media ID."),
      shortcode: z.string().optional()
        .describe("Post shortcode, e.g. 'DUajw4YkorV'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/post", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_post_comments",
    `Get comments on an Instagram post as JSON. Each comment includes ID (pk), text, author, timestamp, and like count. Provide shortcode or url. Use data.next_min_id as the next cursor; stop when it is absent.`,
    {
      shortcode: z.string().optional()
        .describe("Post shortcode, e.g. 'DUajw4YkorV'."),
      url: z.string().optional()
        .describe("Instagram post URL; the shortcode is extracted from it."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_min_id) from a previous response."),
      sort_order: z.enum(["popular", "newest"]).default("popular")
        .describe("Comment sort order."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/post/comments", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_comment_replies",
    `Get replies to a specific Instagram comment as JSON. Requires the post's media_id and the parent comment_id (the pk from get_instagram_post_comments). Use data.next_min_child_cursor as the next cursor.`,
    {
      media_id: z.string()
        .describe("Numeric media ID of the post."),
      comment_id: z.string()
        .describe("Parent comment ID (pk) from the get_instagram_post_comments response."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_min_child_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/post/comments/replies", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_instagram_users",
    `Search Instagram users by keyword as JSON. Each result includes user ID, username, full name, verified flag, and follower count. Pass the rank_token from a previous response as the cursor for the next page.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().optional()
        .describe("Rank token from a previous response for pagination."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/search/users", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_instagram_hashtags",
    `Search Instagram hashtags by keyword as JSON. Each result includes the hashtag name, ID, and media count. Pass the rank_token from a previous response as the cursor for the next page.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().optional()
        .describe("Rank token from a previous response for pagination."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/search/hashtags", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_followers",
    `Get an Instagram user's follower list as JSON. Each follower includes user ID, username, full name, and verified flag. Provide username or user_id. Use data.next_max_id as the next cursor; stop when it is absent.`,
    {
      username: z.string().optional()
        .describe("Instagram handle without the @ symbol."),
      user_id: z.string().optional()
        .describe("Numeric Instagram user ID."),
      count: z.number().int().min(1).max(100).default(12)
        .describe("Number of users per page (1-100)."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_max_id) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/followers", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_followings",
    `Get the list of accounts an Instagram user follows as JSON. Each entry includes user ID, username, full name, and verified flag. Provide username or user_id. Use data.next_max_id as the next cursor; stop when it is absent.`,
    {
      username: z.string().optional()
        .describe("Instagram handle without the @ symbol."),
      user_id: z.string().optional()
        .describe("Numeric Instagram user ID."),
      count: z.number().int().min(1).max(100).default(12)
        .describe("Number of users per page (1-100)."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_max_id) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/followings", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
