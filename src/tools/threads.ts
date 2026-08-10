import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

/**
 * The handle surcharge. Threads' upstream handle lookup is dead, so a username
 * has to be resolved through people search first — a second upstream call, and
 * 2 extra credits. user_id is always the cheap path.
 */
const usernameField = z.string().min(1).max(60).optional()
  .describe("Threads handle without the @, e.g. 'natgeo'. Costs 2 EXTRA credits (4 instead of 2) because the handle must be resolved to a numeric id first. Prefer user_id when you have it. Either username or user_id is required.");

const userIdField = z.string().min(1).optional()
  .describe("Numeric Threads user id, e.g. '63625256886' — the user_id field returned by get_threads_profile or search_threads_users. This is the cheap path: 2 credits. Either username or user_id is required.");

const cursorField = z.string().optional()
  .describe("Pagination cursor. Pass data.next_cursor from the previous response to get the next page.");

export function registerThreadsTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_threads_profile",
    `Get a Threads (Meta's text app, threads.net) user profile as JSON. Returns user_id, username, full_name, biography, profile_pic_url, follower_count, is_verified and is_private. Address the user by user_id for 2 credits, or by username for 4 credits — the handle costs 2 extra because Threads' upstream handle lookup is dead and the handle has to be resolved through people search first. Resolve a handle to a user_id once with search_threads_users, then reuse that user_id across calls to stay on the 2-credit path. Pass exactly one of username or user_id: sending neither, or both in conflict, returns 422; an unknown user returns 404. Not paginated.`,
    {
      username: usernameField,
      user_id: userIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/profile", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_threads_user_posts",
    `List a Threads user's own posts as JSON. Returns data.posts, each with post_id, code, text, taken_at, like_count, reply_count, repost_count, media_type, cover_url, video_url and the author object (user_id, username, full_name, follower_count, is_verified). Cursor-paginated: pass data.next_cursor back as cursor while data.has_more is true. Costs 2 credits per page when addressed by user_id, or 4 credits per page when addressed by username — the handle costs 2 extra because it has to be resolved to a numeric id first, so resolve once and page by user_id. Pass exactly one of username or user_id (422 otherwise, 404 for an unknown user).`,
    {
      username: usernameField,
      user_id: userIdField,
      cursor: cursorField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/user/posts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_threads_user_replies",
    `List the replies a Threads user has written to other people's posts, as JSON — the "Replies" tab of their profile, not their own posts (use get_threads_user_posts for those). Returns data.posts, each with post_id, code, text, taken_at, like_count, reply_count, repost_count, media_type, cover_url, video_url and the author object. Cursor-paginated: pass data.next_cursor back as cursor while data.has_more is true. Costs 2 credits per page when addressed by user_id, or 4 credits per page when addressed by username — the handle costs 2 extra because it has to be resolved to a numeric id first. Pass exactly one of username or user_id (422 otherwise, 404 for an unknown user).`,
    {
      username: usernameField,
      user_id: userIdField,
      cursor: cursorField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/user/replies", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_threads_post",
    `Get a single Threads post by its id or its threads.net URL, as JSON. Returns a flat post object: post_id, code, text, taken_at, like_count, reply_count, repost_count, media_type, cover_url, video_url and the author (user_id, username, full_name, biography, follower_count, is_verified, is_private). Does NOT return the replies — call get_threads_post_comments with the post_id for those. Pass exactly one of post_id or url; sending neither returns 422. Always costs 2 credits (there is no handle surcharge on this tool). Not paginated.`,
    {
      post_id: z.string().min(1).optional()
        .describe("Threads post id, e.g. '3349029093483693129'. Either this or url is required."),
      url: z.string().url().optional()
        .describe("Full threads.net post URL, e.g. 'https://www.threads.net/@natgeo/post/C8xY'. Either this or post_id is required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/post", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_threads_post_comments",
    `List the replies to a Threads post as JSON. Returns data.comments, each with post_id, code, text, taken_at, like_count, reply_count, repost_count, media_type, cover_url, video_url and the author object (user_id, username, full_name, follower_count, is_verified). Cursor-paginated: pass data.next_cursor back as cursor while data.has_more is true. Takes a post_id only — there is no username or URL form here; get the post_id from get_threads_post, get_threads_user_posts or a threads.net URL. Always costs 2 credits per page.`,
    {
      post_id: z.string().min(1)
        .describe("Threads post id, e.g. '3349029093483693129'. Required — this tool does not accept a URL."),
      cursor: cursorField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/post/comments", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_threads_users",
    `Search Threads PROFILES by name or handle, as JSON. Returns data.users, each with user_id, username, full_name, biography, profile_pic_url, follower_count, is_verified and is_private. This is people search and it is the ONLY search Threads exposes — there is no post or content search on Threads, so this tool cannot find posts by keyword, hashtag or topic. Its main use is resolving a handle to a numeric user_id once, so that get_threads_profile, get_threads_user_posts and get_threads_user_replies can be called on the cheap 2-credit user_id path instead of the 4-credit username path. Costs 2 credits. Not paginated — one result set per query.`,
    {
      query: z.string().min(1).max(200)
        .describe("Name or handle to search for, e.g. 'national geographic' or 'natgeo'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/threads/search/users", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
