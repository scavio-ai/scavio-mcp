import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerXTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_x",
    `Search X tweets and people. Paginate with next_cursor/has_more. 1 credit.`,
    {
      search: z.string().min(1).max(500)
        .describe("Search query."),
      search_type: z.enum(["Top", "Latest", "People", "Photos", "Videos"]).optional()
        .describe("Top (default), Latest, People, Photos, Videos."),
      cursor: z.string().optional()
        .describe("next_cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tweet",
    `Get a single tweet's full details. 1 credit.`,
    {
      tweet_id: z.string().min(1)
        .describe("Tweet ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/tweet", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tweet_comments",
    `Get replies to a tweet. Paginate with next_cursor/has_more. 1 credit.`,
    {
      tweet_id: z.string().min(1)
        .describe("Tweet ID."),
      rank: z.enum(["top", "latest"]).optional()
        .describe("'top' (default) or 'latest'."),
      cursor: z.string().optional()
        .describe("next_cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/tweet/comments", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tweet_retweeters",
    `Get users who retweeted a tweet. Paginate with next_cursor/has_more. 1 credit.`,
    {
      tweet_id: z.string().min(1)
        .describe("Tweet ID."),
      cursor: z.string().optional()
        .describe("next_cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/tweet/retweeters", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user",
    `Get an X user's profile. 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("Handle without @, e.g. 'elonmusk'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user_tweets",
    `List an X user's tweets. No has_more; stop when next_cursor absent or timeline empty. 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("Handle without @."),
      cursor: z.string().optional()
        .describe("next_cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user/tweets", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user_replies",
    `List an X user's tweets and replies. No has_more; stop when next_cursor absent or timeline empty. 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("Handle without @."),
      cursor: z.string().optional()
        .describe("next_cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user/replies", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user_media",
    `List an X user's media tweets. No has_more; stop when next_cursor absent or timeline empty. 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("Handle without @."),
      cursor: z.string().optional()
        .describe("next_cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user/media", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user_followers",
    `List an X user's followers. Paginate with next_cursor/has_more. 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("Handle without @."),
      cursor: z.string().optional()
        .describe("next_cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user/followers", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_user_followings",
    `List accounts an X user follows (data.following). Paginate with next_cursor/has_more. 1 credit.`,
    {
      screen_name: z.string().min(1)
        .describe("Handle without @."),
      cursor: z.string().optional()
        .describe("next_cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/user/followings", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_x_trending",
    `Get trending topics on X for a country. 1 credit.`,
    {
      country: z.string().optional()
        .describe("e.g. 'UnitedStates' (default), 'UnitedKingdom', 'Japan'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/x/trending", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
