import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

/**
 * Result lists that `count` caps in the MCP output. Upstream often returns
 * more than was asked for (a count=3 search returned full pages), and each
 * TikTok record is large, so the requested count is enforced here. Records are
 * also projected to agent-useful fields (see src/lib/trim-platforms.ts); the
 * REST API response is unchanged.
 */
const TT_LISTS = ["aweme_list", "search_item_list", "comments", "user_list", "followers", "followings"];

export function registerTiktokTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_tiktok_profile",
    `Get a TikTok user's profile. Returns sec_user_id needed by the user_posts/followers/followings/similar/playlists tools. 1 credit.`,
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
        .describe("Max videos returned (1-30). Pages return up to ~10 videos whatever you request, so page with max_cursor for more."),
      sort_type: z.enum(["0", "1"]).default("0")
        .describe("'0' = latest, '1' = popular."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/user/posts", params);
        return trimResponse(data, { platform: "tiktok", limit: params.count, listKeys: TT_LISTS });
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
        return trimResponse(data, { platform: "tiktok" });
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
        .describe("Max comments returned."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/video/comments", params);
        return trimResponse(data, { platform: "tiktok", limit: params.count, listKeys: TT_LISTS });
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
        .describe("Max replies returned."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/video/comments/replies", params);
        return trimResponse(data, { platform: "tiktok", limit: params.count, listKeys: TT_LISTS });
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
        .describe("Max results returned."),
      sort_type: z.enum(["0", "1"]).default("0")
        .describe("'0' = relevance, '1' = most likes."),
      publish_time: z.enum(["0", "1", "7", "30", "90", "180"]).default("0")
        .describe("'0'=all, '1'=day, '7'=week, '30'=month, '90'=3mo, '180'=6mo."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/search/videos", params);
        return trimResponse(data, { platform: "tiktok", limit: params.count, listKeys: TT_LISTS });
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
        .describe("Max results returned."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/search/users", params);
        return trimResponse(data, { platform: "tiktok", limit: params.count, listKeys: TT_LISTS });
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
        return trimResponse(data, { platform: "tiktok" });
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
        .describe("Max results returned."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/hashtag/videos", params);
        return trimResponse(data, { platform: "tiktok", limit: params.count, listKeys: TT_LISTS });
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
        .describe("Max results returned."),
      page_token: z.string().optional()
        .describe("From previous response."),
      min_time: z.number().optional()
        .describe("From previous response, must accompany page_token."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/user/followers", params);
        return trimResponse(data, { platform: "tiktok", limit: params.count, listKeys: TT_LISTS });
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
        .describe("Max results returned."),
      page_token: z.string().optional()
        .describe("From previous response."),
      min_time: z.number().optional()
        .describe("From previous response, must accompany page_token."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok/user/followings", params);
        return trimResponse(data, { platform: "tiktok", limit: params.count, listKeys: TT_LISTS });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  // --- Depth tools (trending, sounds, playlists, live, region) ---
  //
  // Shapes mirror backend/src/routes/tiktok.ts field for field (names, enums,
  // regexes, min/max). No zod `.default()` here: the MCP SDK applies a default
  // before the handler runs, so a defaulted field would be posted on every call.
  // Defaults are stated in the describe text and left to the backend.
  //
  // These endpoints return TikTok's raw payload. Large numeric ids can lose
  // precision when parsed as JSON numbers, so descriptions point at the string
  // forms (id_str, sec_uid / sec_user_id).

  const depth = (path: string, listKeys: string[] = [], dropKeys: string[] = []) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/tiktok/${path}`, params);
      const limit = typeof params.count === "number" ? params.count : undefined;
      return trimResponse(data, { platform: "tiktok", limit, listKeys, dropKeys });
    } catch (err) {
      return handleApiError(err);
    }
  };

  const numericId = () => z.string().regex(/^\d{1,25}$/, "must be a numeric id");
  const secUserId = () => z.string().regex(/^[A-Za-z0-9_=-]{20,150}$/, "must be a sec_user_id")
    .describe("sec_user_id from get_tiktok_profile, get_tiktok_user_region or a user record's sec_uid.");
  const username = () => z.string().trim().regex(/^@*[A-Za-z0-9._]{1,50}$/, "must be a TikTok username")
    .describe("TikTok username, with or without the @, e.g. 'mrbeast'.");
  const cursor = () => z.string().optional()
    .describe("data.cursor from the previous response (default '0').");

  server.tool(
    "get_tiktok_trending_searches",
    `Get the search terms trending on TikTok right now (data.trending_search_words, about 90 per call). US-weighted, no region filter. 1 credit.`,
    {},
    depth("trending/searches"),
  );

  server.tool(
    "get_tiktok_trending_videos",
    `Get a sample of videos trending on TikTok now (data.itemList) with author, stats, sound and hashtags. Each call returns about 6 videos whatever count is set (up to 15); call again for a fresh sample. No region filter. 1 credit.`,
    {
      count: z.number().min(1).max(15).optional()
        .describe("Requested videos, 1-15 (default 15). About 6 come back per call."),
    },
    depth("trending/videos", ["itemList"]),
  );

  server.tool(
    "get_tiktok_search_suggestions",
    `Get TikTok search autocomplete suggestions for a keyword (data.data[].word). Long-tail keywords can return none; that is still a billed answer. 1 credit.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Seed keyword, e.g. 'cooking'."),
    },
    depth("search/suggestions"),
  );

  server.tool(
    "get_tiktok_music",
    `Get a TikTok sound by id (data.music_info): title, artist, album, duration, how many videos use it (user_count), original vs commercial, play URL, cover, and chart rank when charting. 1 credit.`,
    {
      music_id: numericId()
        .describe("The sound's numeric id (music id_str from a video, search_tiktok_music or get_tiktok_music_chart)."),
    },
    depth("music"),
  );

  server.tool(
    "get_tiktok_music_videos",
    `List videos that use a TikTok sound (data.aweme_list). About 14 per page whatever count is set; paginate with data.cursor/has_more. 1 credit.`,
    {
      music_id: numericId()
        .describe("The sound's numeric id."),
      cursor: cursor(),
      count: z.number().min(1).max(30).optional()
        .describe("Videos per page, 1-30 (default 10). Ignored upstream; pages hold about 14."),
    },
    depth("music/videos", ["aweme_list"]),
  );

  server.tool(
    "search_tiktok_music",
    `Search TikTok sounds by keyword (data.music): id_str, title, artist, duration, usage count and play URL. Paginate with data.cursor/has_more. 1 credit.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query, e.g. 'espresso'."),
      cursor: cursor(),
      count: z.number().min(1).max(20).optional()
        .describe("Sounds per page, 1-20 (default 20)."),
    },
    // music_info_list repeats every sound in data.music plus sample videos.
    depth("search/music", ["music"], ["music_info_list"]),
  );

  server.tool(
    "get_tiktok_music_chart",
    `Get TikTok's Top 50 or Viral 50 sound chart (data.music_list) with each sound's details and trend. One global chart, no region filter. Paginate with data.cursor/has_more. 1 credit.`,
    {
      chart: z.enum(["top", "viral"]).optional()
        .describe("'top' = Top 50 (default), 'viral' = Viral 50."),
      cursor: cursor(),
      count: z.number().min(1).max(50).optional()
        .describe("Sounds per page, 1-50 (default 50)."),
    },
    depth("music/chart", ["music_list"]),
  );

  server.tool(
    "get_tiktok_user_similar",
    `Get creators similar to a TikTok user (data.users, about 30 per page) with follower, following, video and like counts, bio and verification. Paginate with data.next_page_token/has_more. 1 credit.`,
    {
      sec_user_id: secUserId(),
      page_token: z.string().max(200).optional()
        .describe("data.next_page_token from the previous response."),
    },
    depth("user/similar"),
  );

  server.tool(
    "get_tiktok_user_playlists",
    `List a TikTok user's playlists (series) in data.playList: mixId, name, video count, cover. Accounts without playlists return an empty list. Paginate with data.cursor/hasMore. 1 credit.`,
    {
      sec_user_id: secUserId(),
      cursor: cursor(),
      count: z.number().min(1).max(30).optional()
        .describe("Playlists per page, 1-30 (default 30)."),
    },
    depth("user/playlists", ["playList"]),
  );

  server.tool(
    "get_tiktok_playlist_videos",
    `List the videos in a TikTok playlist (data.itemList). Paginate with data.cursor/hasMore. 1 credit.`,
    {
      playlist_id: numericId()
        .describe("The playlist's numeric id (mixId from get_tiktok_user_playlists)."),
      cursor: cursor(),
      count: z.number().min(1).max(30).optional()
        .describe("Videos per page, 1-30 (default 30)."),
    },
    depth("playlist/videos", ["itemList"]),
  );

  server.tool(
    "get_tiktok_user_live",
    `Check whether a TikTok user is live now: user, live room status (2 = live, 4 = not live), title, start time and current viewer counts. An unknown username is a billed 404. 1 credit.`,
    {
      username: username(),
    },
    // hevcStreamData is the same stream ladder as streamData in another codec.
    depth("user/live", [], ["hevcStreamData"]),
  );

  server.tool(
    "get_tiktok_user_region",
    `Get the region a TikTok account is registered in (ISO country code, not the creator's nationality), plus user_id and sec_user_id. An unknown username is a 404 and not billed. 1 credit.`,
    {
      username: username(),
    },
    depth("user/region"),
  );
}
