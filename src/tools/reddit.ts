import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerRedditTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_reddit",
    `Search Reddit posts. Relevance order only, no sort/filter. Paginate with next_cursor. Slow (5-15s). 1 credit.`,
    {
      query: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().optional()
        .describe("Pagination cursor from data.next_cursor."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_post",
    `Get a Reddit post by URL or post id. Does NOT return comments (use get_reddit_post_comments). Slow (5-15s). 1 credit.`,
    {
      post_id: z.string().min(1).optional()
        .describe("Post fullname (t3_...) or bare id. Either this or url required."),
      url: z.string().url().optional()
        .describe("Full Reddit post URL. Either this or post_id required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/post", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_search_suggestions",
    `Get Reddit search autocomplete suggestions. 1 credit.`,
    {
      query: z.string().min(1).max(500)
        .describe("Seed query to autocomplete."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/search/suggestions", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_post_comments",
    `Get top-level comments for a Reddit post. Paginate with next_cursor. 1 credit.`,
    {
      post_id: z.string().min(1)
        .describe("Post fullname, e.g. 't3_1v6ngaf'."),
      sort: z.enum(["HOT", "NEW", "TOP", "BEST", "CONTROVERSIAL"]).default("TOP")
        .describe("Sort order."),
      cursor: z.string().optional()
        .describe("Cursor from data.next_cursor."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/post/comments", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_comment_replies",
    `Get replies to a Reddit comment. Requires post_id and reply_cursor from get_reddit_post_comments. 1 credit.`,
    {
      post_id: z.string().min(1)
        .describe("Post fullname, e.g. 't3_1v6ngaf'."),
      cursor: z.string().min(1)
        .describe("reply_cursor from a comment in get_reddit_post_comments."),
      sort: z.enum(["HOT", "NEW", "TOP", "BEST", "CONTROVERSIAL"]).default("TOP")
        .describe("Sort order."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/post/comments/replies", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_subreddit",
    `Get subreddit metadata (description, subscribers, type, etc). 1 credit.`,
    {
      subreddit: z.string().min(1).max(100)
        .describe("Subreddit name without r/."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/subreddit", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_subreddit_posts",
    `List posts in a subreddit. Paginate with next_cursor. 1 credit.`,
    {
      subreddit: z.string().min(1).max(100)
        .describe("Subreddit name without r/."),
      sort: z.enum(["BEST", "HOT", "NEW", "TOP", "CONTROVERSIAL", "RISING"]).default("HOT")
        .describe("Sort order."),
      cursor: z.string().optional()
        .describe("Cursor from data.next_cursor."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/subreddit/posts", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_user",
    `Get a Reddit user's profile. 1 credit.`,
    {
      username: z.string().min(1).max(100)
        .describe("Username without u/."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/user", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_user_posts",
    `List a Reddit user's submitted posts. Paginate with next_cursor. 1 credit.`,
    {
      username: z.string().min(1).max(100)
        .describe("Username without u/."),
      sort: z.enum(["HOT", "NEW", "TOP", "BEST", "CONTROVERSIAL"]).default("NEW")
        .describe("Sort order."),
      cursor: z.string().optional()
        .describe("Cursor from data.next_cursor."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/user/posts", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_user_comments",
    `List a Reddit user's comments. Paginate with next_cursor. 1 credit.`,
    {
      username: z.string().min(1).max(100)
        .describe("Username without u/."),
      sort: z.enum(["HOT", "NEW", "TOP", "BEST", "CONTROVERSIAL"]).default("NEW")
        .describe("Sort order."),
      cursor: z.string().optional()
        .describe("Cursor from data.next_cursor."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/user/comments", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_popular",
    `Get Reddit's site-wide popular feed. Paginate with next_cursor. 1 credit.`,
    {
      cursor: z.string().optional()
        .describe("Cursor from data.next_cursor."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/popular", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_trending",
    `Get Reddit's current trending search queries. 1 credit.`,
    {},
    async () => {
      try {
        const data = await getClient().post("/api/v1/reddit/trending", {});
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
