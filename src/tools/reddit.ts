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

export function registerRedditTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_reddit",
    `Search Reddit posts across all of Reddit as JSON. Each post includes title, URL, subreddit, author, timestamp, and NSFW flag. Use data.nextCursor as the cursor parameter for the next page; stop when nextCursor is null. Slower than other platforms (5-15 seconds).`,
    {
      query: z.string().min(1).max(500)
        .describe("Search query (1-500 chars)."),
      type: z.enum(["posts", "comments"]).optional()
        .describe("Result type (server default 'posts')."),
      sort: z.enum(["relevance", "hot", "top", "new", "comments"]).default("relevance")
        .describe("Sort order. 'relevance' (default), 'hot', 'top', 'new', or 'comments'."),
      cursor: z.string().optional()
        .describe("Pagination token. Use data.nextCursor from previous response for next page."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_post",
    `Get a full Reddit post by URL as JSON, including body, score, upvote ratio, flair, awards, and the full comment tree. Comments are a flat array in traversal order; use depth (0-indexed) or parentId to reconstruct the thread hierarchy. contentUrl is the external article for link posts. Slower than other platforms (5-15 seconds).`,
    {
      url: z.string()
        .describe("Full Reddit post URL, e.g. 'https://www.reddit.com/r/Python/comments/1smb9du/fastapi_vs_django/'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/post", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_search_suggestions",
    `Get Reddit search autocomplete suggestions for a query as JSON. Returns a list of suggested search strings. Use to expand a seed keyword or surface what people search for. Costs 1 credit.`,
    {
      search: z.string().min(1).max(500)
        .describe("Partial or seed search query to autocomplete."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/search/suggestions", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_post_comments",
    `Get the top-level comments for a Reddit post as JSON. Each comment includes its ID, text, author, score, timestamp, and a reply_cursor for fetching its replies. Accepts a post fullname (t3_...). Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      post_id: z.string().min(1)
        .describe("Post fullname (t3_...), e.g. 't3_1v6ngaf'."),
      sort: z.enum(["HOT", "NEW", "TOP", "BEST", "CONTROVERSIAL"]).default("TOP")
        .describe("Comment sort order (default 'TOP')."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/post/comments", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_comment_replies",
    `Get the replies to a specific Reddit comment as JSON. Requires the post fullname and the reply_cursor from a comment in the get_reddit_post_comments response. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      post_id: z.string().min(1)
        .describe("Post fullname (t3_...), e.g. 't3_1v6ngaf'."),
      cursor: z.string().min(1)
        .describe("The reply_cursor from a comment in the get_reddit_post_comments response."),
      sort: z.enum(["HOT", "NEW", "TOP", "BEST", "CONTROVERSIAL"]).default("TOP")
        .describe("Reply sort order (default 'TOP')."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/post/comments/replies", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_subreddit",
    `Get metadata for a subreddit as JSON, including its name, title, description, subscriber count, type, NSFW flag, icon, banner, primary color, and creation date. Accepts a subreddit name (without r/). Costs 1 credit.`,
    {
      subreddit: z.string().min(1).max(100)
        .describe("Subreddit name without r/, e.g. 'AskReddit'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/subreddit", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_subreddit_posts",
    `List a subreddit's post feed as JSON. Each post includes its ID, title, URL, text, author, score, comment count, timestamp, and NSFW flag. Accepts a subreddit name (without r/). Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      subreddit: z.string().min(1).max(100)
        .describe("Subreddit name without r/, e.g. 'AskReddit'."),
      sort: z.enum(["BEST", "HOT", "NEW", "TOP", "CONTROVERSIAL", "RISING"]).default("HOT")
        .describe("Feed sort order (default 'HOT')."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/subreddit/posts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_user",
    `Get a redditor's profile as JSON, including their ID, name, employee/verified flags, account type, and whether they accept private messages. Accepts a username (without u/). Costs 1 credit.`,
    {
      username: z.string().min(1).max(100)
        .describe("Reddit username without u/, e.g. 'spez'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/user", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_user_posts",
    `List a redditor's submitted posts as JSON. Each post includes its ID, title, URL, subreddit, score, comment count, and timestamp. Accepts a username (without u/). Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      username: z.string().min(1).max(100)
        .describe("Reddit username without u/, e.g. 'spez'."),
      sort: z.enum(["HOT", "NEW", "TOP", "BEST", "CONTROVERSIAL"]).default("NEW")
        .describe("Sort order (default 'NEW')."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/user/posts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_user_comments",
    `List a redditor's comments as JSON. Each comment includes its ID, text, author, the post it belongs to (ID and title), score, and timestamp. Accepts a username (without u/). Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      username: z.string().min(1).max(100)
        .describe("Reddit username without u/, e.g. 'spez'."),
      sort: z.enum(["HOT", "NEW", "TOP", "BEST", "CONTROVERSIAL"]).default("NEW")
        .describe("Sort order (default 'NEW')."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/user/comments", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_popular",
    `Get the site-wide popular feed as JSON. Each post includes its ID, title, subreddit, author, score, comment count, URL, and timestamp. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/reddit/popular", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_reddit_trending",
    `Get Reddit's current trending search queries as JSON. Each entry includes the display query and the raw query. Takes no parameters. Costs 1 credit.`,
    {},
    async () => {
      try {
        const data = await getClient().post("/api/v1/reddit/trending", {});
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
