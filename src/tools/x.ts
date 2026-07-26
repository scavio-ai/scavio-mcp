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

export function registerXTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_x",
    `Search X for tweets and people as JSON. Each result includes the tweet ID, author handle, text, language, timestamp, and engagement counts (favorites, retweets, replies, quotes, bookmarks, views). Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit. Use when the user asks to find tweets or accounts about a topic.`,
    {
      search: z.string().min(1).max(500)
        .describe("X search query."),
      search_type: z.enum(["Top", "Latest", "People", "Photos", "Videos"]).optional()
        .describe("Result category. 'Top' (default), 'Latest', 'People', 'Photos', or 'Videos'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tweet",
    `Get full details for a single tweet as JSON. Returns the tweet ID, text, display text, timestamp, language, engagement counts (favorites, retweets, replies, quotes, bookmarks, views), source, and reply-to reference. Accepts a tweet ID. Costs 1 credit.`,
    {
      tweet_id: z.string().min(1)
        .describe("Tweet ID, e.g. '1808168603721650364'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/tweet", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tweet_comments",
    `Get replies to a tweet as JSON, ranked or chronological. Each reply includes the tweet ID, author handle, text, timestamp, and engagement counts. Accepts a tweet ID. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      tweet_id: z.string().min(1)
        .describe("Tweet ID, e.g. '1808168603721650364'."),
      rank: z.enum(["top", "latest"]).optional()
        .describe("'top' for ranked replies (default), 'latest' for chronological."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/tweet/comments", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tweet_retweeters",
    `Get the users who retweeted a tweet as JSON. Each user includes the user ID, handle, name, description, follower/friends/statuses/media counts, and profile image. Accepts a tweet ID. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      tweet_id: z.string().min(1)
        .describe("Tweet ID, e.g. '1808168603721650364'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/tweet/retweeters", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user",
    `Get an X user's profile as JSON. Returns the rest ID, handle, name, description, follower/friends/statuses/media counts, verified flag, avatar, header image, location, website, and creation date. Accepts a handle (without @). Costs 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("An X handle without the @, e.g. 'elonmusk'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user_tweets",
    `List an X user's tweets as JSON, including a pinned tweet when present. Each tweet includes the tweet ID, text, timestamp, engagement counts, and conversation ID. Accepts a handle (without @). Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("An X handle without the @, e.g. 'elonmusk'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user/tweets", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user_replies",
    `List an X user's tweets and replies as JSON. Each entry includes the tweet ID, text, timestamp, and engagement counts. Accepts a handle (without @). Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("An X handle without the @, e.g. 'elonmusk'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user/replies", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user_media",
    `List an X user's media tweets (posts with photos or videos) as JSON. Each entry includes the tweet ID, text, timestamp, and engagement counts. Accepts a handle (without @). Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("An X handle without the @, e.g. 'elonmusk'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user/media", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user_followers",
    `List an X user's followers as JSON. Each follower includes the user ID, handle, name, description, follower count, verified flag, and location. Accepts a handle (without @). Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("An X handle without the @, e.g. 'elonmusk'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user/followers", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user_followings",
    `List the accounts an X user follows as JSON. Each account includes the user ID, handle, name, description, follower count, verified flag, and location. Accepts a handle (without @). Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("An X handle without the @, e.g. 'elonmusk'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user/followings", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_trending",
    `Get trending topics on X for a country as JSON. Each trend includes its name, description, and context. Costs 1 credit.`,
    {
      country: z.string().optional()
        .describe("Country name, e.g. 'UnitedStates' (default), 'UnitedKingdom', 'Japan'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/trending", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
