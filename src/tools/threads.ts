import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

/**
 * The handle surcharge. Threads' upstream handle lookup is dead, so a username
 * has to be resolved through people search first — a second upstream call, and
 * 2 extra credits. user_id is always the cheap path.
 */
const usernameField = z.string().min(1).max(60).optional()
  .describe("Handle without @. Costs 2 EXTRA credits (4 vs 2) due to handle resolution. Prefer user_id. Either username or user_id required.");

const userIdField = z.string().min(1).optional()
  .describe("Numeric user id from get_threads_profile or search_threads_users. Cheap path: 2 credits. Either username or user_id required.");

const cursorField = z.string().optional()
  .describe("Cursor from data.next_cursor.");

export function registerThreadsTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_threads_profile",
    `Get a Threads user profile. 2 credits by user_id, 4 by username (handle resolution surcharge). Pass one of username or user_id.`,
    {
      username: usernameField,
      user_id: userIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/profile", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_threads_user_posts",
    `List a Threads user's posts. Cursor-paginated. 2 credits/page by user_id, 4 by username.`,
    {
      username: usernameField,
      user_id: userIdField,
      cursor: cursorField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/user/posts", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_threads_user_replies",
    `List replies a Threads user wrote to others (the Replies tab, not their own posts). Cursor-paginated. 2 credits/page by user_id, 4 by username.`,
    {
      username: usernameField,
      user_id: userIdField,
      cursor: cursorField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/user/replies", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_threads_post",
    `Get a Threads post by id or URL. Does NOT return replies (use get_threads_post_comments). Pass post_id or url. 2 credits.`,
    {
      post_id: z.string().min(1).optional()
        .describe("Post id. Either this or url required."),
      url: z.string().url().optional()
        .describe("threads.net post URL. Either this or post_id required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/post", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_threads_post_comments",
    `List replies to a Threads post. Cursor-paginated. Takes post_id only (no URL form). 2 credits/page.`,
    {
      post_id: z.string().min(1)
        .describe("Post id (no URL form on this endpoint)."),
      cursor: cursorField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/post/comments", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_threads_users",
    `Search Threads profiles by name/handle. People search ONLY (no post/content search on Threads). Use to resolve a handle to user_id for cheaper calls. 2 credits.`,
    {
      query: z.string().min(1).max(200)
        .describe("Name or handle to search for."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/search/users", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
