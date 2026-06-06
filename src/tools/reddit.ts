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
}
