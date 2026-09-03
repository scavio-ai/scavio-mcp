import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerInstagramTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_instagram_profile",
    `Get an Instagram user's profile. 10 credits.`,
    {
      username: z.string().optional()
        .describe("Handle without @, e.g. 'instagram'."),
      user_id: z.string().optional()
        .describe("Numeric user ID from a previous request."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/profile", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_posts",
    `List an Instagram user's posts. Pass pagination_token or next_max_id as cursor. 2 credits.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
      count: z.number().int().min(1).max(50).default(12)
        .describe("Posts per page (best effort)."),
      cursor: z.string().optional()
        .describe("pagination_token or next_max_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/posts", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_reels",
    `List an Instagram user's Reels. Paginate with next_max_id. 10 credits.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
      count: z.number().int().min(1).max(50).default(12)
        .describe("Reels per page."),
      cursor: z.string().optional()
        .describe("next_max_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/reels", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_tagged",
    `List posts an Instagram user is tagged in. Paginate with next_max_id/more_available. 10 credits.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
      count: z.number().int().min(1).max(50).default(12)
        .describe("Posts per page."),
      cursor: z.string().optional()
        .describe("next_max_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/tagged", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_stories",
    `Get an Instagram user's active stories. Not paginated. 10 credits.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/stories", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_post",
    `Get a single Instagram post/reel. Provide url, media_id, or shortcode. media_type: 1=image, 2=video, 8=carousel. 8 credits.`,
    {
      url: z.string().optional()
        .describe("Post URL."),
      media_id: z.string().optional()
        .describe("Numeric media ID."),
      shortcode: z.string().optional()
        .describe("Post shortcode, e.g. 'DUajw4YkorV'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/post", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_post_comments",
    `Get comments on an Instagram post. Provide shortcode or url (not media_id). Paginate with next_min_id. 10 credits.`,
    {
      shortcode: z.string().optional()
        .describe("Post shortcode."),
      url: z.string().optional()
        .describe("Post URL."),
      cursor: z.string().optional()
        .describe("next_min_id from previous response."),
      sort_order: z.enum(["popular", "newest"]).default("popular")
        .describe("Sort order (best effort)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/post/comments", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_comment_replies",
    `Get replies to an Instagram comment. Requires media_id (from get_instagram_post) and comment_id (pk from get_instagram_post_comments). 8 credits.`,
    {
      media_id: z.string()
        .describe("Post media ID (from get_instagram_post)."),
      comment_id: z.string()
        .describe("Comment pk from get_instagram_post_comments."),
      cursor: z.string().optional()
        .describe("next_min_child_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/post/comments/replies", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_instagram_users",
    `Search Instagram users by keyword. Pagination via rank_token is best effort. 10 credits.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().optional()
        .describe("rank_token from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/search/users", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_instagram_hashtags",
    `Search Instagram hashtags by keyword. Pagination via rank_token is best effort. 10 credits.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().optional()
        .describe("rank_token from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/search/hashtags", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_followers",
    `Get an Instagram user's followers. Paginate with next_max_id/has_more. 10 credits.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
      count: z.number().int().min(1).max(100).default(12)
        .describe("Users per page."),
      cursor: z.string().optional()
        .describe("next_max_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/followers", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_followings",
    `Get accounts an Instagram user follows. Paginate with next_max_id/has_more. 10 credits.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
      count: z.number().int().min(1).max(100).default(12)
        .describe("Users per page."),
      cursor: z.string().optional()
        .describe("next_max_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/followings", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
